---
id: ADR-020
title: Anti-fabrication gates — every user-facing number RE-DERIVES, no gate may string-match the thing it guards
status: Accepted
date: 2026-07-18
authors: [Stuart Kerr, Claude Code]
tags: [honesty, gates, ci, claims-ledger, coverage, adr-citation, trust]
supersedes: []
relates: [ADR-011]
updated: 2026-07-27
updated_source: derived-from-git
---

**Status**: Accepted (three gates shipped + proven on live known-bad; a fourth deferred, see below)

## Context

The owner's hardest rule for this product: **it can never lie.** A user-facing number that is
hardcoded, illustrative, or stale — but presented as measured/live/verified — corrodes trust and is
toxic. Two exhaustive honesty sweeps (2026-07-18) found six live fabrications that had shipped:

1. `README.md` "**257 passing**" — real count was **548**.
2. `README.md` coverage badge "**10% of ALL source**" — real floor was **~14.55%**, and worse, the
   gate that claimed to protect it (`claims-verify.mjs > verifyCoverageBadge`) only **string-matched**
   the literal `coverage-10%25%20of%20ALL%20source` and checked `all:true` — it **never re-derived the
   real percentage**, so it reported PASS on a false number. *A gate that cannot fail on the value it
   guards does not protect that value; it launders a false assurance.*
3. `console/tips.html` (+ `console/assets/metaharness.svg`) grounded the figure "28.5% cheaper at
   98.1% bar-compliance" in `ADR-073`, calling it an "accepted ADR" — but agentic-flow's ADR-073 is
   **Proposed** and the string "28.5%" appears **nowhere in its body**; the figure lives only in
   ADR-076 (Accepted), which merely *references* 073. False attribution.
4. `explainer/index.html` hardcoded "**56 repos**" in ~8 places (a pure count-up animation off a
   literal, no data feed) while `data/manifest.json` says built=**57**.
5. `explainer/llms.txt` said "**36 indexed repos**" on line 3 and "**57 RuvNet repos**" on line 18 —
   self-contradictory in one file.
6. `explainer/assets/diagram-s06.svg` — an orphaned (unreferenced) asset still carrying "18 building
   blocks / 75,509 chunks", a landmine if ever re-linked.

The through-line matches ADR-0011's own principle — every advertised number must regenerate from an
artifact — but the enforcement had **holes**: surfaces weren't all watched, and one gate string-matched
instead of re-deriving. Prose ("we already have a claims ledger") is not a mechanism.

## Decision

Fix all six lies (done), then close the enforcement holes with gates that **re-derive**, not string-match,
and that are each **proven to FAIL on the exact live known-bad** before it was fixed (the strongest proof
a detector works — the known-bad is not synthetic, it is the literal file content that shipped):

1. **`verifyCoverageBadge` re-derives (claims-verify.mjs).** It now reads the real
   `coverage/coverage-summary.json` (vitest v8 `json-summary` reporter, added to `vitest.config.mjs`),
   takes `floor(min of the four metrics)`, and fails if the README badge drifts >1pt from it. SKIPs
   LOUDLY (never a silent pass) if coverage hasn't been run; CI runs `test:cov` immediately before the
   ledger so the check is always real there. Self-proving test: badge "10%" vs a summary whose floor is
   14% → FAIL naming both numbers.
2. **`repo-count.test.mjs` watches the explainer.** `explainer/index.html` and `explainer/llms.txt`
   added to `SURFACES`; the existing manifest-derived detector does the rest. It immediately caught a
   *seventh* stale count ("36 of rUv's repos") that the manual sweeps missed.
3. **`adr-citation-integrity.test.mjs` (new).** When a surface puts a precise decimal figure (28.5%,
   98.1%, $0.267) next to an `ADR-NNN` citation, that ADR must (a) contain the figure verbatim in its
   own body and (b) be Accepted/Implemented — resolved across our own `docs/adr` and the upstream
   `clones/*/docs/adr`. It immediately caught an *eighth* lie (metaharness.svg still cited ADR-073) that
   a sweep agent had wrongly reported as already fixed.

## Deferred (stated honestly, not silently dropped)

A fourth, broader `fabrication-tells` catch-all (grep for animated-counter-vs-caption mismatch, the
banned word "illustrative", a "measured/verified" token near a number with no citation, orphan assets)
was **designed but not shipped**. Reason: a loose textual net over every surface is prone to false
positives, and this repo's own history says a gate that cries wolf gets disabled — which is worse than
no gate. The three gates above are deterministic and cover the exact classes that actually shipped.
Re-open trigger: a future fabrication that none of the three above would have caught.

## Consequences

- The claims ledger's coverage entry can no longer pass on a false number — it fails with the real
  floor and tells you what to write.
- Any repo-count or ADR-attributed-figure drift on a public surface is now a RED BUILD.
- CI reordered: `test:cov` runs before `claims:verify` so the coverage artifact exists for re-derivation.
- Cost: `claims:verify` now depends on a coverage run in CI (already present, just reordered).
