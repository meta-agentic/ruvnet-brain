// tests/unit/rerank-pool-cap.test.mjs — the cross-encoder pool cap decides which candidates are
// allowed to be scored AT ALL, so a bug here does not slow the brain down, it changes the answer
// and says nothing. Every test below was checked by breaking the thing it guards and watching it
// go red; the guarded property is named in each test title.
//
// searchAll's two heavy collaborators are mocked by the same path forge-ask-all.mjs imports them
// from, exactly as tests/unit/forge-ask-all.test.mjs does — this is about pool arithmetic, not
// about the 512MB brain or the ONNX model.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../kb/forge-ask.mjs', () => ({ searchKb: vi.fn() }));
vi.mock('../../kb/forge-rerank.mjs', () => ({ rerankPairs: vi.fn() }));

import { capRerankPool, selectResults, scopedNamesIn, searchAll } from '../../kb/forge-ask-all.mjs';
import { searchKb } from '../../kb/forge-ask.mjs';
import { rerankPairs } from '../../kb/forge-rerank.mjs';

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

describe('capRerankPool — what is allowed to reach the cross-encoder', () => {
  it('is a pure pass-through when disabled (limit 0) — the uncapped path must stay exactly reachable', () => {
    const p = pool(['a', 'b'], 4);
    const out = capRerankPool(p, { limit: 0 });
    expect(out.capped).toBe(false);
    expect(out.dropped).toBe(0);
    expect(ids(out.kept)).toEqual(ids(p));
  });

  it('never invents work: a pool already under budget is returned untouched', () => {
    const p = pool(['a', 'b'], 4); // 8 candidates
    expect(capRerankPool(p, { limit: 100 }).kept).toHaveLength(8);
    expect(capRerankPool(p, { limit: 100 }).capped).toBe(false);
  });

  it('spends exactly the budget it is given — the pair count is the thing being bounded', () => {
    const p = pool(['a', 'b', 'c', 'd'], 8); // 32
    for (const limit of [1, 5, 12, 31]) {
      expect(capRerankPool(p, { limit }).kept).toHaveLength(limit);
      expect(capRerankPool(p, { limit }).dropped).toBe(32 - limit);
    }
  });

  it('GUARD: every store keeps its best passage once the budget covers the store count', () => {
    const stores = ['a', 'b', 'c', 'd', 'e', 'f'];
    const p = pool(stores, 8); // 48 candidates, 6 stores
    const kept = capRerankPool(p, { limit: 6 }).kept;
    // Breaking this: sort the cap by pool position instead of depth, and store 'a' alone eats the
    // whole budget while five stores are never scored at all.
    expect([...new Set(kept.map((c) => c.repo))].sort()).toEqual(stores);
    expect(kept.every((c) => c._srcRank === 0)).toBe(true);
  });

  it('GUARD: spends the budget ABOVE the floor by vector distance, not by depth', () => {
    // 'near' holds the four closest passages in the pool; 'far' holds eight distant ones. Once both
    // stores have their floor passage, every remaining pair must go to 'near' — that is the whole
    // measured difference between this policy and the depth-dealing one it replaced (top-1
    // agreement at B=272: 85.8% distance vs 77.5% depth, on the frozen 120).
    // Breaking this: sort the fill by _srcRank and 'far' takes half the budget it never earned.
    const p = [
      ...pool(['near'], 8, (_r, i) => ({ bestDistance: 0.10 + i * 0.01 })),  // 0.10 .. 0.17
      ...pool(['far'], 8, (_r, i) => ({ bestDistance: 0.90 + i * 0.01 })),   // 0.90 .. 0.97
    ].map((c, i) => ({ ...c, _poolIdx: i }));
    const kept = capRerankPool(p, { limit: 6 }).kept;
    expect(kept.filter((c) => c.repo === 'near')).toHaveLength(5);
    expect(kept.filter((c) => c.repo === 'far').map((c) => c._srcRank)).toEqual([0]); // its floor, nothing more
  });

  it('GUARD: the floor is skipped rather than overspent when the budget is smaller than the store count', () => {
    // A cap that quietly spends more than it was given is not a cap. Six stores, budget of three:
    // the floor cannot fit, so selection falls through to pure distance and the budget still holds.
    const p = pool(['a', 'b', 'c', 'd', 'e', 'f'], 4, (repo) => ({ bestDistance: repo === 'a' ? 0.1 : 0.9 }));
    const out = capRerankPool(p, { limit: 3 });
    expect(out.kept).toHaveLength(3);
    expect(out.kept.every((c) => c.repo === 'a')).toBe(true);
  });

  it('GUARD: the RESCUE lane is exempt, even when it alone exceeds the budget', () => {
    // #33 Part A exists because a boost cannot rescue what was never a candidate. Dropping a
    // rescued hit here would rebuild that bug one layer down, invisibly.
    const p = [
      ...pool(['big'], 8),
      { repo: 'big', path: 'big/EXACT.json', title: '@scope/pkg', _lane: 'rescue', _srcRank: 0, _poolIdx: 8 },
      { repo: 'big', path: 'big/EXACT2.json', title: '@scope/pkg2', _lane: 'rescue', _srcRank: 1, _poolIdx: 9 },
    ];
    const kept = capRerankPool(p, { limit: 1 });
    expect(ids(kept.kept)).toEqual(expect.arrayContaining(['big/EXACT.json', 'big/EXACT2.json']));
    expect(kept.kept.filter((c) => c._lane === 'rescue')).toHaveLength(2);
  });

  it('GUARD: the BM25 lane is dealt alongside dense, not after it', () => {
    // A transcript store's answer is BM25-only — dense buries it past rank 40. If the cap treated
    // bm25 as "the tail", the lexical candidates would be the first thing cut on every query.
    const p = [
      ...pool(['repoA', 'repoB'], 8),
      { repo: 'meetings', path: 'meetings/bm0.txt', _lane: 'bm25', _srcRank: 0, _poolIdx: 16 },
      { repo: 'meetings', path: 'meetings/bm1.txt', _lane: 'bm25', _srcRank: 1, _poolIdx: 17 },
    ];
    const kept = capRerankPool(p, { limit: 3 }).kept;
    expect(ids(kept)).toContain('meetings/bm0.txt');
  });

  it('is deterministic — a cap that reordered run to run would make every answer nondeterministic', () => {
    const p = pool(['a', 'b', 'c'], 8);
    expect(ids(capRerankPool(p, { limit: 7 }).kept)).toEqual(ids(capRerankPool(p, { limit: 7 }).kept));
  });

  it('does not mutate the pool it is given', () => {
    const p = pool(['a', 'b'], 4);
    const before = JSON.stringify(p);
    capRerankPool(p, { limit: 2 });
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('selectResults — the post-rerank stage, now replayable', () => {
  const scored = (list) => list.map((c, i) => ({ ...c, ceScore: 1 - i * 0.1, fullText: 'body' }));

  it('GUARD: is pure — replaying the same pool twice gives byte-identical scores', () => {
    // The boosts add to ceScore in place. Without the defensive copy, the SECOND call double-boosts
    // and the measurement harness would silently compare a boosted pool against a twice-boosted one.
    const ranked = scored([
      { repo: 'qudag', path: 'a.md', title: 'a' },
      { repo: 'daa', path: 'b.md', title: 'b' },
    ]);
    const first = selectResults({ query: 'what does qudag do', ranked, k: 2 });
    const second = selectResults({ query: 'what does qudag do', ranked, k: 2 });
    expect(second.results.map((r) => r.ceScore)).toEqual(first.results.map((r) => r.ceScore));
    expect(ranked.every((r) => r.ceScore <= 1)).toBe(true); // caller's array untouched
  });

  it('still applies the repo-name affinity boost it inherited (qudag beats a higher-scored sibling)', () => {
    const ranked = scored([{ repo: 'daa', path: 'b.md', title: 'b' }, { repo: 'qudag', path: 'a.md', title: 'a' }]);
    const { results } = selectResults({ query: 'can qudag do quantum-resistant routing', ranked, k: 2 });
    expect(results[0].repo).toBe('qudag');
  });
});

describe('scopedNamesIn — one definition, two call sites', () => {
  it('extracts scoped package tokens, lowercased', () => {
    expect([...scopedNamesIn('what is @ruvector/RVF good for')]).toEqual(['@ruvector/rvf']);
  });
  it('finds nothing in ordinary prose, so the rescue + boost paths stay off', () => {
    expect(scopedNamesIn('how do I search a million embeddings').size).toBe(0);
  });
});

describe('searchAll — the cap is actually WIRED to the cross-encoder', () => {
  const dir = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(d, `${n}.rvf`), 'x');
    return d;
  };
  beforeEach(() => {
    vi.mocked(searchKb).mockReset();
    vi.mocked(rerankPairs).mockReset();
    vi.mocked(searchKb).mockImplementation(async () =>
      Array.from({ length: 8 }, (_, i) => ({ path: `d${i}.md`, title: `t${i}`, fullText: 'body', bestDistance: 0.1 })));
    vi.mocked(rerankPairs).mockImplementation(async (_q, c) => c.map((x, i) => ({ ...x, ceScore: -i })));
  });
  afterEach(() => { delete process.env.KB_CE_MAX_PAIRS; });

  it('GUARD: sends the cross-encoder only the budgeted number of pairs', async () => {
    process.env.KB_CE_MAX_PAIRS = '10';
    const out = await searchAll({ dir: dir(), query: 'a plain question', k: 3 });
    // Breaking this: drop the capRerankPool call and rerankPairs sees all 32 again.
    expect(vi.mocked(rerankPairs).mock.calls[0][1]).toHaveLength(10);
    expect(out.pooled).toBe(10);
    expect(out.pooledAll).toBe(32);
    expect(out.cappedOut).toBe(22);
  });

  it('KB_CE_MAX_PAIRS=0 restores the uncapped pool exactly — the A/B has to stay runnable', async () => {
    process.env.KB_CE_MAX_PAIRS = '0';
    const out = await searchAll({ dir: dir(), query: 'a plain question', k: 3 });
    expect(vi.mocked(rerankPairs).mock.calls[0][1]).toHaveLength(32);
    expect(out.pooled).toBe(32);
    expect(out.cappedOut).toBe(0);
  });

  it('reports the withheld count honestly rather than restating pooled as if nothing was cut', async () => {
    process.env.KB_CE_MAX_PAIRS = '8';
    const out = await searchAll({ dir: dir(), query: 'a plain question', k: 3 });
    expect(out.pooled + out.cappedOut).toBe(out.pooledAll);
  });
});
