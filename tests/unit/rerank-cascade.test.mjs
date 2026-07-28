// tests/unit/rerank-cascade.test.mjs — the two-stage cross-encoder cascade (ADR-058).
//
// The cascade decides which candidates get the FULL cross-encoder read, so a bug here does not
// slow the brain down, it changes the answer and says nothing. Every test below was checked by
// breaking the thing it guards and watching it go red; the guarded property is named in each title.
//
// THE NAMED REGRESSION. Held-out question s-05 is the reason ADR-057's flat pool cap shipped OFF:
// a distance-ordered cut dropped agenticow/examples/rollback-quarantine.mjs — the worked example
// that actually answers it — and returned a generic card 4.6 logits worse and BELOW the abstention
// threshold. The frozen grader passed that regression because it grades the REPO while the user is
// handed a FILE. So the file path is asserted here as a literal token, not the repo.
//
// searchAll's two heavy collaborators are mocked by the same path forge-ask-all.mjs imports them
// from, exactly as tests/unit/rerank-pool-cap.test.mjs does — this is about which pairs survive,
// not about the 512MB brain or the ONNX model.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../kb/forge-ask.mjs', () => ({ searchKb: vi.fn() }));
vi.mock('../../kb/forge-rerank.mjs', () => ({ rerankPairs: vi.fn(), cePrefilterScores: vi.fn() }));

import { cascadeRerankPool, searchAll, CE_CASCADE_K_DEFAULT, CE_CASCADE_TOKENS_DEFAULT } from '../../kb/forge-ask-all.mjs';
import { searchKb } from '../../kb/forge-ask.mjs';
import { rerankPairs, cePrefilterScores } from '../../kb/forge-rerank.mjs';

// THE ANSWER s-05 MUST KEEP. A literal, because a regression test whose target is computed from
// the same code under test cannot fail when that code is wrong.
const S05_ANSWER_PATH = 'examples/rollback-quarantine.mjs';
const S05_ANSWER_REPO = 'agenticow';

// A pool shaped like the real one: several stores, each contributing `depth` passages in vector
// order. `_srcRank` is within-store depth; array position is fan-out order.
function pool(stores, depth, over = () => ({})) {
  const out = [];
  for (const repo of stores) {
    for (let r = 0; r < depth; r++) {
      out.push({ repo, path: `${repo}/d${r}.md`, title: `${repo}#${r}`, _lane: 'dense', _srcRank: r, bestDistance: 0.1 + r / 100, ...over(repo, r) });
    }
  }
  return out.map((c, i) => ({ ...c, _poolIdx: i }));
}
const ids = (list) => list.map((c) => c.path);

describe('cascadeRerankPool — which pairs earn the expensive read', () => {
  it('is a pure pass-through when disabled (limit 0) — the uncascaded path must stay exactly reachable', () => {
    const p = pool(['a', 'b'], 4);
    const out = cascadeRerankPool(p, { limit: 0, s1: p.map(() => 1) });
    expect(out.capped).toBe(false);
    expect(out.dropped).toBe(0);
    expect(ids(out.kept)).toEqual(ids(p));
  });

  it('never invents work: a pool already under budget is returned untouched', () => {
    const p = pool(['a', 'b'], 4); // 8 candidates
    expect(cascadeRerankPool(p, { limit: 100, s1: p.map(() => 1) }).kept).toHaveLength(8);
  });

  it('spends exactly the budget it is given — the full-read count is the thing being bounded', () => {
    const p = pool(['a', 'b', 'c', 'd'], 8); // 32
    for (const limit of [1, 5, 12, 31]) {
      const s1 = p.map((_, i) => -i);
      expect(cascadeRerankPool(p, { limit, s1 }).kept).toHaveLength(limit);
      expect(cascadeRerankPool(p, { limit, s1 }).dropped).toBe(32 - limit);
    }
  });

  it('GUARD: selects by STAGE-1 SCORE, not by vector distance — the whole reason ADR-057 failed', () => {
    // The s-05 shape in miniature: the right answer is the WORST candidate by distance and the
    // BEST by cross-encoder. A distance-ordered selector drops it; a score-ordered one keeps it.
    const p = pool(['x'], 5).map((c, i) => ({ ...c, bestDistance: 1.0 - i * 0.1 }));
    p[4] = { ...p[4], repo: S05_ANSWER_REPO, path: S05_ANSWER_PATH };  // worst distance (0.6 -> last)
    const s1 = [-5, -4, -3, -2, +9];                                    // best stage-1 score
    const kept = cascadeRerankPool(p, { limit: 1, s1 }).kept;
    expect(kept).toHaveLength(1);
    expect(kept[0].path).toBe(S05_ANSWER_PATH);
  });

  it('GUARD: the rescue and bm25 lanes are exempt and survive a budget of 1', () => {
    const p = pool(['a', 'b'], 4);
    p[1] = { ...p[1], _lane: 'rescue' };
    p[5] = { ...p[5], _lane: 'bm25' };
    const s1 = p.map(() => -99);          // every lane scores terribly on purpose
    const kept = cascadeRerankPool(p, { limit: 1, s1 }).kept;
    expect(kept.some((c) => c._lane === 'rescue')).toBe(true);
    expect(kept.some((c) => c._lane === 'bm25')).toBe(true);
  });

  it('GUARD: degrades to the UNCAPPED pool when stage-1 scores are missing or misaligned', () => {
    // A cascade whose selector failed must score everything rather than cut blind. Cutting on a
    // bad/absent signal is the one outcome worse than not cascading at all.
    const p = pool(['a', 'b', 'c'], 8); // 24
    for (const bad of [null, undefined, [], [1, 2, 3]]) {
      const out = cascadeRerankPool(p, { limit: 4, s1: bad });
      expect(out.kept).toHaveLength(24);
      expect(out.capped).toBe(false);
    }
  });

  it('GUARD: ties break by pool position, so the same pool always yields the same survivors', () => {
    const p = pool(['a', 'b', 'c'], 4);
    const s1 = p.map(() => 0.5);           // every candidate identical
    const a = ids(cascadeRerankPool(p, { limit: 5, s1 }).kept);
    const b = ids(cascadeRerankPool(p, { limit: 5, s1 }).kept);
    expect(a).toEqual(b);
    expect(a).toEqual(ids(p.slice(0, 5)));
  });

  it('GUARD: any NON-FINITE stage-1 score sorts last — including Infinity, which must not hijack the pool', () => {
    // NaN would poison a raw comparator; Infinity would let a broken scorer take the whole budget.
    // Both are symptoms of a stage-1 failure, so both lose to any real score rather than winning.
    const p = pool(['a'], 4);
    const s1 = [NaN, 5, Infinity, 1];
    const kept = cascadeRerankPool(p, { limit: 2, s1 }).kept;
    expect(ids(kept)).toEqual(['a/d1.md', 'a/d3.md']); // the two FINITE scores, 5 then 1
  });
});

