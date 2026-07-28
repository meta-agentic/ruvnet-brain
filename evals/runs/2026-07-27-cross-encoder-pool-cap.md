# Cross-encoder pool cap — before/after, latency AND answer quality (2026-07-27)

Decision record: [ADR-057](../../docs/adr/0059-cross-encoder-pool-cap.md). **Verdict: do not ship
the cap on by default.** The mechanism ships; `CE_MAX_PAIRS_DEFAULT = 0`.

Corpus: the frozen 120-question held-out set (`evals/held-out.json`), graded by
`scripts/eval-brain.mjs` ground truth — never a model judge.
Code under test: `kb/forge-ask-all.mjs` on branch `perf/cross-encoder-cap`.
Brain: `~/.cache/ruvnet-brain/kb`, 69 stores.

---

## 1. What the cross-encoder actually costs

| | measured |
|---|---|
| (query, passage) pairs per all-repos question | **607 median** (min 574, max 615, n=120) |
| cross-encoder share of a warm query | 84.7% |
| HNSW vector search share | 3.0% |
| cold model load (two ONNX models) | 53,350 ms |
| cold all-repos queries exceeding the 120s proxy cap in `plugin/mcp/server.mjs` | **82 of 120 (68.3%)**, at 3-way concurrency |

The last row is the one that hurts: on timeout `childRequest` deletes the pending waiter
(`plugin/mcp/server.mjs:121`), so when the child's answer finally arrives the reader finds no waiter
(`:105-106`) and **drops a fully computed answer on the floor**.

## 2. Where the winning document sits in its own store's vector ranking

    winning document : depth 0: 52 | 1: 19 | 2: 14 | 3: 8 | 4: 6 | 5: 8 | 6: 4 | 7: 4 | 8: 1 | 10: 1 | 15: 1 | 16: 1 | 23: 1

Only 43% of answers are their own store's nearest passage. The cross-encoder routinely promotes a
passage its store ranked 4th or 7th — which is the whole reason it exists, and the reason any
pre-score cut removes real answers roughly in proportion to what it saves.

## 3. Policy search — replayed over all 120 questions

Scores collected once, uncapped, then every policy replayed against those exact scores through the
shipping `capRerankPool` + `selectResults`. `routed`/`abstain`/`banner` are the frozen ground-truth
metrics; `top-1 identical` and `top-3 retained` are stricter document-identity checks.

| policy | pairs (med) | cut | top-1 identical | top-3 retained | routed | abstain | banner | graded flips |
|---|---|---|---|---|---|---|---|---|
| **uncapped** | 607 | — | 120/120 (100%) | 220/220 (100%) | 62/80 | 18/20 | 20/20 | — |
| floor1+dist B=476 | 476 | 22% | 115/120 (95.8%) | 206/220 (93.6%) | 62/80 | 18/20 | 20/20 | +0/-0 |
| **floor1+dist B=408** | 408 | 33% | 113/120 (94.2%) | 194/220 (88.2%) | 62/80 | 18/20 | 20/20 | +0/-0 |
| floor1+dist B=340 | 340 | 44% | 107/120 (89.2%) | 185/220 (84.1%) | 62/80 | 18/20 | 20/20 | +0/-0 |
| floor1+dist B=272 | 272 | 55% | 103/120 (85.8%) | 177/220 (80.5%) | 62/80 | 18/20 | 20/20 | +1/-1 |
| floor1+dist B=204 | 204 | 66% | 95/120 (79.2%) | 156/220 (70.9%) | 62/80 | 18/20 | 20/20 | +1/-1 |
| floor1+dist B=136 | 136 | 78% | 83/120 (69.2%) | 136/220 (61.8%) | 58/80 | 18/20 | 20/20 | +1/-4 |
| depth B=408 (prior design) | 408 | 33% | 107/120 (89.2%) | 195/220 (88.6%) | 60/80 | 18/20 | 20/20 | |
| depth B=272 (prior design) | 272 | 55% | 93/120 (77.5%) | 163/220 (74.1%) | 59/80 | 18/20 | 20/20 | |
| depth B=136 (prior design) | 136 | 78% | 70/120 (58.3%) | 113/220 (51.4%) | 51/80 | 18/20 | 20/20 | |
| cascade R=32 (CE-guided) | 357 | 41% | 105/120 (87.5%) | 203/220 (92.3%) | 54/80 | 18/20 | 20/20 | |
| cascade R=8 | 143 | 76% | 83/120 (69.2%) | 172/220 (78.2%) | 52/80 | 18/20 | 20/20 | |
| storeGate w=0.2 | 267 | 56% | 112/120 (93.3%) | 200/220 (90.9%) | 61/80 | 18/20 | 20/20 | |
| storeGate w=0.08 | 75 | 88% | 73/120 (60.8%) | 134/220 (60.9%) | 46/80 | 18/20 | 20/20 | |
| margin δ=0.18 | 147 | 76% | 94/120 (78.3%) | 145/220 (65.9%) | 61/80 | 18/20 | 20/20 | |

