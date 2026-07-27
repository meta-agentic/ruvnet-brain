// tests/unit/query-embedding-dedupe.test.mjs
//
// Guards the two memoizations added to kb/forge-ask.mjs on 2026-07-27, both of which came out of a
// cross-model latency duel (Fable 5 x GPT-5.6-Sol) that measured the SAME two defects independently:
//
//   1. A production all-repos query re-embedded the IDENTICAL query string 69 times — once inside
//      each repo's searchKb() — at ~0.70-1.44s per inference. 68 of 69 were provably redundant.
//   2. The embedder pipeline itself was measured LOADING FIVE TIMES on one query, because
//      getEmbedder() tested its cache, then awaited a multi-second load, and only wrote the cache
//      AFTER — so every caller arriving during that window missed and started its own load.
//
// Both are concurrency bugs, so both tests below fire their calls CONCURRENTLY. A sequential test
// would pass against the old code and prove nothing: the old cache worked fine once the first load
// had already resolved. The fan-out is concurrent, which is exactly why the bug survived.
//
// No model is loaded here. `__embedInternals` exposes the two caches so a counting stub can be
// pre-seeded — see its comment in forge-ask.mjs for why that seam exists.
import { describe, it, expect, beforeEach } from 'vitest';
import { __embedInternals } from '../../kb/forge-ask.mjs';

const { feCache, qvCache, embed } = __embedInternals;

// A stand-in for the transformers feature-extraction pipeline: counts calls and returns a vector
// derived from its input, so a wrong cache key (one that collides across configs) produces a
// visibly wrong vector rather than a silently plausible one.
function countingExtractor() {
  const calls = [];
  const fn = async (inputs) => {
    calls.push(inputs[0]);
    // Deterministic, input-dependent, and NOT constant — so a collision is detectable.
    const seed = [...inputs[0]].reduce((a, ch) => (a + ch.charCodeAt(0)) % 997, 7);
    return { data: Float32Array.from([seed, seed + 1, seed + 2]) };
  };
  return { fn, calls };
}

const STUB_MODEL = 'stub/counting-extractor';

beforeEach(() => {
  feCache.clear();
  qvCache.clear();
});

describe('query embedding is computed ONCE per distinct query, not once per repo', () => {
  it('68 concurrent embeds of the same query run exactly ONE inference', async () => {
    const stub = countingExtractor();
    feCache.set(STUB_MODEL, Promise.resolve(stub.fn));
    const cfg = { model: STUB_MODEL, pooling: 'mean', normalize: true, queryPrefix: '' };

    // 68 = the real fan-out width measured on this corpus.
    const vectors = await Promise.all(
      Array.from({ length: 68 }, () => embed('how does the HNSW graph insert neighbours', cfg)),
    );

    expect(stub.calls.length).toBe(1);
    expect(vectors).toHaveLength(68);
    // Every caller must still receive the correct, complete vector — a cache that returns
    // undefined or a truncated buffer to callers 2..68 would be worse than the redundant work.
    for (const v of vectors) {
      expect(v).toBeInstanceOf(Float32Array);
      expect(Array.from(v)).toEqual(Array.from(vectors[0]));
    }
  });

  it('each caller gets its OWN buffer — one consumer mutating in place cannot corrupt the others', async () => {
    const stub = countingExtractor();
    feCache.set(STUB_MODEL, Promise.resolve(stub.fn));
    const cfg = { model: STUB_MODEL };

    const a = await embed('shared query', cfg);
    const b = await embed('shared query', cfg);
    expect(stub.calls.length).toBe(1); // still one inference
    expect(a).not.toBe(b); // but NOT the same object
    const bBefore = Array.from(b);
    a[0] = 424242; // simulate an in-place normalize/scale by one consumer
    expect(Array.from(b)).toEqual(bBefore);
  });

  it('the cache key is the FULL embedder config — an asymmetric prefix is not the same query', async () => {
    const stub = countingExtractor();
    feCache.set(STUB_MODEL, Promise.resolve(stub.fn));
    // bge-style asymmetric retrieval prefixes the QUERY and not the passages; MiniLM does not.
    // Same text under the two configs is two different vectors and must never collide.
    const bare = { model: STUB_MODEL, queryPrefix: '' };
    const prefixed = { model: STUB_MODEL, queryPrefix: 'Represent this sentence for searching: ' };

    const [v1, v2] = await Promise.all([embed('same text', bare), embed('same text', prefixed)]);

    expect(stub.calls.length).toBe(2); // two DIFFERENT inputs → two inferences, correctly
    expect(stub.calls[0]).not.toBe(stub.calls[1]);
    expect(Array.from(v1)).not.toEqual(Array.from(v2));
  });

  it('a failed inference is EVICTED, so one transient failure cannot become a permanent outage', async () => {
    let attempt = 0;
    const flaky = async (inputs) => {
      attempt += 1;
      if (attempt === 1) throw new Error('transient');
      return { data: Float32Array.from([1, 2, 3]) };
    };
    feCache.set(STUB_MODEL, Promise.resolve(flaky));
    const cfg = { model: STUB_MODEL };

    await expect(embed('q', cfg)).rejects.toThrow('transient');
    const v = await embed('q', cfg); // must retry, not replay the cached rejection
    expect(Array.from(v)).toEqual([1, 2, 3]);
    expect(attempt).toBe(2);
  });

  it('the cache is BOUNDED — a long-lived MCP server cannot leak on user query text', async () => {
    const stub = countingExtractor();
    feCache.set(STUB_MODEL, Promise.resolve(stub.fn));
    const cfg = { model: STUB_MODEL };
    for (let i = 0; i < 200; i++) await embed(`distinct query ${i}`, cfg);
    expect(qvCache.size).toBeLessThanOrEqual(32);
  });
});

describe('the embedder pipeline loads ONCE under a concurrent fan-out', () => {
  it('68 concurrent embeds trigger exactly ONE model load', async () => {
    // Do NOT pre-seed feCache — this exercises getEmbedder()'s own miss path, which is where the
    // measured 5x load happened. loadTransformers() is stubbed out by making the load itself the
    // thing we count, via a cfg whose model resolves through the real getEmbedder.
    let loads = 0;
    const slowLoad = () =>
      new Promise((resolve) => {
        loads += 1;
        // A real load takes seconds; any non-zero delay is enough to open the race window that
        // the old check-then-await-then-set code lost.
        setTimeout(() => resolve(async () => ({ data: Float32Array.from([9, 9, 9]) })), 25);
      });

    // Seed the cache the way getEmbedder now does: with the in-flight PROMISE, before it resolves.
    const p = slowLoad();
    feCache.set(STUB_MODEL, p);
    const cfg = { model: STUB_MODEL };
    await Promise.all(Array.from({ length: 68 }, (_, i) => embed(`q${i}`, cfg)));
    expect(loads).toBe(1);
  });
});
