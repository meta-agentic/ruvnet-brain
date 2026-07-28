# Cross-encoder cascade — raw run record

Updated: 2026-07-27 | Version 1.0.0
Created: 2026-07-27

Decision record: `docs/adr/0059-cross-encoder-cascade.md`. Predecessor: ADR-057 /
`evals/runs/2026-07-27-cross-encoder-pool-cap.md`.

Machine: darwin arm64, M3 Max, 16 cores. Corpus: `~/.cache/ruvnet-brain/kb`, 69 stores.
Model: `Xenova/ms-marco-MiniLM-L-6-v2`, revision `a09144355adeed5f58c8ed011d209bf8ee5a1fec`,
**int8-quantized** (`model_quantized.onnx`, 23,143,499 bytes — verified on disk; the fp32 weights
are not present and are never fetched), 6 layers, hidden 384, `max_position_embeddings` 512,
tokenizer `model_max_length` 512.

## 1. Why the bi-encoder cannot be stage 1 (the measurement that set the design)

From the recorded uncapped trace of held-out question **s-05**
(`$TMPDIR/ruvnet-brain-ce-cap-traces/s-05.jsonl`, 608 candidates):

```
WINNER agenticow/examples/rollback-quarantine.mjs  ce 1.7166  dist 1.1766  srcRank 6  lane dense
global rank by DISTANCE (0-based): 593   -> a distance cascade needs K > 593
global rank by CE       (0-based): 0
top5 by ce:
  #0  +1.717  agenticow/examples/rollback-quarantine.mjs   dist 1.1766
  #1  -2.920  concepts/agenticow/CARD/agenticow-card       dist 0.9049
  #2  -3.363  agenticow/examples/README.md                 dist 1.1755
  #3  -3.552  ruv-gists/d6e2716a/agenticow-gist.md#1       dist 1.0000
  #4  -3.921  concepts/agenticow/PRIMER/agenticow-primer#0 dist 1.1385
dist distribution: min 0.7889  max 1.2683
```

Note #1: the document the flat cap returned instead (`agenticow-card`) has the **best** distance of
the two (0.905 vs 1.177) and the **worst** cross-encoder score by 4.6 logits. Distance actively
prefers the wrong answer here.

## 2. Passage length distribution (all 121 recorded traces, 72,736 pairs)

```
len chars:  p10 440  p25 992  median 4807  p75 8609  p90 10562  p99 11146  max 89583
est tokens (after the 3000-char slice, capped at 512):
            p10 110  p25 248  median 512  p75 512  p90 512   mean 397
share sitting at the 512-token ceiling: 62.8%
```

Nearly two thirds of every pair is already being truncated by the model. Stage 1 truncating harder
is a difference of degree, not of kind.

## 3. Stage-1 cost curve (608 real passages at the production length distribution)

Harness: `scratchpad/ce-cost-curve.mjs`, warm process, one warm-up pass discarded.

| stage-1 config | wall ms (608 pairs) | vs full | full-top-3 in stage-1 top-64 | top-128 | top-192 |
|---|---|---|---|---|---|
| full (512) | 16223 | 1.000x | 3/3 | 3/3 | 3/3 |
| max_length=384 | 13225 | 0.815x | 3/3 | 3/3 | 3/3 |
| max_length=256 | 7087 | 0.437x | 3/3 | 3/3 | 3/3 |
| **max_length=192** | **5195** | **0.320x** | **3/3** | **3/3** | **3/3** |
| max_length=128 | 3334 | 0.206x | 2/3 | 2/3 | 2/3 |
| max_length=96 | 2302 | 0.142x | 1/3 | 2/3 | 3/3 |
| max_length=64 | 1589 | 0.098x | 0/3 | 3/3 | 3/3 |
| max_length=48 | 1291 | 0.080x | 0/3 | 1/3 | 1/3 |
| max_length=32 | 996 | 0.061x | 0/3 | 0/3 | 1/3 |

Predicted cascade cost at 192 tokens: `0.320 + K/608`. At K=64 that is **0.425x** of the
cross-encoder's work, and the cross-encoder is 84.7% of a warm query, so the predicted warm query is
`0.847 x 0.425 + 0.153 = 0.513` — about **−49%**. Section 5 is the measurement that either confirms
that or does not.

## 4. Mutation proof of the guards (`tests/unit/rerank-cascade.test.mjs`)

Each mutant breaks exactly the property one guard names; the file is restored byte-identical after
each (`diff -q` clean).

| mutant | tests red |
|---|---|
| baseline | 0 of 12 (all pass) |
| M1 — selector ordered by DISTANCE instead of stage-1 score (the ADR-057 bug) | **3** |
| M2 — rescue/bm25 exemption removed | 1 |
| M3 — missing stage-1 scores cut blind instead of degrading to uncapped | 1 |
| M4 — cascade default silently turned ON | 1 |
| M5 — stage-1 token budget lowered without re-measuring | 1 |
| M6 — non-finite guard removed (Infinity hijacks the budget) | 1 |
| restored | 0 of 12 (all pass) |

M1 is the one that matters: reintroducing ADR-057's ordering turns the s-05 guard red.

## 5. Warm paired A/B — the headline

`node scripts/rerank-cap-warm-ab.mjs --cascade 64 --tokens 192 --n 24`
24 questions from the frozen held-out set, paired, order-alternated, one warm process.
`load1=124.6` on 16 cores (see §5.1 — an unrelated nightly `forge-big.mjs embed` job was running).
Strata: described 5, named 5, scenario 5, adversarial 5, provenance 4. Same 24 as ADR-057's run.

