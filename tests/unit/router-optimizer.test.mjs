// tests/unit/router-optimizer.test.mjs — locks the near-term slice of ADR-0015.
//
// router-optimizer.mjs computes the two routing PROFILES the console shows (development &
// production). It is pure/deterministic: it reads price tables + the user's receipts file and
// never makes a network or model call. This test pins the exact picks a user sees on the console
// so a future edit can't silently change what we recommend, and exercises BOTH branches
// (OpenRouter key present → measured cross-provider picks; absent → subscription-only picks).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// RECEIPTS is captured at module load, so the temp path must be in the env BEFORE the import.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'router-opt-'));
const RECEIPTS = path.join(TMP, 'routing-receipts.jsonl');
fs.writeFileSync(
  RECEIPTS,
  [
    JSON.stringify({ model: 'openai/gpt-4.1', quality_pass: true }),
    JSON.stringify({ model: 'openai/gpt-4.1', quality_pass: false }),
    JSON.stringify({ model: 'inclusionai/ling-2.6-flash', quality_pass: true }),
    '', // blank line — must be ignored
    'not-json-at-all', // malformed — must be skipped, not throw
    JSON.stringify({ quality_pass: true }), // no model — must be ignored
  ].join('\n') + '\n'
);
process.env.METAHARNESS_RECEIPTS = RECEIPTS;
process.env.ROUTER_PROFILES = path.join(TMP, 'profiles.json');

let optimize, printSummary, main;
beforeAll(async () => {
  ({ optimize, printSummary, main } = await import('../../scripts/router-optimizer.mjs'));
});

const bandOf = (profile, name) => profile.bands.find((b) => b.band === name);

describe('router-optimizer — the two profiles the console renders', () => {
  it('parses receipts robustly (blank/malformed/no-model lines are ignored, valid ones counted)', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
    const o = optimize({});
    // 3 lines carry a model; the blank, malformed, and no-model lines must not count.
    expect(o.receiptsSeen).toBe(3);
    expect(o.measuredAt).toBe('2026-06-15');
    expect(Object.keys(o.profiles)).toEqual(['development', 'production']);
  });

  it('falls back to config/.env when OPENROUTER_API_KEY is not in the env (exercises the reads)', () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      // With no env var, hasOpenRouterKey() must attempt the config.json then .env reads. The result
      // depends on the machine, so we assert only that the shape is intact — the point is executing
      // (and thus covering) both fallback branches without a network or model call.
      const o = optimize({});
      expect(typeof o.hasOpenRouterKey).toBe('boolean');
      expect(o.profiles.production.bands).toHaveLength(4);
    } finally {
      if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
    }
  });

  describe('with an OpenRouter key (measured cross-provider picks)', () => {
    let o;
    beforeAll(() => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
      o = optimize({});
    });

    it('reports the key as present', () => {
      expect(o.hasOpenRouterKey).toBe(true);
    });

    it('every profile has exactly the four discovered bands in order', () => {
      for (const p of Object.values(o.profiles)) {
        expect(p.bands.map((b) => b.band)).toEqual(['mechanical', 'cheap', 'mid', 'frontier']);
      }
    });

    it('mechanical band is the $0 no-LLM tier in both profiles', () => {
      for (const p of Object.values(o.profiles)) {
        const m = bandOf(p, 'mechanical');
        expect(m.model).toBe('agent-booster');
        expect(m.costPerMTok).toBe(0);
        expect(m.effort).toBe('none');
        expect(m.effortSource).toBe('n/a');
      }
    });

    it('cheap band is Ling-2.6-flash at $0.02/Mtok, effort low (a default)', () => {
      const c = bandOf(o.profiles.production, 'cheap');
      expect(c.model).toBe('inclusionai/ling-2.6-flash');
      expect(c.costPerMTok).toBe(0.02);
      expect(c.effort).toBe('low');
      expect(c.effortSource).toBe('default');
    });

    it('DEV mid favors the $/quality value pick (Llama-3.3-70b, price unknown → null)', () => {
      const mid = bandOf(o.profiles.development, 'mid');
      expect(mid.model).toBe('meta-llama/llama-3.3-70b-instruct');
      expect(mid.costPerMTok).toBeNull(); // not in the bench → rendered "—", never invented
    });

    it('PROD mid favors the higher-quality pick (GPT-4.1 at $5/Mtok)', () => {
      const mid = bandOf(o.profiles.production, 'mid');
      expect(mid.model).toBe('openai/gpt-4.1');
      expect(mid.costPerMTok).toBe(5);
    });

    it('frontier is Fable 5 (leads the Claude 5 family), and production spends more reasoning effort than dev', () => {
      expect(bandOf(o.profiles.development, 'frontier').model).toBe('claude-fable-5');
      expect(bandOf(o.profiles.development, 'frontier').effort).toBe('high');
      expect(bandOf(o.profiles.production, 'frontier').effort).toBe('xhigh');
    });

    it('the objectives differ (dev = throughput on subscription; prod = $/quality metered)', () => {
      expect(o.profiles.development.objective).toMatch(/subscription/i);
      expect(o.profiles.production.objective).toMatch(/metered/i);
    });
  });

  describe('without an OpenRouter key (subscription-only, honest about reach)', () => {
    let o;
    beforeAll(() => {
      o = optimize({ noOpenRouter: true });
    });

    it('reports no key and recommends only Claude tiers the subscription can reach', () => {
      expect(o.hasOpenRouterKey).toBe(false);
      expect(bandOf(o.profiles.production, 'cheap').model).toBe('claude-haiku-4.5');
      expect(bandOf(o.profiles.production, 'mid').model).toBe('claude-sonnet-5');
      expect(bandOf(o.profiles.development, 'frontier').model).toBe('claude-fable-5');
    });

    it('still exposes the four bands and the mechanical $0 tier', () => {
      expect(o.profiles.development.bands.map((b) => b.band)).toEqual(['mechanical', 'cheap', 'mid', 'frontier']);
      expect(bandOf(o.profiles.development, 'mechanical').costPerMTok).toBe(0);
    });
  });

  describe('CLI surface (printSummary + main)', () => {
    it('printSummary renders every cost form ($0, a price, and unknown "—") without throwing', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      // the dev profile has mechanical ($0), ling ($0.02), llama (null → "—") — hits all money branches
      expect(() => printSummary(optimize({}))).not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('main() writes both profiles to ROUTER_PROFILES', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const argv = process.argv;
      process.argv = ['node', 'router-optimizer.mjs', '--no-openrouter', '--print'];
      try { main(); } finally { process.argv = argv; spy.mockRestore(); }
      const written = JSON.parse(fs.readFileSync(process.env.ROUTER_PROFILES, 'utf8'));
      expect(Object.keys(written.profiles)).toEqual(['development', 'production']);
      expect(written.hasOpenRouterKey).toBe(false);
    });
  });
});
