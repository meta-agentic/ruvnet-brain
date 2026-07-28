---
id: ADR-057
title: 95 on both graders — closing a 38/53 against a self-reported 83, dimension by dimension
status: Proposed
date: 2026-07-28
updated: 2026-07-27
impl: unbuilt
governs:
  - scripts/behavioral-l1-l4.mjs
  - scripts/no-silent-substitution.mjs
  - tests/mesh/
  - bin/install.mjs
  - plugin/hooks/hooks.json
authors: [Stuart Kerr, Claude Code]
tags: [qa, gen2-qe, proactivity, learning, substitution, latency, honesty, grading]
supersedes: []
relates: [ADR-028, ADR-052, ADR-053, ADR-055, ADR-056]
---

# ADR-057: 95 on both graders

**Status**: Proposed
**Date**: 2026-07-28 · **Last updated**: 2026-07-28 · **Why**: initial draft
**Implementation**: unbuilt · **Verified in sync**: never

## Context — the owner's sentence, which is the whole problem

> *"You've been working for three weeks, four weeks, and you said this thing is perfect. Now you look
> at it from the real view, and you get a 38 out of 100 and a 53 out of 100, both horribly failing
> scores. Now I need the ADR plan for what it takes to get both of these up to 95s on all levels."*

On 2026-07-27 two independent graders ran the owner's own 8-dimension rubric against this product's
QE apparatus. **Fable 5: 53/100. GPT-5.6-Sol: 38/100.** The repo was simultaneously advertising
"L1–L4 all pass" and an 83/100.

| Dim | | Fable | GPT | worst |
|---|---|---|---|---|
| D1 | Works well under real conditions | 50 | 60 | 50 |
| D2 | Works as the user expects | 55 | 42 | 42 |
| D3 | Proactive and measured | 69 | 53 | 53 |
| D4 | Demonstrates learning end-to-end | 58 | 36 | 36 |
| D5 | Coexists with the user's system | 57 | 35 | 35 |
| D6 | Experience feels positive | 46 | 28 | 28 |
| D7 | Proper / clean / effective | 47 | 32 | 32 |
| D8 | Works on a stranger's machine | 40 | 18 | **18** |

### Why nobody noticed for weeks — three mechanisms, all verified first-hand 2026-07-28

1. **The harness certified empty runs.** `behavioral-l1-l4.mjs --levels L5` selected zero checks and
   printed `OVERALL: PASS`, exit 0. `allPass` initialised to `true` and the loop `continue`d over
   every empty level. *Fixed in this ADR's first commit; an unknown level and a zero-check run now
   both exit 2.* **This is the load-bearing mechanism**: nothing could contradict 83/100 because the
   thing meant to contradict it passed by running nothing.
2. **L4 "behavioral" matches strings, never behaviour.** Its assertion is literally
   `must: ['take the wheel','SPARC','DDD','ADR','swarm','QA gate','98',…]` against the hook's own
   injected prose. It proves the brain SPOKE. It cannot observe whether Claude LISTENED.
3. **The substitution audit points at the wrong repository.** `no-silent-substitution.mjs` runs
   `audit(root = ROOT)` over this repo's own `SCAN_DIRS`. The hand-rolling it exists to catch happens
   in the USER's project — WhitSentry — which it never opens.

Together: the product could speak correctly, be ignored completely, and report green.

## Decision

**One law, from which every dimension target below follows:**

> **A test may only claim what it can observe. "The brain emitted the right instruction" is not
> evidence that the agent obeyed it, and no quantity of the former sums to the latter.**

Gen-2 measures the agent's ARTIFACT and the ORDER of its actions, not the brain's output. Both
graders converged on this independently and it is the only route from 38 to 95 — every deduction
below is an instance of it.

### The five converged classes

Fable proposed 8 classes, GPT 7. They agree on five, and the five form one chain — **each is
worthless without its predecessor**, which is why the order is not negotiable:

> `installed everywhere → consulted in time → changes the decision → uses accumulated intelligence → status tells the truth`

| # | Class | Fable | GPT | Fails today |
|---|---|---|---|---|
| 1 | **Causal substitution prevention** | T1/T4 | 1 | YES — WhitSentry is the observed failure |
| 2 | **Latency consultation survival** | T2 | 2 | YES — 19.6s warm is 19.6× the ceiling |
| 3 | **Clean-machine / org hook integrity** | T5 | 3 | YES — the blocking gate is absent from plugin `hooks.json` |
| 4 | **Proactive + learning outcome** | T7 | 4/6 | YES — ADR-028 L5 explicitly unbuilt |
| 5 | **Claim-to-behaviour integrity** | T6 | 5 | YES — this is the 83-vs-38 contradiction itself |

### What 95 requires, per dimension

Each row states the **observable** that must exist. Anything short of it caps the score no matter how
much else works (Rule 9: known architectural flaws cap at ≤70).

**D8 — stranger's machine · 18 → 95. The worst score and the first work.**
GPT's two largest deductions anywhere both live here: *"verification failures do not stop
installation"* (`bin/install.mjs:691`) and *"the grounding smoke is explicitly 'best-effort, never
fatal'"* (`:735`). Required: install into virgin macOS / Linux / Windows-GitBash / Windows-PowerShell
/ WSL images; fire real lifecycle envelopes through the INSTALLED plugin; a failed verification
**blocks the install** instead of warning. Matrix states: no `jq`, no API keys, network denied, paths
with spaces, read-only project, Brain OFF, managed org policy. **No author-local `settings.json` may
be required for any promised behaviour.**