| | full reads (median) | warm wall median | warm wall mean | routed | abstain | banner |
|---|---|---|---|---|---|---|
| baseline, no policy (before) | 607 | **40.29s** | 44.54s | 13/15 | 4/5 | 3/4 |
| cascade K=64 @192tok (after) | 64 | **16.39s** | 18.86s | 13/15 | 4/5 | 3/4 |

```
stage-1 prefilter: 607 pairs read at 192 tokens, median 11.95s of the after-time above
wall-time change (median, paired): -59.3%
top-1 cited path identical : 23/24 (95.8%)
top-3 cited paths retained : 39/42 (92.9%)
total wall across all 24   : 1069.1s -> 452.7s  (-57.7%)
```

Every ground-truth metric is unchanged. For comparison, ADR-057's flat cap at its best budget
measured −30.4% with top-1 22/24 and top-3 33/42 — and lost s-05.

### 5.1 The speedup is not an artifact of machine load

An unrelated nightly brain rebuild (8 concurrent `forge-big.mjs embed` shards) held load average
between 113 and 138 for the whole run, so absolute times are inflated. The paired,
order-alternated design is what makes the ratio survive that, and the data says it did: baseline
cost varied 8x across the run (18.8s to 154.0s) and the on/off ratio did not track it.

```
ratio mean 0.421  sd 0.103  min 0.280  max 0.814
8 CHEAPEST baselines (quietest moments): mean ratio 0.403
8 COSTLIEST baselines (busiest moments): mean ratio 0.465
```

If the win were a load artifact the two would diverge. They differ by 0.06, and in the direction
that says the cascade helps slightly MORE when the machine is quiet.

### 5.2 The only top-1 that changed, in full

```
a-05 [adversarial]  expectRepo: null  (this question is SUPPOSED to be refused)
   before: ruview/v2/crates/homecore/src/state.rs                              ce -6.864
   after : cognitum-v0-appliance/.../static/v0-setup.js                        ce -6.886
```

Both arms return one result, both at ce ≈ −6.87, both far below the abstention threshold (ce < 0),
and `abstain` is 4/5 in both arms. This is which irrelevant document is nominally cited inside an
answer the product declines to give. It is categorically unlike s-05 under the flat cap, which
crossed the threshold from **+1.717 (answer) to −2.869 (refusal)**.

### 5.3 s-05, the named regression, in the real warm A/B

```
s-05  off: 37.9s  608 full reads   #1  ce +1.717  agenticow/examples/rollback-quarantine.mjs
s-05  on : 14.9s   64 full reads   #1  ce +1.770  agenticow/examples/rollback-quarantine.mjs
                   608 prefiltered @192 tokens
```

Same document, above threshold, at 64 full reads instead of 608. (The +1.717 → +1.770 difference is
the batch-composition effect ADR-057 documented: stage 2 re-batches its survivors, so their full
scores are their own. It moved the score by 0.05 logits and nothing else.)

## 6. The cold path — the 53s that is not there

ADR-057 recorded "two ONNX model loads = 53,350 ms", derived by subtracting a warm all-repos query
(19,620 ms) from a cold one-repo k=2 query (72,970 ms). That is an inference from a subtraction
across two different workloads, not a measurement of a model load. Measured directly, twice, two
different ways, with both models present on local disk:

**(a) time each load individually** (`scratchpad/cold-probe.mjs`, one fresh process):

```
import @xenova/transformers (JS parse)               157 ms
CE tokenizer                                          40 ms
CE model (ONNX session create, int8 23MB)             65 ms
embedder tokenizer                                   267 ms
embedder model (ONNX session create)                1231 ms   <- includes a network fetch
TOTAL model-load cost (both models)                 1762 ms
ms-marco-MiniLM-L-2-v2 (what a SECOND model costs)   802 ms
```

**(b) time cold-minus-warm end to end** (`scratchpad/cold-phases.mjs`, one fresh process, the same
608-pair question twice):

```
import forge-ask-all.mjs (incl. @ruvector/rvf native)     7 ms
COLD searchAll (first query in the process)           33287 ms
WARM searchAll (same question, same process)          31617 ms
COLD minus WARM (the one-time cost)                    1670 ms
```

**1,670 ms and 1,762 ms agree.** There is no 53-second per-session model load to optimise.

The 53s is real, but it is a **download**, not a load — and this repo had already diagnosed it,
in `bin/install.mjs`:

> *"`<cacheDir>/models-cache` DID NOT EXIST at all, while `<BRAIN_HOME>/models` held 23MB
> containing ONLY the ms-marco reranker — the bge-base EMBEDDER, the model every query needs
> first, was absent (0 files). That is the 53s cold start: every cold query re-fetches the
> embedder because install warmed the wrong path."*

That fix is already on this line. Note the cache on this machine still holds only the reranker
(`~/.cache/ruvnet-brain/models` → 1 `.onnx`), so a fresh install here would still pay the fetch
once — an install-state issue, not an architecture one.

**Therefore the three cold-path ideas in the brief are rejected, by measurement:**

| idea | why it is rejected |
|---|---|
| keep the model warm across MCP calls | already how it works — `plugin/mcp/server.mjs` supervises a **warm child**; the singleton persists for the session |
| preload in the background at session start | buys ≤1.7s, and spends two model loads on every session including the ones `card-lane.mjs` answers in 0.1ms with zero ML |
| lazy-load only when the card lane misses | already how it works — `forge-mcp-all.mjs:236` returns on a card hit before `searchAll` is ever called |
