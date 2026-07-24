---
id: ADR-044
title: The Self-implementation benchmark is rUv's graded gate (evolve --bench), never a hand-rolled one
status: Proposed
date: 2026-07-23
updated: 2026-07-23
authors: [Stuart Kerr, Claude Code]
tags: [self-implementation, metaharness, darwin, benchmark, evolve, no-hand-roll, 4.0]
supersedes: []
relates: [ADR-031]
---

**Status**: Proposed (2026-07-23)

Governed DDD: none — this wires an existing rUv tool into an existing detector; no new domain model.

## The problem, grounded (not recalled)

The Self-implementation pillar's top deduction is that `evolve` promotes nothing: every variant plateaus
at the same score, so the promotion rule cannot choose between them. `scripts/capability-audit.mjs:148`
already names the fix in prose — *"a graded benchmark gate rather than more evolution"* — but nobody had
established what that gate IS. The temptation was to **build a benchmark**. That would have been the
project's worst failure.

**A `search_ruvnet` deep-dive (2026-07-23) settled it against rUv's real source:**

- **rUv already shipped the graded gate.** `metaharness/docs/adrs/ADR-087-darwin-graded-promotion-wired-into-evolve.md`
  is **Accepted/implemented**: `@metaharness/darwin`'s `evolve --bench <suite.json>` runs each child through
  `evaluateChildAgainstParent` with a five-gate scorer and a seeded-bootstrap statistical promotion rule
  (`metaharness/docs/adrs/ADR-076-...`). The plateau we measured is the *documented* symptom of the
  **lightweight** path (ADR-072): *"every safe variant scores 0.985,"* ceiling-bound, no gradient.
- **Our run confirms the diagnosis.** `.metaharness/` here holds `archive.json`, `lineage.json`, `runs/`,
  `variants/` — but **no `bench.json`.** The 2026-07-07 Darwin run used the lightweight scorer; it was never
  given a suite. That is exactly why it plateaued.
- **Hand-rolling a suite is not just wrong, it fails rUv's own check.** `rupixel/docs/BENCH.md`:
  *"`.metaharness/bench.json` must be darwin-generated, not hand-authored"* — `darwin bench create` stamps a
  `taskHash`, and `bench verify` **rejects any hand-edited suite as "tampered."** A hand-rolled benchmark
  would be the impersonation sin (§`feedback_never_impersonate_ruv_tools`) AND would be rejected on replay.

## Decision

**Do not build a benchmark. Wire in rUv's.**

1. Scaffold a valid, hash-pinned suite with rUv's tool: `npx @metaharness/darwin bench create .` → writes
   `.metaharness/bench.json` (its `taskHash` makes it tamper-evident).
2. Re-run evolution through the graded gate: `npx @metaharness/darwin evolve . --bench .metaharness/bench.json`
   — ADR-087's statistically-grounded promotion replaces the lightweight single-run delta, so variants get a
   real gradient and the best is promoted on a defensible win (child > parent + 0.05, lower-95% bootstrap > 0,
   hidden tests up, zero safety violations, clean replay).
3. `scripts/capability-audit.mjs` already reads `.metaharness/` results — extend it to read the graded
   `runs/<childId>.bench.json` / promotion decisions so the audit reports the *graded* promotion, not the
   lightweight plateau.

## The honest gate (why this ADR ships before the run does)

The `evolve --bench` run is **not free and not silent**, and this repo's fence + the $1,600 agentic-qe burn
(`feedback_inventory_before_you_buy`) mean it is flagged, not fired blind:

- **Tool access.** `npx @metaharness/darwin` is a network install; it was **denied** in this environment on
  2026-07-23. Running it needs the owner to allow the install (or have it installed).
- **Cost.** `evolve --bench` runs three test commands (public/hidden/regression) per task per variant per
  generation, and `capability-audit.mjs:167` notes the write/evolve layer needs an `OPENROUTER_API_KEY`.
  This is a real paid loop — its scope (generations × children × seeds) and a cost ceiling must be set with
  the owner before it runs.
- **Hidden tests are human-curated.** ADR-076 is explicit: `bench create` scaffolds the structure, but the
  held-out tests that make the gate meaningful are real authoring work.

## Verification (before Accepted)

1. `bench create` produces a `.metaharness/bench.json` that `bench verify` accepts (hash OK).
2. `evolve --bench` produces **differentiated** `finalScore`s across variants (the plateau is gone) and a
   `PromotionDecision` per child.
3. `capability-audit.mjs` reports the graded promotion and no longer says "all plateaued."
4. Fable-5 × GPT-5.6 duel recorded — lighter-weight here because the core decision (use rUv's accepted
   ADR-087 gate, do not hand-roll) is grounded in rUv's source, not a novel design; the duel's job is to
   red-team the suite scope, cost ceiling, and the capability-audit wiring.

## Consequences

This is the one Self-implementation lever that is genuinely code/tool-gated rather than deploy-gated — but
"code" here means **wiring rUv's tool + curating held-out tests + authorizing a paid run**, not writing an
evolve engine. Recording it now so the grounding (which prevented a hand-roll) is not lost, and so the run
is a deliberate, costed decision rather than a 5am slam.
