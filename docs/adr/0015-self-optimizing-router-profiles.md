---
id: ADR-015
title: Per-user self-optimizing model + reasoning-effort router profiles (development & production), configurator-driven
status: Proposed
date: 2026-07-15
authors: [Stuart Kerr, Claude Code]
tags: [metaharness, routing, cost, reasoning-effort, onboarding, configurator]
supersedes: []
relates: [ADR-013, ADR-014]
---

**Status**: Proposed (near-term slice — router-optimizer engine, ongoing utilization view, per-house personalized frontier, console panel — shipped through v3.0.4; full weekly self-optimizing engine remains proposed)

**v3.0.4 (2026-07-15):** the router now reads each user's HOUSE frontier from the live-verified catalog
(ADR-0016) — Claude shop → Fable 5, ChatGPT/Codex → GPT-5.6 Sol, Gemini → 3.1 Pro, Grok → 4.5, detected
or set in the console — so the escalation target and savings baseline are personalized, never one house
for everyone. Reasoning-effort defaults corrected to `high` (xhigh is opt-in for hard verifiable tasks
only) from independent evidence that efficiency inverts before max. Console shows the detected house + a
selector, and explains that the frontier stays in-house while cheap/mid route cross-provider for the
saving.

## Status

**Partially implemented — v3.0.1–v3.0.2 (2026-07-15).** The near-term slice SHIPPED:
`scripts/router-optimizer.mjs` (computes two dev/production profiles from rUv's measured bench +
this repo's verified live prices + the user's receipts), the **collapsed console panel** that displays
them (band → model → effort → cost → why, measured-vs-default tags, OpenRouter-key-aware), and the
**explainer's configurator preview**.

**v3.0.2 adds the ongoing utilization view** (`scripts/router-utilization.mjs`) — the shape rUv
specifies in ruflo **ADR-149 §6**: per-band task **distribution** (`modelDistribution` — "how many
tasks landed in each bucket") and **`costOptimalitySaved`** (realized spend vs. sending every task to
the frontier). It reads the real receipts ledger, makes no model/network call, and recomputes the
frontier counterfactual for every receipt against the **current frontier model from each receipt's own
token counts** — so the savings figure is never a stale number.

Also in v3.0.2: the **frontier band is Fable 5** (`claude-fable-5`), which leads the Claude 5 family
(2× Opus 4.8 per token). It is both the escalation target in the router profiles and the "instead-of"
baseline the savings are measured against. rUv's own SWE-bench cascade numbers on the explainer keep
their cited Opus baseline — a separate, historical measurement — and are unchanged.

Honest limits shipped with it: the profile is recomputed live on each console open (no scheduled job
yet), the reasoning-effort axis is principled *defaults* (no per-effort measurement exists in the
corpus), and mechanical/frontier bands read 0 until a task actually lands there (shown honestly, never
padded). The **full weekly self-optimizing engine** (a scheduled re-benchmark, the effort-axis
*optimization*, and band-discovery from a live BenchPress/ADR-206 signal) remains **Proposed** — this
ADR is its plan of record.

Captures a feature Stuart specified for the Onboarding Console (ADR-013): an **opt-in, weekly,
per-user** job that computes the optimal *(model, reasoning-effort)* pair per task bucket —
**separately for development and production** — from live pricing + public capability data, and
surfaces it in the configurator with a single on/off switch and a plain-English "here's what it chose"
view.

## Context

### What Stuart asked for
- Show the routing **buckets** and the chosen model per bucket — not just a savings number.
- Optimize not only *which model* but **how much reasoning** to spend (low / medium / high / xhigh /
  max). The cost/quality variance across effort levels is large and currently unexploited.
- Recognize two economically distinct contexts:
  - **Development** — work runs on the user's Claude Code subscription (Pro/Max); marginal token cost
    is ~zero, so the objective is throughput / staying under rate limits / speed.
  - **Production** — AI embedded in the user's own application; every call is metered API spend, so
    the objective is $/quality.
- Re-evaluate on a schedule (Stuart: weekly), because models, prices, and capabilities change constantly.
- Do it **per person, based on what they can access** (their keys/plans) — which is why the console
  asks for an OpenRouter key, with a one-click path to create one if they don't have it.

### What rUv already ships / has designed (grounded)
- **`@metaharness/router@0.3.2`** (installed) + the **cost-cascade** (`open-claude-code/v2/src/optimize/router.mjs`):
  route each task to the cheapest model that clears a quality bar; escalate on predicted/actual failure.
