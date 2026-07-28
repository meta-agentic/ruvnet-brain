---
id: ADR-057
title: Bounding the cross-encoder pool — the measurement, and why the cap ships OFF
status: Accepted
date: 2026-07-27
updated: 2026-07-27
authors: [Stuart Kerr, Claude Code]
tags: [retrieval, latency, cross-encoder, measurement, negative-result]
supersedes: []
relates: [ADR-0011, ADR-0025]
governs:
  - kb/forge-ask-all.mjs
  - scripts/rerank-cap-eval.mjs
  - scripts/rerank-cap-warm-ab.mjs
---

# ADR-057 — Bounding the cross-encoder pool

**Status**: Accepted

The mechanism is built, tested and wired. **Its default is OFF**, and the reason is a measurement,
not a preference.

## Context

`search_ruvnet` is slow enough that it does not get consulted. The prior session established where
the time goes, on a quiet machine, and the numbers are not in dispute:

| stage | cost |
|---|---|
| cold query (one repo, k=2) | 72,970 ms |
| warm query (same process) | 19,620 ms |
| therefore: two ONNX model loads | 53,350 ms |
| cross-encoder share of the WARM query | 84.7% |
| HNSW vector search share | 3.0% |

It is not vector search. RuVector's HNSW is sub-millisecond. The cost is the
`ms-marco-MiniLM-L-6-v2` cross-encoder, which reads **607 (query, passage) pairs per question at the
median** (min 574, max 615, measured over the frozen 120-question held-out set). That count comes
from the per-repo pool (8) times ~69 stores — asking for `k=3` documents still pushes 607 whole
documents through a 512-token model.

Two prior attempts are on the record and both failed, which is why this one insisted on a quality
measurement before a line of policy was chosen:

- **Repointing `KB_MODEL_CACHE`** — hypothesis tested and **falsified**: 62s vs 19s, i.e. *slower*.
- **De-duplicating query embeddings** — real fix, but wall time went 1039s → 1097s, because the
  cross-encoder is 85% of the cost and that change did not touch it.

## The method

Measuring a candidate policy properly costs one full uncapped query per question, so the experiment
is split in two (`scripts/rerank-cap-eval.mjs`):

1. **`--collect`** runs the frozen held-out set uncapped and records every scored candidate: repo,
   path, lane, within-lane depth, pool position, vector distance and cross-encoder score.
2. **`--report`** replays the *shipping* `capRerankPool` + `selectResults` — imported, never
   re-implemented — against those recorded scores, for every budget.

Grading uses the repo's own frozen ground truth (`scripts/eval-brain.mjs`: `routed`, `abstain`,
`banner`, each with a Wilson bound), never a model judge. It is supplemented by two stricter
identity metrics, because "the grade held" and "the answer is the same document" are different
claims: **top-1 identical** and **top-3 retained**.

The replay's headline finding was then re-measured for real, warm and paired
(`scripts/rerank-cap-warm-ab.mjs`), because of the correction in the next section.

## Three findings, in the order they changed the design

### 1. The original policy's stated premise was wrong

The first implementation dealt the budget **by depth** — every store's rank-0 passage before any
store's rank-1 — justified in a comment by the claim that vector distances from different stores
"are not comparable, and making them comparable is the cross-encoder's entire job."

That was asserted, never measured. Measured: across all 69 stores the median rank-0 distance spans
**0.916 to 1.196** — one scale, not 69. And distance-ordered selection beats depth-ordered selection
at **every** budget tested:

| budget | top-1 identical, depth-dealt | top-1 identical, distance-dealt |
|---|---|---|
| B=408 | 89.2% | 94.2% |
| B=272 | 77.5% | 85.8% |
| B=136 | 58.3% | 70.0% |
| B=69  | 43.3% | 59.2% |

Depth loses for a simple reason: it spends the budget evenly across 69 stores when the answer lives
in one or two of them. `capRerankPool` now keeps one floor passage per store (so no store is
silently muted) and spends everything above the floor on the globally closest passages.

### 2. A capped run is not "the uncapped run minus some rows"

The replay rests on an assumption the original harness stated as fact: that the cross-encoder scores
pairs independently, so replaying a subset is *exact*. **It is not.** Measured directly:

- Same 64 passages, same order, same process, scored twice → **64/64 byte-identical** scores. The
  model is perfectly deterministic.
- Same 64 passages, **re-batched by length** → **0/64 identical**, max |Δ| = **0.26 logits**.
- One short passage scored alone vs. padded next to a long one → Δ = **0.020**.

Batch *composition* moves scores, because padding does. A cap changes which pairs share a batch, so
it perturbs the survivors too. The replay is therefore an approximation with a ±0.26-logit error
bar — good enough to rank policies, not good enough to ship on. Hence the real warm A/B.

This also has two consequences beyond this ADR: the CE_BATCH_SIZE-aligned worker sharding in
`kb/forge-rerank.mjs` is **load-bearing**, not tidiness; and **length-sorted batching is rejected**.
Sorting the pool by length before batching would cut padded compute by 19.8% (estimated over all
72,736 recorded pairs) for zero pairs dropped — an attractive free lunch that is not free, because
it changes every score. It could still be shipped, but only behind its own before/after, and a 20%
saving does not justify perturbing every answer in the product.

