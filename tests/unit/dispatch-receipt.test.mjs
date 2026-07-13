// tests/unit/dispatch-receipt.test.mjs — the subagent-routing receipt.
//
// Context (2026-07-13): the router's receipts log held 3 entries, all test pings, $0.018 saved — and
// Stuart's read ("the meta harness isn't doing anything for me") was correct on BOTH counts: real
// work wasn't being routed, AND the biggest lever wrote no receipt even when it was. A Claude Code
// subagent inherits the main-loop model unless overridden, so overriding it to haiku is the largest
// available saving — and nothing logged it. These tests pin the accounting so the scoreboard can't
// quietly lie: the baseline is the INHERITED model, and an unpriced model produces NO receipt at all
// rather than an invented number.
import { describe, it, expect } from 'vitest';
import { buildReceipt, parseArgs, sizeTokens } from '../../scripts/dispatch-receipt.mjs';
import { estimateCosts, priceOf, CLAUDE_TIERS, FRONTIER } from '../../scripts/route-cheap.mjs';

const NOW = '2026-07-13T00:00:00.000Z';

describe('priceOf — one lookup across both pricing tables', () => {
  it('prices OpenRouter models and Claude tiers, and refuses unknowns', () => {
    expect(priceOf('deepseek/deepseek-v4-flash')).toEqual({ in: 0.077, out: 0.154 });
    expect(priceOf('claude-haiku-4.5')).toEqual({ in: 1.0, out: 5.0 });
    expect(priceOf('gpt-9-imaginary')).toBeNull(); // unknown → null, never a guessed price
  });

  it('carries the spread that is the whole argument: fable is 10x haiku', () => {
    // Live-verified from the OpenRouter /models API 2026-07-13. If Anthropic repriced, this test
    // failing is the POINT — the savings math must never run on stale numbers.
    expect(CLAUDE_TIERS['claude-fable-5'].out / CLAUDE_TIERS['claude-haiku-4.5'].out).toBe(10);
    expect(CLAUDE_TIERS['claude-fable-5'].out).toBeGreaterThan(CLAUDE_TIERS['claude-opus-4.8'].out);
  });
});

describe('estimateCosts — the baseline is a parameter, because the honest one varies', () => {
  it('defaults to the frontier reference (route-cheap behavior is unchanged)', () => {
    const c = estimateCosts('deepseek/deepseek-v4-flash', 1000, 1000);
    expect(c.ref).toBe(FRONTIER.name);
    expect(c.frontier).toBeGreaterThan(c.cost);
  });

  it('prices a subagent against the model it WOULD have inherited', () => {
    // 1000 in + 1000 out on haiku vs a fable session: (1+5)/1e3 vs (10+50)/1e3.
    const c = estimateCosts('claude-haiku-4.5', 1000, 1000, 'claude-fable-5');
    expect(c.cost).toBeCloseTo(0.006, 6);
    expect(c.frontier).toBeCloseTo(0.06, 6);
    expect(c.saved).toBeCloseTo(0.054, 6); // 90% of the spend, which is the entire pitch
  });

  it('an unknown baseline yields NO estimate rather than a fabricated one', () => {
    expect(estimateCosts('claude-haiku-4.5', 10, 10, 'claude-unreleased-7')).toBeNull();
  });
});

describe('sizeTokens — measured beats estimated, and the assumption is always named', () => {
  it('prefers the harness-reported total and NAMES the split it assumed', () => {
    const s = sizeTokens({ totalTokens: '74713' });
    expect(s.inTok).toBe(67242); // 90% — a subagent re-reads files every turn; input dominates
    expect(s.outTok).toBe(7471);
    expect(s.source).toMatch(/measured total 74713 tok/);
    expect(s.source).toMatch(/assumed 90\/10 in\/out split/); // the assumption is IN the receipt, not hidden
  });

  it('honors an explicit --split instead of silently keeping the default', () => {
    const s = sizeTokens({ totalTokens: '1000', split: '0.5' });
    expect(s.inTok).toBe(500);
    expect(s.outTok).toBe(500);
    expect(s.source).toMatch(/assumed 50\/50/);
  });

  it('falls back to chars/4 when no total was reported, and flags a prompt-only size as an undercount', () => {
    expect(sizeTokens({ inChars: '400', outChars: '800' })).toMatchObject({ inTok: 100, outTok: 200, source: 'chars/4 est' });
    // Sizing a file-reading agent from its prompt alone understates by ~20x — the receipt says so out loud
    // rather than quietly reporting a saving of nearly nothing and making routing look pointless.
    expect(sizeTokens({ task: 'x'.repeat(400) }).source).toMatch(/likely an undercount/);
  });
});

describe('buildReceipt — the row that lands in the scoreboard', () => {
  it('records the inherited model as the baseline and marks the subagent channel', () => {
    const r = buildReceipt(
      { model: 'claude-haiku-4.5', inherited: 'claude-fable-5', task: 'sweep tests', class: 'mechanical', inChars: '4000', outChars: '4000' },
      NOW,
    );
    expect(r.source).toBe('claude-subagent'); // distinguishable from route-cheap's OpenRouter rows
    expect(r.inherited).toBe('claude-fable-5');
    expect(r.frontier_ref).toBe('claude-fable-5'); // NOT a generic "frontier" — the real counterfactual
    expect(r.est_in_tokens).toBe(1000); // chars/4
    expect(r.saved).toBeGreaterThan(0);
    expect(r.token_source).toBe('chars/4 est'); // never presented as measured
  });

  it('refuses to build a receipt for an unpriced model — no invented savings, ever', () => {
    expect(buildReceipt({ model: 'some-new-model', inherited: 'claude-opus-4.8' }, NOW)).toBeNull();
    expect(buildReceipt({ model: 'claude-haiku-4.5', inherited: 'some-new-model' }, NOW)).toBeNull();
  });

  it('falls back to the task text for sizing when char counts are not supplied', () => {
    const r = buildReceipt({ model: 'claude-haiku-4.5', inherited: 'claude-opus-4.8', task: 'x'.repeat(400) }, NOW);
    expect(r.est_in_tokens).toBe(100);
    expect(r.est_out_tokens).toBe(0); // no output size claimed if none was measured
  });

  it('truncates the task label — a receipt is a ledger line, not a transcript', () => {
    const r = buildReceipt({ model: 'claude-haiku-4.5', inherited: 'claude-opus-4.8', task: 'y'.repeat(500) }, NOW);
    expect(r.task.length).toBe(200);
  });
});

describe('parseArgs — kebab flags reach the camelCase fields they set', () => {
  it('maps --in-chars/--out-chars and defaults the baseline conservatively', () => {
    const a = parseArgs(['--model', 'claude-sonnet-5', '--in-chars', '120', '--out-chars', '640']);
    expect(a.model).toBe('claude-sonnet-5');
    expect(a.inChars).toBe('120');
    expect(a.outChars).toBe('640');
    // default baseline is opus, not fable: understate the saving when the session model is unknown
    expect(a.inherited).toBe('claude-opus-4.8');
  });
});