- **Opt-in self-optimization** (`open-claude-code/v2/src/optimize/cascade.mjs`): `SelfOptimizeCascade`
  is opt-in (`--self-optimize` / `selfOptimize` setting), default OFF, records outcomes so routing
  self-tunes; `buildLadder(settings)` honors a per-user `selfOptimizeLadder`. This is the pattern the
  on/off toggle rides.
- **Measured per-tier picks** (`ruflo/v3/@claude-flow/cli/assets/model-router/openrouter-alts.json`,
  ADR-148, benched 2026-06-15): cheap→Ling-2.6-flash (151× cheaper than Haiku), mid→GPT-4.1 (higher
  quality, 4× cheaper than Sonnet); live prices re-verified 2026-07-13 in this repo's `route-cheap.mjs`.
- **The "research the model landscape" engine is already rUv's design**: `metaharness` **ADR-206**
  (Proposed, 2026-07-02) — a BenchPress-style low-rank predictor over an **84-model × 133-benchmark
  public score matrix** (SWE-bench, Aider, LiveCodeBench, Codeforces…) predicting a model's full
  scorecard from ~5 probe scores, fed by **an hourly OpenRouter watcher for new releases**, with a
  conformal confidence gate. This is essentially Stuart's "look at the sites that measure models and
  keep the picture current, cheaply."
- **Per-model cost-optimal routing** (`ruflo` **ADR-149**, Proposed): drop the 3-tier abstraction;
  route to the cheapest candidate across all models; re-measurement proposed **quarterly**.

### What is NOT yet shipped / is novel here (honesty)
- **Reasoning-effort as an optimization axis** is not a shipped rUv surface. The "model as an evolvable
  surface" thesis (ADR-145) and the reasoning-strategy selector (agentic-flow `reasoning-optimized`)
  are adjacent, but *"optimize effort-level per (model, bucket)"* is a **new axis this ADR adds** —
  principled (another lever on the same cost/quality Pareto), but ours, not rUv's.
- **A per-user, dev-vs-production dual profile refreshed weekly** is our composition. rUv's cadence is
  hourly-detect + on-demand-place + quarterly-full-remeasure; **weekly is our chosen refresh** for the
  user-facing profile, between "detect" and "full remeasure."

### How many buckets? (Stuart's question — grounded, and rUv's answer is "don't fix it")

rUv's own thinking on tier/bucket count has *moved*, and the trajectory is the answer:

- **ADR-026 → 3 tiers** (haiku / sonnet / opus) — the original.
- **ADR-051 (agentic-qe) → 5 tiers** — adds **Tier 0: Agent Booster** (<1 ms, **$0**, mechanical
  transforms via Rust/WASM — *skip the LLM entirely*) at the bottom, plus a "Sonnet Extended" band.
- **ADR-142 (ACCEPTED, shipped v3.10.9) → 3 complexity bands *for learning*** (`low` <0.4, `med`
  0.4–0.7, `high` ≥0.7), banded from a **continuous** `analyzeComplexity().score` 0..1 so failures on
  a hard task don't suppress a model on trivial ones.
- **ADR-149 (Proposed) → drop the tier abstraction entirely.** The decisive line: *"tier_label is
  metadata, not control flow."* The router picks *"the cheapest candidate predicted to clear the
  [quality] bar, across all candidates, not bucketed by tier."* Fixed bucketing **forecloses Pareto
  wins and throws away signal.**

**Conclusion (what goes in the design):** there is **no fixed "right N"** for the *decision* — the
decision is a **quality-bar over a continuous complexity score**, choosing the cheapest *(model,
effort)* that clears it. Buckets survive only as **(a)** a small set of **learning bands** (rUv's
shipped default is **3**: low/med/high) and **(b)** a **human-legible display** grouping. The one
genuinely distinct extra band worth surfacing is **Tier 0 — "mechanical, $0, no LLM"** (ADR-051),
because it is categorically different from "a cheaper model." So the optimizer must **not assume a
number** — it should **discover the effective bands from the user's own measured data** (the points on
the complexity axis where the optimal *(model, effort)* actually changes — the "knees" in the Pareto)
and display those. That typically lands at ~3–4 (mechanical-$0 / cheap / mid / frontier), but the
*data* sets it, per user, per context.

### Does development differ from production? (grounded)

