// tests/unit/router-utilization.test.mjs — locks the ONGOING view: how many tasks landed in each band
// and what that saved vs the current frontier (Fable 5). Pure/deterministic: reads a controlled receipts
// file, makes NO model or network call. Every number is checked against a hand-computed expectation so a
// future edit can't silently change the savings math a user sees.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'router-util-'));
const RECEIPTS = path.join(TMP, 'receipts.jsonl');

// Hand-computed against route-cheap pricing (deepseek-chat in 0.20/out 0.80; sonnet-5 in 2/out 10;
// fable-5 frontier in 10/out 50). $ = (in*pin + out*pout) / 1e6.
fs.writeFileSync(
  RECEIPTS,
  [
    // cheap: deepseek-chat, 100 in / 900 out → realized 0.00074, frontier(fable) 0.046
    JSON.stringify({ ts: '2026-07-10T00:00:00Z', model: 'deepseek/deepseek-chat', est_in_tokens: 100, est_out_tokens: 900, est_cost: 0.00074 }),
    // mid: sonnet-5, 1000 in / 1000 out → realized 0.012, frontier(fable) 0.06
    JSON.stringify({ ts: '2026-07-11T00:00:00Z', model: 'claude-sonnet-5', est_in_tokens: 1000, est_out_tokens: 1000, est_cost: 0.012 }),
    // mid again (sonnet) so mid has 2 tasks
    JSON.stringify({ ts: '2026-07-12T00:00:00Z', model: 'claude-sonnet-5', est_in_tokens: 1000, est_out_tokens: 1000, est_cost: 0.012 }),
    // mechanical: agent-booster ($0, no per-token price) — realized 0, still saved the full frontier
    JSON.stringify({ ts: '2026-07-13T00:00:00Z', model: 'agent-booster', est_in_tokens: 500, est_out_tokens: 500 }),
    // unpriced model — excluded from the $ math, counted under `unpriced`, never invented
    JSON.stringify({ ts: '2026-07-14T00:00:00Z', model: 'some/unknown-model', est_in_tokens: 100, est_out_tokens: 100 }),
    '',                 // blank — ignored
    'not-json',         // malformed — skipped
    JSON.stringify({ ts: '2026-07-15T00:00:00Z', est_in_tokens: 5 }), // no model — ignored
  ].join('\n') + '\n'
);
process.env.METAHARNESS_RECEIPTS = RECEIPTS;

let utilization, bandOf, BAND_ORDER, printUtil, mainUtil;
beforeAll(async () => {
  ({ utilization, bandOf, BAND_ORDER, printUtil, mainUtil } = await import('../../scripts/router-utilization.mjs'));
});

const bandRow = (u, name) => u.distribution.find((d) => d.band === name);

