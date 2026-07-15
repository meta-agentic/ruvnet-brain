// tests/unit/metaharness-receipts.test.mjs — the MetaHarness routing-visibility surface
// (scripts/metaharness-receipts.mjs table + scripts/route-cheap.mjs cost math). Both modules are
// import-side-effect-free (main() is guarded by pathToFileURL check), so these are real unit tests
// against a fixture JSONL — no network, no OpenRouter key, no agentic-flow spawn.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadReceipts, formatTable, receiptsPath } from '../../scripts/metaharness-receipts.mjs';
import { estimateCosts, estTokens, receiptLine, PRICING, FRONTIER } from '../../scripts/route-cheap.mjs';

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-receipts-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); delete process.env.METAHARNESS_RECEIPTS; });

const RECEIPT = {
  ts: '2026-07-10T12:00:00.000Z',
  task_class: 'research',
  task: 'summarize the release notes',
  model: 'deepseek/deepseek-chat',
  est_in_tokens: 100,
  est_out_tokens: 400,
  est_cost: 0.00034,
  est_frontier_cost: 0.0105,
  saved: 0.010160,
  frontier_ref: 'claude-opus-4.8',
};

describe('loadReceipts (fixture JSONL)', () => {
  it('parses valid receipt lines and skips corrupt ones without inventing data', () => {
    const file = path.join(tmp, 'receipts.jsonl');
    fs.writeFileSync(file, [
      JSON.stringify(RECEIPT),
      'not json at all {{{',
      JSON.stringify({ model: 'x' }), // no numeric `saved` → not a receipt
      JSON.stringify({ ...RECEIPT, task_class: 'classify', saved: 0.002 }),
      '',
    ].join('\n'));
    const { rows, skipped } = loadReceipts(file);
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(2);
    expect(rows[0].model).toBe('deepseek/deepseek-chat');
  });

  it('returns empty (not a throw, not fake rows) when the log does not exist', () => {
    const { rows, skipped } = loadReceipts(path.join(tmp, 'nope.jsonl'));
    expect(rows).toEqual([]);
    expect(skipped).toBe(0);
  });
});

describe('formatTable', () => {
  it('renders the plain-language columns Stuart asked for, plus honest totals', () => {
    const out = formatTable([RECEIPT, { ...RECEIPT, task_class: 'classify' }]);
    // 'est. baseline' (was 'est. frontier cost') since 2026-07-13: subagent rows carry a PER-ROW
    // baseline — the model that agent would have inherited — so a global "frontier" column would lie.
    for (const col of ['date', 'channel', 'task class', 'model used', 'instead of', 'est. cost', 'est. baseline', 'saved']) {
      expect(out).toContain(col);
    }
    expect(out).toContain('2026-07-10 12:00');
    expect(out).toContain('deepseek/deepseek-chat');
    expect(out).toContain('2 routed task(s)');
    expect(out).toContain('claude-opus-4.8');       // baseline named, not implied
    // provenance is stated, and stated ACCURATELY: rows may be measured or estimated, so the footer
    // must not blanket-claim either one (it used to say "all figures are estimates" even for measured rows)
    expect(out).toContain('token_source');
    expect(out).toContain('Pricing is live-verified');
  });

  it('names EVERY baseline when they differ, instead of picking the first row and implying it covers all', () => {
    const out = formatTable([
      RECEIPT, // openrouter row, baseline claude-opus-4.8
      { ...RECEIPT, source: 'claude-subagent', model: 'claude-haiku-4.5', frontier_ref: 'claude-fable-5', task_class: 'mechanical' },
    ]);
    expect(out).toContain('subagent');   // the channel is visible, not collapsed into the openrouter rows
    expect(out).toContain('openrouter');
    expect(out).toContain('1 subagent, 1 openrouter');
    expect(out).toContain('claude-fable-5');  // both baselines named…
    expect(out).toContain('claude-opus-4.8'); // …not just whichever row happened to be first
  });

  it('says plainly there is no data instead of showing a zero/fake table', () => {
    const out = formatTable([]);
    expect(out).toContain('No routing receipts yet');
    expect(out).not.toContain('$0.0000'); // no invented numbers
  });
});

describe('receiptsPath', () => {
  it('honors the METAHARNESS_RECEIPTS override (test/statusline hook point)', () => {
    process.env.METAHARNESS_RECEIPTS = '/tmp/custom.jsonl';
    expect(receiptsPath()).toBe('/tmp/custom.jsonl');
  });
  it('defaults to the machine-wide ~/.claude/metaharness log', () => {
    expect(receiptsPath()).toBe(path.join(os.homedir(), '.claude', 'metaharness', 'routing-receipts.jsonl'));
  });
});

describe('route-cheap cost math (verified OpenRouter pricing, 2026-07-07)', () => {
  it('computes est cost vs fable-5 frontier from the SKILL.md-verified table', () => {
    // deepseek: $0.20 in / $0.80 out per Mtok; frontier fable-5: $10 / $50
    const c = estimateCosts('deepseek/deepseek-chat', 1_000_000, 1_000_000);
    expect(c.cost).toBeCloseTo(1.0, 10);       // 0.20 + 0.80
    expect(c.frontier).toBeCloseTo(60.0, 10);  // 10 + 50
    expect(c.saved).toBeCloseTo(59.0, 10);
  });

  it('refuses to price an unknown model (no invented savings)', () => {
    expect(estimateCosts('made-up/model', 100, 100)).toBeNull();
  });

  it('estTokens is the honest chars/4 estimate with a floor of 1', () => {
    expect(estTokens('abcdefgh')).toBe(2);
    expect(estTokens('')).toBe(1);
  });

  it('receiptLine matches the in-flow spec: model + est vs frontier + saved', () => {
    const line = receiptLine('z-ai/glm-4.6', { cost: 0.0004, frontier: 0.012, saved: 0.0116 });
    expect(line).toContain('⚡ MetaHarness: routed to z-ai/glm-4.6');
    expect(line).toMatch(/est\. \$0\.0004\d* vs \$0\.0120\d* frontier/);
    expect(line).toContain('saved ~$');
  });

  it('pricing table stays in sync with the models route-cheap accepts', () => {
    expect(Object.keys(PRICING)).toContain('deepseek/deepseek-chat');
    expect(FRONTIER.name).toBe('claude-fable-5');
  });
});