The **complexity axis is the same** — a hard task is hard wherever it runs. What differs is **the
objective and the candidate pool**, which is exactly why the two profiles can land on a *different
number of distinct bands*:
- **Development** (subscription, marginal-$ ≈ 0): objective is latency / throughput / rate-limit
  headroom. Tier 0 ($0 mechanical) and free/local models (ONNX, OpenRouter `:free` tiers) matter most;
  cheap bands proliferate because "free and fast" is the whole game.
- **Production** (metered API, reliability-weighted): objective is $/quality with a reliability floor.
  Cheap bands often *collapse* — a model that clears the bar *every time* beats squeezing the last cent
  — so a production profile may show *fewer, sturdier* bands.

## Decision

Build, as an **opt-in** console feature, a **Router Profile Optimizer**:

1. **Two profiles per user** — `development` (objective: latency/throughput on the subscription;
   marginal-$ ≈ 0) and `production` (objective: $/quality on metered API). Each profile is a map
   `bucket → { model, effort, why, measuredAt }`.
2. **Buckets are discovered, not assumed.** The optimizer finds, from the user's measured data, the
   points on the continuous complexity axis where the optimal *(model, effort)* changes, and displays
   those bands (typically ~3–4: mechanical-$0 / cheap / mid / frontier). It seeds from rUv's shipped
   3-band complexity keying (ADR-142) plus a Tier-0 mechanical band (ADR-051), then lets the data move
   the boundaries. **Development and production are optimized separately and may surface a different
   band count** (see Context above).
3. **Inputs (the "research")** — (a) OpenRouter live model catalog + prices (`/models`, already used by
   `route-cheap.mjs`); (b) the measured table (`openrouter-alts.json`) + our own routing receipts;
   (c) when rUv's ADR-206 lands, its BenchPress predictor for public-leaderboard capability signal.
   Until then, use the measured table + receipts + live prices — **no fabricated capability numbers.**
4. **Effort axis** — for each candidate, pick the cheapest *(model, effort ∈ {low,medium,high,xhigh,max})*
   that clears the bucket's quality bar. Cold-start from conservative defaults; tighten from recorded
   outcomes (the cascade's `statsFor`).
5. **Access-aware** — only recommend models the user can actually reach (their keys/plans). No
   OpenRouter key ⇒ recommend subscription/Anthropic-only picks and surface the get-a-key path.
6. **Weekly job** — an opt-in scheduled run (extend `calibrate-router.mjs`) recomputes both profiles,
   stamps `measuredAt`, writes them to the user config. Never auto-applies beyond writing the profile
   the router reads; fully reversible.
7. **Configurator surface (ADR-013 console)** — in the MetaHarness card: a single **on/off** ("Let
   RuvNet Brain keep my routing optimized — re-checks weekly"), the **two profiles shown as buckets**
   (model + effort + why + "last evaluated <date>"), the **OpenRouter key** field (exists) plus a
   **"Don't have one? Create a key →"** deep-link to `https://openrouter.ai/keys`.

## Non-goals
- Not a per-request router (that is the cascade / `@metaharness/router`); this computes the *profile*
  the router uses.
- Not gold-scored capability claims; capability numbers come from measured data or rUv's
  confidence-gated predictor, never fabricated.
- Not auto-spending: the weekly job uses free OpenRouter `/models` metadata + recorded outcomes by
  default; any paid probe benchmark is a separate, explicitly-gated opt-in.

## Verification (so it is real, not theater)
1. Both profiles are written to config with a real `measuredAt` and are visibly different (dev vs
   production pick different model/effort where the economics differ).
2. Turning the toggle off removes the profile; the router falls back to defaults — proven by diffing config.
3. The "last evaluated" date on the card equals the last real job run — never a hardcoded string.
4. Recommendations only ever include models the user's keys can reach (access-aware test).

## Consequences
- Delivers "see what's chosen, dev vs production, one switch" cleanly and honestly.
- Depends on rUv's ADR-206 for the richest capability signal; degrades gracefully to the measured
  table until it lands.
- Adds `reasoning-effort` as a first-class tunable — a novel, testable lever.

## Sequencing
- **Near-term (fits ADR-013 console / v3.x):** the *display + controls* — buckets panel (from the
  already-measured table), the weekly-optimize on/off toggle, and the "Create a key →" link. Honest
  because it shows measured data + a real toggle, and says "last measured 2026-07-13".
- **Larger build (this ADR proper):** the weekly optimizer engine + the dev/production dual profile +
  the effort axis + access-aware selection. Lands as its own scoped effort; consumes ADR-206 when shipped.
