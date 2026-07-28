---
id: ADR-0060
title: The two-stage cross-encoder cascade — reading every passage, cheaply, before reading a few properly
status: Accepted
date: 2026-07-27
updated: 2026-07-27
authors: [Stuart Kerr, Claude Code]
tags: [retrieval, latency, cross-encoder, cascade, measurement]
supersedes: [ADR-0059]
relates: [ADR-057, ADR-0011, ADR-0025]
governs:
  - kb/forge-rerank.mjs
  - kb/forge-ask-all.mjs
  - scripts/rerank-cap-warm-ab.mjs
  - scripts/rerank-cap-eval.mjs
---

Updated: 2026-07-27 | Version 1.0.0
Created: 2026-07-27

# ADR-0060 — The two-stage cross-encoder cascade

**Status**: Accepted

ADR-057 built a pool cap, measured it, and shipped it **OFF** because at the budget that bought the
time it dropped one answer in 24. This ADR keeps the time and keeps the answer, by changing *what
orders the cut* rather than *how deep the cut goes*.

## Context — what ADR-057 established, and must not be re-derived

| fact | value |
|---|---|
| cross-encoder share of a WARM query | 84.7% |
| HNSW vector search share | 3.0% |
| (query, passage) pairs per question, median | 607 |
| flat cap at its best budget (B=408), warm paired A/B | 37.05s → 25.78s (−30.4%) |
| ~~two ONNX model loads (cold)~~ | ~~53,350 ms~~ — **corrected below to 1,670 ms** |

One inherited number does not survive re-measurement. ADR-057's "53,350 ms of model load" was
obtained by subtracting a warm all-repos query from a **cold one-repo k=2 query** — two different
workloads — and was never measured directly. Measured directly, twice, two ways, with the models
on local disk: **1,670 ms** (cold-minus-warm, end to end) and **1,762 ms** (timing each load). The
53s is real but it is a first-run **download**, whose root cause (`bin/install.mjs` warming a cache
path the runtime never reads) was already found and fixed on this line. Full numbers in the run
record §6. This matters here because it removes an entire branch of the optimisation tree.