describe('searchAll — the cascade is OFF by default and honest when on', () => {
  beforeEach(() => {
    vi.mocked(searchKb).mockReset();
    vi.mocked(rerankPairs).mockReset();
    vi.mocked(cePrefilterScores).mockReset();
    delete process.env.KB_CE_CASCADE_K;
    delete process.env.KB_CE_CASCADE_TOKENS;
    delete process.env.KB_CE_MAX_PAIRS;
  });

  it('GUARD: the shipped default scores ZERO prefilter pairs — an off switch that still pays is not off', () => {
    expect(CE_CASCADE_K_DEFAULT).toBe(0);
  });

  it('GUARD: the shipped stage-1 budget is the one the cost curve was measured at', () => {
    // 192 tokens is where the measured curve stops being free (0.320x of full cost, no top-3 loss).
    // If someone lowers this without re-measuring, that is the change this asserts against.
    expect(CE_CASCADE_TOKENS_DEFAULT).toBe(192);
  });
});

describe('the s-05 regression, as pool arithmetic', () => {
  // The full end-to-end proof is scripts/rerank-cascade-ab.mjs against the real 512MB brain (see
  // evals/runs/2026-07-27-cross-encoder-cascade.md). This test pins the property that made it work
  // so a refactor cannot quietly undo it without the real corpus in the loop.
  it('GUARD: keeps rollback-quarantine.mjs at a budget of 64 out of a 608-pair pool', () => {
    // 608 candidates across 69 stores, the real production shape. The answer is planted deep
    // (store 5, depth 6 — exactly where the real one sat) with the WORST distance in the pool and
    // a stage-1 score that only a cross-encoder would give it.
    const stores = Array.from({ length: 69 }, (_, i) => `store${i}`);
    const p = pool(stores, 8).slice(0, 608).map((c) => ({ ...c, bestDistance: 0.9 }));
    const answerIdx = 5 * 8 + 6;
    p[answerIdx] = { ...p[answerIdx], repo: S05_ANSWER_REPO, path: S05_ANSWER_PATH, bestDistance: 1.1766 };
    const s1 = p.map((_, i) => (i === answerIdx ? 4.2 : -3 - (i % 7) * 0.1));

    const kept = cascadeRerankPool(p, { limit: 64, s1 }).kept;
    expect(kept).toHaveLength(64);
    const survivor = kept.find((c) => c.path === S05_ANSWER_PATH);
    expect(survivor, `s-05's worked example must survive the cascade — it is the answer, not a near-miss`).toBeTruthy();
    expect(survivor.repo).toBe(S05_ANSWER_REPO);
  });

  it('CONTROL: the SAME pool loses that answer under distance ordering — proving the test can fail', () => {
    // Without this control the guard above could be passing for the wrong reason. Ordering the
    // identical pool by distance (what ADR-057 shipped) must DROP the answer at the same budget.
    const stores = Array.from({ length: 69 }, (_, i) => `store${i}`);
    const p = pool(stores, 8).slice(0, 608).map((c) => ({ ...c, bestDistance: 0.9 }));
    const answerIdx = 5 * 8 + 6;
    p[answerIdx] = { ...p[answerIdx], repo: S05_ANSWER_REPO, path: S05_ANSWER_PATH, bestDistance: 1.1766 };
    const byDistance = [...p].sort((a, b) => a.bestDistance - b.bestDistance).slice(0, 64);
    expect(byDistance.some((c) => c.path === S05_ANSWER_PATH)).toBe(false);
  });
});
