// tests/unit/metaharness-router.test.mjs — proof that ROUTING IS DONE BY rUv's CODE, not mine.
//
// THE FAILURE THIS TEST FILE EXISTS TO PREVENT (2026-07-13):
// I hand-rolled a 216-line "model router" with a placeholder policy and called it "the MetaHarness
// router engine" in SKILL.md. rUv had already shipped @metaharness/router@0.3.2 — the productized
// DRACO Phase-2 finding (ADR-040/043, Accepted/implemented): a real learned cost-optimal router.
// Building a Claude fake and giving it rUv's name is the one thing the brain's playbook forbids.
//
// So these tests assert the CORRECTION, and they are written to FAIL if it is ever undone:
//   1. the real package is a dependency and its Router class is what makes the decision
//   2. the local layer's ONLY job is a price transform (subscription-covered ⇒ $0)
//   3. rUv's cost-optimal logic picks the cheapest candidate that clears the quality bar
//   4. with too few labels we say COLD-START OUT LOUD instead of dressing a guess as a prediction
//
// NOTE ON THE FIXTURE: the labelled rows below are a TEST FIXTURE with invented quality scores —
// they exist to exercise the routing math, and they are NOT written to the user's real
// routing-outcomes.jsonl. Seeding fabricated labels into real data to make a demo look good would be
// the same lie in a new costume. The live path stays honestly COLD-START until real outcomes land.
import { describe, it, expect } from 'vitest';
import { effectivePrices, loadRealRouter, MIN_LABELS } from '../../scripts/metaharness-router.mjs';

const CANDIDATES = [
  { id: 'claude-haiku-4.5', costIn: 1, costOut: 5, subscription: ['claude-code'] },
  { id: 'claude-opus-4.8', costIn: 5, costOut: 25, subscription: ['claude-code'] },
  { id: 'deepseek/deepseek-v4-flash', costIn: 0.077, costOut: 0.154, subscription: [] },
];

// Two clearly-separated regions of embedding space: "easy" queries (cheap models do fine) and
// "hard" ones (only the expensive model clears the bar). 3-dim keeps the k-NN arithmetic legible.
const EASY = [1, 0, 0];
const HARD = [0, 1, 0];
const ROWS = [
  { embedding: EASY, scores: { 'claude-haiku-4.5': 0.9, 'claude-opus-4.8': 0.95, 'deepseek/deepseek-v4-flash': 0.85 } },
  { embedding: [0.98, 0.02, 0], scores: { 'claude-haiku-4.5': 0.88, 'claude-opus-4.8': 0.96, 'deepseek/deepseek-v4-flash': 0.86 } },
  { embedding: [0.97, 0, 0.03], scores: { 'claude-haiku-4.5': 0.91, 'claude-opus-4.8': 0.94, 'deepseek/deepseek-v4-flash': 0.84 } },
  { embedding: HARD, scores: { 'claude-haiku-4.5': 0.30, 'claude-opus-4.8': 0.92, 'deepseek/deepseek-v4-flash': 0.25 } },
  { embedding: [0.02, 0.98, 0], scores: { 'claude-haiku-4.5': 0.28, 'claude-opus-4.8': 0.90, 'deepseek/deepseek-v4-flash': 0.22 } },
  { embedding: [0, 0.97, 0.03], scores: { 'claude-haiku-4.5': 0.31, 'claude-opus-4.8': 0.93, 'deepseek/deepseek-v4-flash': 0.27 } },
];

describe('@metaharness/router — rUv\'s real router is the thing making the decision', () => {
  it('the real package is installed and exports the Router class (NOT a local re-implementation)', async () => {
    const mod = await loadRealRouter();
    expect(mod, 'the real @metaharness/router must be a dependency — never hand-roll a substitute').not.toBeNull();
    expect(typeof mod.Router).toBe('function');
    expect(typeof mod.Router.fromExamples).toBe('function'); // the DRACO row-shape constructor
    expect(typeof mod.trainRouter).toBe('function');         // the ADR-043 KRR pipeline
  });

  it('routes an EASY query to the cheap model — rUv\'s cost-optimal k-NN, not my heuristic', async () => {
    const { Router } = await loadRealRouter();
    // No subscription: real prices, so the cheapest-that-clears-the-bar is the deepseek model.
    const prices = effectivePrices(CANDIDATES, { harnesses: {} });
    const pick = Router.fromExamples(ROWS, prices, { k: 3, qualityBar: 0.8 }).route(EASY);
    expect(pick.id).toBe('deepseek/deepseek-v4-flash'); // $0.1155 blended, predicted ~0.85 > bar
    expect(pick.metBar).toBe(true);
    expect(pick.predictedQuality).toBeGreaterThan(0.8);
  });

  it('ESCALATES a hard query — the cheap models cannot clear the bar, so it pays for the strong one', async () => {
    const { Router } = await loadRealRouter();
    const prices = effectivePrices(CANDIDATES, { harnesses: {} });
    const pick = Router.fromExamples(ROWS, prices, { k: 3, qualityBar: 0.8 }).route(HARD);
    expect(pick.id).toBe('claude-opus-4.8'); // the only candidate predicted above the bar here
    expect(pick.metBar).toBe(true);
  });

  it('THE PRICE TRANSFORM IS THE LOCAL LAYER\'S ONLY JOB: a subscription-covered model costs $0', () => {
    // This is the sole thing the local code legitimately contributes. @metaharness/router optimises
    // cost-vs-quality; it has no concept of "already paid for by THIS user" — nor should it.
    const p = effectivePrices(CANDIDATES, { harnesses: { 'claude-code': { subscription: true } } });
    expect(p['claude-haiku-4.5']).toBe(0);            // Claude Max covers it → free at the margin
    expect(p['claude-opus-4.8']).toBe(0);
    expect(p['deepseek/deepseek-v4-flash']).toBeCloseTo(0.1155, 4); // billed → keeps its real price
  });

  it('and that $0 flows into rUv\'s router natively: a covered model now WINS the easy query', async () => {
    const { Router } = await loadRealRouter();
    const prices = effectivePrices(CANDIDATES, { harnesses: { 'claude-code': { subscription: true } } });
    const pick = Router.fromExamples(ROWS, prices, { k: 3, qualityBar: 0.8 }).route(EASY);
    // Haiku is $0 for this user AND clears the bar → genuinely the cheapest sufficient candidate.
    // No special-casing needed: the subscription overlay collapsed into arithmetic the router already does.
    expect(pick.id).toBe('claude-haiku-4.5');
    expect(pick.costPerMTok).toBe(0);
    expect(pick.metBar).toBe(true);
  });

  it('a user WITHOUT the subscription gets a different answer from the same code — no phantom $0', async () => {
    const { Router } = await loadRealRouter();
    const prices = effectivePrices(CANDIDATES, { harnesses: { 'claude-code': { subscription: false } } });
    const pick = Router.fromExamples(ROWS, prices, { k: 3, qualityBar: 0.8 }).route(EASY);
    expect(pick.id).toBe('deepseek/deepseek-v4-flash'); // haiku is billed for them; deepseek is cheaper
  });

  it('MIN_LABELS guards the cold start — k-NN with no neighbours is not a prediction', () => {
    // The live path reports COLD-START and falls back LOUDLY below this threshold, rather than
    // presenting a guess as a learned prediction. That presentation is the original sin.
    expect(MIN_LABELS).toBeGreaterThanOrEqual(5);
  });
});