And the reason that −30.4% did not ship: held-out question **s-05** ("…instant rollback without
replaying the whole day") went from the worked example `agenticow/examples/rollback-quarantine.mjs`
(ce **+1.717**) to a generic `concepts/agenticow/CARD/agenticow-card` (ce **−2.869**) — 4.6 logits
worse and below the abstention threshold. Every frozen metric passed, because the frozen set grades
the **repo** and the user is handed a **file**.

## The diagnosis ADR-057 stopped one step short of

ADR-057 concluded the cap was too aggressive. It was not. It was **ordered by the wrong signal**.

Measured on s-05's recorded 608-candidate pool:

| ordering of s-05's pool | rank of `agenticow/examples/rollback-quarantine.mjs` |
|---|---|
| bi-encoder vector distance | **593 of 608** |
| full cross-encoder | **1 of 608** (+1.717, a 4.6-logit margin over 2nd) |

The bi-encoder is not a weak proxy for the cross-encoder on this question; it is very nearly an
inverted one. A distance-ordered cascade would have to keep **594 of 608** pairs to retain that
answer — it saves nothing. No budget could have rescued ADR-057's design, and no amount of raising
`B` was ever going to be the fix.

This also disposes of the cheapest idea on the table. "Use the bi-encoder distances you already
computed" is free, and it is free because it is worthless here.

## Decision

Two stages of **the same cross-encoder**, distinguished only by how much of each passage it reads.

1. **Stage 1** scores all ~607 pooled pairs at `KB_CE_CASCADE_TOKENS` (default **192**) tokens.
2. **Stage 2** re-reads the top **K** survivors (`KB_CE_CASCADE_K`) at the full 512 tokens.

The exempt lanes of ADR-057 are inherited unchanged (`rescue` and `bm25` always survive — a boost
cannot rescue what was never a candidate, and a transcript store's answer is BM25-only). The
**per-store floor is dropped**: it existed only because the flat cap had to choose before any score
existed, and the cascade has a score for every candidate from the very model that will make the
final decision.

### Why a prefix, and not a smaller model

The obvious cascade is a distilled tiny cross-encoder (`ms-marco-MiniLM-L-2-v2`) in front of the
L-6. Three measurements argue against it and none argue for it:

- **rUv already answered this one.** ruflo ADR-080 ships this exact model for this exact job and
  records the conclusion: *"Larger cross-encoder (ms-marco-MiniLM-L-12-v2, etc.) — int8 v6 is the
  speed/quality sweet spot for now."* The L-6 int8 choice is not ours to re-litigate for free.
- **A second model is a second cold load.** The cold path is already 53s of ONNX init and is the
  worst number this product has. A second model makes the *cold* case worse to make the *warm*
  case better. A prefix pass costs **zero** additional model load, because it is the same session.
- **A prefix is a genuine approximation; a different model is a different opinion.** Same weights,
  same head, a subset of the same input. That is the property agentic-qe's `rabitq.ts` names as the
  cascade contract — *"a cheap ranking proxy to shrink the candidate pool, then run exact … on the
  survivors"* — and precisely the property vector distance was measured not to have.

### Why 192 tokens

Measured 2026-07-27 over 608 real corpus passages drawn to the production length distribution
(62.8% of production passages reach the model's 512-token ceiling; mean 397 tokens):

| stage-1 config | wall ms, 608 pairs | vs full | full-top-3 retained in stage-1 top-64 |
|---|---|---|---|
| full (512) | 16,223 | 1.000x | 3/3 |
| max_length=384 | 13,225 | 0.815x | 3/3 |
| max_length=256 | 7,087 | 0.437x | 3/3 |
| **max_length=192** | **5,195** | **0.320x** | **3/3** |
| max_length=128 | 3,334 | 0.206x | 2/3 |
| max_length=96 | 2,302 | 0.142x | 1/3 |
| max_length=64 | 1,589 | 0.098x | 0/3 |
| max_length=48 | 1,291 | 0.080x | 0/3 |

192 is the last row that loses nothing. Below it the ranking starts dropping documents the full
model puts in its own top 3.

Note the shape: cost falls **faster than length** (attention is quadratic), which is the whole
reason this works. Halving the *pool* saves exactly half the time and throws away half the
evidence. Halving the *sequence* saves more than half the time and throws away only the tail of
each document — and for a 512-token model reading a 4,800-character median document, the tail was
mostly truncated anyway.

## Measured proof

### The headline — real warm paired A/B

Same protocol as ADR-057's `-30.4%`, so the numbers are comparable: the frozen held-out set,
n=24 questions, paired, order-alternated, one warm process, `scripts/rerank-cap-warm-ab.mjs`.

| | full reads (median) | warm wall median | warm wall mean | routed | abstain | banner |
|---|---|---|---|---|---|---|
| baseline, no policy (before) | 607 | **40.29s** | 44.54s | 13/15 | 4/5 | 3/4 |
| cascade K=64 @192tok (after) | 64 | **16.39s** | 18.86s | 13/15 | 4/5 | 3/4 |

```
wall-time change (median, paired): -59.3%     (total across all 24: 1069.1s -> 452.7s, -57.7%)
top-1 cited path identical : 23/24 (95.8%)
top-3 cited paths retained : 39/42 (92.9%)
stage-1 prefilter: 607 pairs at 192 tokens, median 11.95s of the 16.39s
```

Against ADR-057's flat cap at its best budget: **−59.3% vs −30.4%**, top-1 **23/24 vs 22/24**,
top-3 **39/42 vs 33/42**. Better on every axis, including the one that killed it.

An unrelated nightly rebuild held load average at 113–138 throughout, so absolute times are
inflated. The ratio is not: baseline cost varied 8x within the run (18.8s–154.0s) and the on/off
ratio did not track it (quietest-8 mean 0.403, busiest-8 mean 0.465, sd 0.103). The paired,
order-alternated protocol is what makes that claim available.

### s-05, the named regression

```
off: 37.9s  608 full reads   #1  ce +1.717  agenticow/examples/rollback-quarantine.mjs
on : 14.9s   64 full reads   #1  ce +1.770  agenticow/examples/rollback-quarantine.mjs
```

Held, above threshold, at 64 full reads instead of 608. The path is pinned as a literal token in
`tests/unit/rerank-cascade.test.mjs`, and mutant M1 — re-ordering the selector by distance, which
is precisely ADR-057's design — turns that guard red.

### The one answer that changed

`a-05`, an **adversarial** question whose correct behaviour is refusal: `ce −6.864 → −6.886`, both
arms far below the abstention threshold, `abstain` 4/5 in both. It changes which irrelevant
document is nominally cited inside an answer the product declines to give. That is not the s-05
failure mode wearing a different hat; s-05 crossed **from +1.717 to −2.869**, answer to refusal.

## What ships, and what stays off

`CE_CASCADE_K_DEFAULT = 0` — **the cascade ships OFF**, and this is not the same verdict ADR-057
reached about the cap.

ADR-057 shipped off because it had found a regression. This ships off because it has not yet
looked in enough places to say there is none. The distinction matters, and so does not blurring it.

The house rule is that a default flip must be *measurably better on both time and answers*. Time is
settled: −59.3%, paired, load-independent. Answers are **equal** — every ground-truth metric
identical, the named regression held, the single top-1 change sub-threshold on a question that
abstains. Equal is not better, and 24 of the frozen 120 questions is exactly the sample size in
which ADR-057's cap also looked clean on every graded metric while carrying s-05 inside it.

**The condition to flip it is named and cheap:** `node scripts/rerank-cap-warm-ab.mjs --cascade 64
--n 120` (~2 hours unattended, the harness already supports it). If no cited path regresses from
above the abstention threshold to below it, the evidence for `CE_CASCADE_K_DEFAULT = 64` is
complete. Until then operators take it with `KB_CE_CASCADE_K=64`, with the curve in front of them.

## What was rejected, and the measurement that killed each

| candidate | verdict |
|---|---|
| **bi-encoder distance as stage 1** (free, already computed) | **rejected.** s-05's answer is rank 593/608 by distance and 1/608 by cross-encoder. A distance cascade needs K>593 to hold it. |
| **quantizing the cross-encoder** | **already done, by inspection.** `from_pretrained(..., { quantized: true })` and the only weights on disk are `model_quantized.onnx` (23,143,499 bytes, int8). No fp32 copy exists or is ever fetched. rUv's ADR-080 independently records int8 L-6 as the sweet spot. |
| **a second, distilled CE (`L-2-v2`) as stage 1** | **rejected on the cold path.** Measured: a second model load costs 802 ms that the prefix design costs zero, and it is a different opinion rather than an approximation of the score it is filtering for. |
| **preloading models at session start / keeping them warm** | **rejected — the premise was wrong.** The one-time cost is 1,670 ms (cold-minus-warm) / 1,762 ms (direct), not 53,350 ms. See the run record §6. |
| **per-store floor in the cascade selector** | **dropped.** It exists to avoid muting a store before any score exists; stage 1 gives every candidate a score, so the floor only spends 69 slots re-confirming what stage 1 already ranked. |
| **length-sorted batching** | **stays rejected** (ADR-057): 19.8% less padded compute, but it perturbs every score. |

## Consequences

- `kb/forge-rerank.mjs` gains `cePrefilterScores(query, docs, { maxLength })` and threads an
  optional `maxLength` through `ceScoreBatch` / `ceScoreAuto` / the worker protocol. With
  `maxLength` undefined every path is byte-for-byte its previous self.
- `kb/forge-ask-all.mjs` gains `cascadeRerankPool(candidates, { limit, s1 })`, a pure function with
  the same contract as `capRerankPool` and a different ordering signal.
- `searchAll` returns `prefiltered` / `prefilterTokens` / `prefilterMs`, and the CLI's pool line
  says *"all 608 read at 192 tokens; the top 64 re-read in full"* rather than ADR-057's
  *"544 beyond the pair budget"*. Under a cascade nothing was skipped, and a count that quietly
  changed meaning is the failure mode this repo gates against.
- The determinism note from ADR-057 stands and now applies twice: batch composition moves scores,
  so the cascade's survivors are re-batched in stage 2 and their full scores are their own. Every
  number in this ADR is therefore a **real** measurement, never a replay.