describe('router-utilization — the ongoing per-bucket distribution + savings', () => {
  let u;
  beforeAll(() => { u = utilization({ receiptsFile: RECEIPTS }); });

  it('counts only real, model-bearing receipts (blank/malformed/no-model ignored)', () => {
    // deepseek + sonnet + sonnet + agent-booster + unknown = 5 model-bearing lines
    expect(u.tasks).toBe(5);
  });

  it('recomputes savings against the CURRENT frontier — Fable 5, not a stale Opus number', () => {
    expect(u.frontierModel).toBe('claude-fable-5');
  });

  it('excludes an unpriced model from the $ math instead of inventing a cost', () => {
    expect(u.unpriced).toBe(1);
  });

  it('surfaces all four bands in canonical order', () => {
    expect(u.distribution.map((d) => d.band)).toEqual(['mechanical', 'cheap', 'mid', 'frontier']);
    expect(BAND_ORDER).toEqual(['mechanical', 'cheap', 'mid', 'frontier']);
  });

  it('cheap band = 1 deepseek task, saved ≈ frontier(0.046) − realized(0.00074)', () => {
    const c = bandRow(u, 'cheap');
    expect(c.tasks).toBe(1);
    // realized rounds to 4dp for display: 0.00074 → 0.0007; saved = 0.046 − 0.00074 → 0.0453
    expect(c.realizedUsd).toBeCloseTo(0.0007, 4);
    expect(c.frontierUsd).toBeCloseTo(0.046, 4);
    expect(c.savedUsd).toBeCloseTo(0.0453, 4);
    expect(c.models).toEqual([{ model: 'deepseek/deepseek-chat', tasks: 1 }]);
  });

  it('mid band = 2 sonnet tasks, realized 0.024 vs frontier 0.12', () => {
    const m = bandRow(u, 'mid');
    expect(m.tasks).toBe(2);
    expect(m.pctOfTasks).toBe(40); // 2 of 5
    expect(m.realizedUsd).toBeCloseTo(0.024, 4);
    expect(m.frontierUsd).toBeCloseTo(0.12, 4);
    expect(m.models).toEqual([{ model: 'claude-sonnet-5', tasks: 2 }]);
  });

  it('mechanical band = the $0 no-LLM tier: realized 0, but still credits the full frontier saving', () => {
    const mech = bandRow(u, 'mechanical');
    expect(mech.tasks).toBe(1);
    expect(mech.realizedUsd).toBe(0);
    // agent-booster 500 in / 500 out on fable-5 = (500*10 + 500*50)/1e6 = 0.03
    expect(mech.frontierUsd).toBeCloseTo(0.03, 4);
    expect(mech.savedUsd).toBeCloseTo(0.03, 4);
  });

  it('frontier band is empty here (nothing routed to the top tier) — shown honestly as 0', () => {
    expect(bandRow(u, 'frontier').tasks).toBe(0);
  });

  it('totals: realized + saved reconcile, pctSaved is derived not hardcoded', () => {
    // realized = 0.00074 + 0.024 + 0 = 0.02474 ; frontier = 0.046 + 0.12 + 0.03 = 0.196
    expect(u.realizedUsd).toBeCloseTo(0.02474, 4);
    expect(u.frontierUsd).toBeCloseTo(0.196, 3);
    expect(u.costOptimalitySaved).toBeCloseTo(0.196 - 0.02474, 3);
    expect(u.pctSaved).toBe(Math.round(((0.196 - 0.02474) / 0.196) * 100));
  });

  it('bandOf classifies known models and price-buckets unknown ones (null when unpriced)', () => {
    expect(bandOf('agent-booster')).toBe('mechanical');
    expect(bandOf('claude-sonnet-5')).toBe('mid');
    expect(bandOf('claude-fable-5')).toBe('frontier');
    expect(bandOf('some/unknown-model')).toBeNull();
  });

  it('returns the empty shape (no throw) when the receipts file does not exist', () => {
    const empty = utilization({ receiptsFile: path.join(TMP, 'does-not-exist.jsonl') });
    expect(empty.tasks).toBe(0);
    expect(empty.pctSaved).toBeNull();
    expect(empty.distribution).toHaveLength(4);
  });

  describe('CLI surface (printUtil + mainUtil)', () => {
    it('printUtil renders the table (incl. the unpriced note + window line) without throwing', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      expect(() => printUtil(u)).not.toThrow(); // u has a window, an unpriced row, and $0/priced/"—" cost forms
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
    it('mainUtil --json prints the JSON shape (reads METAHARNESS_RECEIPTS)', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const argv = process.argv;
      process.argv = ['node', 'router-utilization.mjs', '--json'];
      try { mainUtil(); expect(spy).toHaveBeenCalled(); } finally { process.argv = argv; spy.mockRestore(); }
    });
    it('mainUtil without --json prints the human table', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const argv = process.argv;
      process.argv = ['node', 'router-utilization.mjs'];
      try { mainUtil(); expect(spy).toHaveBeenCalled(); } finally { process.argv = argv; spy.mockRestore(); }
    });
  });
});