**D7 — proper/clean · 32 → 95.** GPT: *"the interface gate still parses shell semantics with regex…
the same defect class has now recurred across issues #12, #13, #41, #44."* Required: a real parser or
a constrained command model for `verify-interface`, plus a seeded incident corpus (heredocs,
`bash -lc`, backticks, `$()`) with false-positive AND false-negative mutants. Five recurrences of one
defect class is a design verdict, not a run of bad luck.

**D6 — experience · 28 → 95.** GPT: *"latency breaches only warn… timing regressions do not block
shipping."* Required: the fast capability-selection lane at **p95 ≤ 250ms**, absolute max **1,000ms**,
and at 1,001ms the correctness test FAILS. Justification is the product's own constant: every hook in
`hooks.json` is given 5s, and those hooks instruct the model to consult `search_ruvnet` before
writing — a product may not order a tool that costs 4× the budget it grants its own interventions.
*The card lane merged 2026-07-28 measures 0.1158ms warm (verified first-hand), so the budget is met
on the selection path; the heavy path must be removed from the decision, not merely sped up.*

**D5 — coexistence · 35 → 95.** GPT: *"the merged-registry lint found 63 findings across 42
registrations. The previous suite saw only 15."* Required: a coexistence test with sentinel foreign
hooks proving zero mutation of third-party or user-owned registrations, and honest reporting of what
we do not own.

**D4 — learning end-to-end · 36 → 95.** GPT: *"L5 is explicitly unbuilt. The required proof is
project A outcome changing behavior in project B and surviving refresh"* (ADR-028:50). Required: a
counterfactual replay — record a correction, present a **semantically equivalent, differently-worded**
task in a fresh session/project, require recall BEFORE the decision and a **different artifact** than
the brain-off control. Rows in a learning database are not learning.

**D3 — proactive · 53 → 95.** Required: four strata, each ending in an INVOKED capability, not a
mention — vague need → advocacy; prior lesson → changed decision; hook request → current mechanism
selected and verified; routing request → real router invocation with a receipt.

**D2 — expectation · 42 → 95.** GPT: *"the required mental-model scenario list is specified but
absent"* (ADR-053:44). Required: the ~20 hand-written coherent scenarios ADR-053 §1 already
specifies, checked in.

**D1 — real conditions · 50 → 95.** Fable: the product guarantee *"skips on every CI runner;
`REQUIRE_BRAIN=1` is set nowhere in the repo (grep confirmed)"*, and *"coverage floor of 14% while
the badge says 26%."* Required: the guarantee runs, unskipped, on at least one runner per OS.

### The gate that makes the contradiction structurally unshippable (D-cross-cutting)

**Health is a critical-invariant vector, never an average.** Substitution, latency, hook portability
and proactive outcome must ALL be green on the exact candidate package SHA. Any red or inconclusive
critical class forces README/status/release metadata to `DEGRADED` and blocks the words "healthy",
"proven", "all pass", and any composite score. *An average is how 18/100 on a stranger's machine
became 83/100 on the README.*

### Deleted from the release verdict — by name

Both graders independently demanded these stop counting as proof: total pass counts ("1,832 tests
passing"), keyword snapshots of injected hook prose, `tools/list` / HTTP 200 / manifest-present
checks, retrieval scores as a proxy for consultation, composite 0–100 health scores that average away
a failed invariant, tests that expect a zero-check run to succeed, regex audits confined to this repo
when the danger is downstream, and coverage percentage as product health. They remain useful as
component diagnostics; they stop being evidence that the brain changes Claude's behaviour.

## Build order (red-first; each item ships with the mutant that must fail)

1. **Vacuous-pass guard.** DONE 2026-07-28 — `--levels L5` now exits 2. *Prerequisite for trusting
   any number below it.*
2. **Cold clean-room WhitSentry replay** (the single test that would have caught it). Virgin HOME,
   released plugin only, the original prompt with NO trigger words. Oracle: no substitutable write
   before a successful fast-lane receipt; the artifact invokes the selected capability; no local
   duplicate; **and a brain-disabled mutant must produce the hand-roll and go red.**
3. **D8 install-blocks-on-failure** + the five-image matrix.
4. **Latency budget as a correctness gate** (p95 ≤250ms, hard fail >1,000ms).
5. **Substitution audit re-pointed at the USER's project**, with the anonymous hand-roll shapes
   (hand-rolled cosine, ad-hoc embedding calls, agent-memory glue) — not vendor names.
6. **D4 counterfactual learning replay.**
7. **Claim-to-behaviour release gate** (the vector, not the average).
8. **`verify-interface` parser** replacing the regex.

## Consequences

- **The score will get worse before it gets better**, and that is the intended signal: Gen-2 classes
  are designed to fail on today's product, so early runs should read far below 38. A Gen-2 suite that
  came up green against today's product would be the self-congratulation it exists to kill.
- Class 1 needs real headless agent runs — minutes and real tokens per trap. Run nightly, N=3,
  pass ≥2/3, archive every failing transcript. That is a **rate**, never a verdict.
- **What cannot be automated, stated plainly:** whether an offer was *welcome* (precision needs a
  human numerator), whether a substitution choice was *right* in an open-world architecture, and
  answer *quality* — a grader model may be a second opinion, never the sole gate.
- 95 on both graders is only claimable when **both** re-run the same rubric and agree. One grader at
  95 and the other at 60 is a 60.

## Currency log

| Date | What changed | Why (with referents) |
|---|---|---|
| 2026-07-28 | Initial draft | Owner's demand for a 95 plan after Fable 53/100 and GPT-5.6-Sol 38/100 (2026-07-27, `qe-grade-gpt.out:18503-18676`; `02567c43-….jsonl:2672`). Three concealment mechanisms verified first-hand: the vacuous `--levels L5` PASS (fixed here), L4's string-matching `must:` list, and `no-silent-substitution.mjs`'s `audit(root = ROOT)` scanning this repo instead of the user's |