Seven policy families, ~35 configurations. **Distance beats depth at every budget** — the prior
design's comment asserted distances across stores are incomparable; measured, the 69 stores' median
rank-0 distances span 0.916–1.196, one scale.

## 4. The real warm A/B — `npm run cap:ab -- --cap 408 --n 24`

24 questions, stratified, **paired and order-alternated inside one warm process** (models loaded
once, first query discarded). This is the number that counts; the replay above is an approximation.

| | pairs (med) | warm wall (median) | warm wall (mean) | routed | abstain | banner |
|---|---|---|---|---|---|---|
| **uncapped (before)** | 607 | **37.05 s** | 40.83 s | 13/15 | 4/5 | 3/4 |
| **capped B=408 (after)** | 408 | **25.78 s** | 32.87 s | 13/15 | 4/5 | 3/4 |

- **wall time: −30.4%** (ratio of medians); **−29.2%** (median of per-question ratios, p10 −41.9%,
  p90 −11.0%). The paired design matters: absolute times drifted upward through the run as the
  machine got busier, and the ratio did not.
- **top-1 cited path identical: 22/24 (91.7%)**
- **top-3 cited paths retained: 33/42 (78.6%)** — the replay predicted 88.2%; reality was worse,
  which is finding 5 below.
- ground-truth grades: **unchanged in every stratum.**
- sanity check on the before-arm: its top-1 agrees with the raw CE argmax of the 5-hour-old baseline
  traces on **23/24**, the one difference being a question where the post-rerank boosts legitimately
  move the winner off the raw argmax. The uncapped path is stable.

### The question that decides it

    s-05 [scenario] "Our agent ingests untrusted web content; if an ingest poisons memory we need
                     instant rollback without replaying the whole day."
    expect: agenticow | concepts

    before (607 pairs): agenticow/examples/rollback-quarantine.mjs   ce = +1.717
    after  (408 pairs): concepts/agenticow/CARD/agenticow-card       ce = −2.869

The uncapped brain returns the literal worked example. The capped brain drops that document from the
pool and returns a generic capability card scoring **4.6 logits worse and below the abstention
threshold** (`ABSTAIN_CE = 0`) — i.e. an answer the brain itself would flag as not confidently
relevant.

**Every ground-truth metric scores this as a pass**, because `concepts` is an accepted repo. The
frozen set grades the *repo*; the user is handed a *file*. That gap is precisely where "fast and
wrong" hides, and it is 1 in 24 questions at the mildest budget that saves anything.

## 5. Negative results worth keeping

**Batch composition moves cross-encoder scores.** Same 64 passages, same order, same process,
scored twice → **64/64 byte-identical** (the model is perfectly deterministic). Same 64 passages
**re-batched by length** → **0/64 identical, max |Δ| = 0.26 logits**. One short passage alone vs.
padded beside a long one → Δ = 0.020.

Consequences:
- A capped run is not "the uncapped run minus rows" — it perturbs the survivors too. Any offline
  replay of a pool policy is an approximation (here: it over-predicted top-3 retention by ~10 pts).
- **Length-sorted batching is rejected.** It would cut padded compute by 19.8% (estimated over all
  72,736 recorded pairs; theoretical ceiling 21.0%) for zero pairs dropped — but it changes every
  score, so it is not the free lunch it looks like.
- The `CE_BATCH_SIZE`-aligned worker sharding in `kb/forge-rerank.mjs` is load-bearing.

**63.2% of pairs already hit the model's 512-token ceiling**, which is why the padding headroom is
only ~21% and why truncating passages harder is the wrong lever.

## 6. Verdict

At the mildest budget that saves anything (B=408, 33% fewer pairs) the cap buys **−30% warm wall
time** and costs **one answer in twenty-four**, invisibly to the frozen gate. It buys nothing at all
against the 53s cold model load, which is 73% of what a first-call user waits for.

A 19.6s warm query becoming 13.7s does not turn an unconsulted tool into a consulted one. Trading
answer quality for that is a bad trade, so it does not become the default. `KB_CE_MAX_PAIRS` is
there for an operator who reads this table and wants it anyway; B=408 is the value to use.

## Reproduce

    npm run cap:collect                     # ~90 min: 120 uncapped queries, records every scored pair
    npm run cap:report                      # seconds: replays every policy against those scores
    npm run cap:ab -- --cap 408 --n 24      # ~35 min: the real warm paired A/B