### 3. Even the best policy buys less than the problem needs

The measured curve, replayed over all 120 frozen questions (floor-1 + distance):

| budget | pairs cut | top-1 identical | top-3 retained | routed | abstain | banner | graded flips |
|---|---|---|---|---|---|---|---|
| uncapped | 0% | 120/120 (100%) | 220/220 (100%) | 62/80 | 18/20 | 20/20 | — |
| B=476 | 22% | 115/120 (95.8%) | 206/220 (93.6%) | 62/80 | 18/20 | 20/20 | +0/-0 |
| B=408 | 33% | 113/120 (94.2%) | 194/220 (88.2%) | 62/80 | 18/20 | 20/20 | +0/-0 |
| B=340 | 44% | 107/120 (89.2%) | 185/220 (84.1%) | 62/80 | 18/20 | 20/20 | +0/-0 |
| B=272 | 55% | 103/120 (85.8%) | 177/220 (80.5%) | 62/80 | 18/20 | 20/20 | +1/-1 |
| B=204 | 66% | 95/120 (79.2%) | 156/220 (70.9%) | 62/80 | 18/20 | 20/20 | +1/-1 |
| B=136 | 78% | 83/120 (69.2%) | 136/220 (61.8%) | 58/80 | 18/20 | 20/20 | +1/-4 |

The ground-truth grade is remarkably robust — it holds at 62/80 down to a 66% pair cut, because the
replacement document is usually in the same repo. But `routed` grades the **repo**, and the thing a
reader is handed is a **file**.

The real warm A/B at the recommended budget (24 stratified questions, paired, order-alternated, one
warm process — `npm run cap:ab -- --cap 408 --n 24`) says exactly that:

| | pairs (median) | warm wall (median) | routed | abstain | banner |
|---|---|---|---|---|---|
| uncapped (before) | 607 | **37.05 s** | 13/15 | 4/5 | 3/4 |
| capped B=408 (after) | 408 | **25.78 s** | 13/15 | 4/5 | 3/4 |

−30.4% wall time (−29.2% as the median of per-question ratios). Every ground-truth metric unchanged.
Top-1 cited path identical on 22/24; top-3 retained 33/42 (78.6% — the replay predicted 88.2%, which
is finding 2 showing up as promised). And then this, which is the whole decision:

    s-05 [scenario] "Our agent ingests untrusted web content; if an ingest poisons memory we need
                     instant rollback without replaying the whole day."   expect: agenticow|concepts

    before (607 pairs): agenticow/examples/rollback-quarantine.mjs   ce = +1.717
    after  (408 pairs): concepts/agenticow/CARD/agenticow-card       ce = −2.869

The uncapped brain returns the literal worked example. The capped brain drops that document from the
pool and returns a generic capability card scoring 4.6 logits worse and **below the abstention
threshold** — an answer the brain itself would flag as not confidently relevant. Every ground-truth
metric scores it a pass, because `concepts` is an accepted repo. One answer in twenty-four, lost
where the frozen gate cannot see it.

And the payoff is bounded by arithmetic no budget escapes. The cross-encoder is 84.7% of a warm
query, and the cap does nothing at all for the 53s cold model load, which is 73% of what a
first-call user actually waits for. Separately, 82 of the 120 recorded cold queries (68.3%, at
3-way concurrency) already exceed the 120s proxy timeout in `plugin/mcp/server.mjs` — and on
expiry `childRequest` deletes the pending waiter (`:121`), so the child's completed answer arrives
to no reader (`:105-106`) and is discarded. A 30% cut does not rescue that; it is a different bug.

## Decision

1. **`capRerankPool` ships, and ships correct**: floor-per-store, then vector distance, with the
   rescue (#33 Part A) and BM25 lanes exempt and the floor skipped rather than overspent.
2. **`CE_MAX_PAIRS_DEFAULT = 0` — the cap is OFF by default.** The best budget measured buys −30%
   warm wall time and costs one answer in twenty-four, invisibly to the frozen gate. A 19.6s warm
   query becoming 13.7s does not turn an unconsulted tool into a consulted one; trading answers for
   it is a bad trade, and "fast and differently-cited" is not a win this project gets to declare on
   a user's behalf.
3. **`KB_CE_MAX_PAIRS` exposes the trade** to any operator who wants it, with this table in front
   of them. B=408 is the recommended value for anyone who takes it: it is the largest cut that
   changed no graded outcome in either direction on 120 questions.
4. **Length-sorted batching is rejected** for now, on the measurement in finding 2.
5. **The latency work goes where the time is.** In descending order of what a user actually waits
   for: the 53s cold model load (a warm/preloaded worker, not a cap); the 120s proxy timeout in
   `plugin/mcp/server.mjs`, which on expiry deletes the pending waiter so the child's *completed*
   answer arrives and is dropped on the floor; and query-scoped store selection, which is the only
   lever that attacks the 69× fan-out at its root instead of rationing it.

## Consequences

- Nothing about a default install changes. The uncapped path is the default path, byte for byte.
- The repo now owns a reusable answer-quality harness for any future change to the candidate pool:
  collect once, replay every policy, and a warm paired A/B to check the replay against reality.
- A future ADR that wants to turn the cap on must beat this table, not argue with it.
