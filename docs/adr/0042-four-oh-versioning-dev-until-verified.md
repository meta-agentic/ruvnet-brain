---
id: ADR-042
title: 4.0 stays X.Y.Z-dev until it is verified — the version number is not a marketing lever
status: Superseded
superseded_by: ADR-052
date: 2026-07-23
updated: 2026-07-27
updated_source: derived-from-git
authors: [Stuart Kerr, Claude Code]
tags: [versioning, release, 4.0, honesty]
supersedes: []
relates: [ADR-028, ADR-023, ADR-052]
---

**Status**: Superseded (by ADR-052, 2026-07-25)

> **Why superseded (2026-07-25):** this ADR's 4.0 gate required field-verified advocacy outcomes
> (n≥29 real offer-outcomes). Measured 2026-07-25, that gate is **structurally unreachable on a single
> machine** — `capability-audit` finds no dormant capability on a healthy setup, so the offer path
> correctly stays silent and the ledger never fills. ADR-052 replaces the *unreachable* field-outcome
> gate with a *provable* one (proactivity proven correct + user-controlled via a 1–5 dial), moves the
> n≥29 precision target to a **post-launch** metric, and holds the same honesty rule (a claim must be
> backed). The reasoning below is preserved as the record of why the gate moved.

## The decision

**The `4.0` work ships under `3.9.x-dev` version numbers until it is actually verified, and only then
becomes `4.0.0`.** The branch is named `4.0`; the *version* is not, and deliberately so. Today a user
who sees a version learns nothing false: `3.9.x-dev` says "pre-release, still moving," which is the
truth. A premature `4.0.0` would be the exact thing this project forbids — a bigger number standing in
for work that is not done (ADR-028: "a 3.5 with a bigger number on it").

## What must be true before the number becomes 4.0.0

Not a date; a checklist, each item already owned by an existing gate:

1. **Proactive L3–L5 and Learning N1–N6 are verified**, not asserted (the standing HOLD).
2. **The five acceptance metrics are measured on the ground-truth fixture machine** (ADR-028 / ADR-041):
   recall ≥ 0.80 and false-alarm = 0 as real numbers (now buildable in-fence, ADR-041); precision
   ≥ 0.60 and latency-to-surface from real ledger data (deploy-gated — needs the spine flip + real use).
3. **An independent reader grades the qualitative criterion** (ADR-028 #4) — not the author.
4. **The release channels agree** (npm, GitHub release, plugin auto-update) — the drift documented in
   `4.0-READINESS.md §4` is closed, so all three surfaces report one honest current version.
5. **The executive briefing exists** (the L15 gate).

## Why an ADR and not just a habit

Because "when does the number change" is a decision that silently drifts otherwise — someone bumps to
4.0.0 to feel finished. Writing it down makes the bump a gate with named preconditions, and makes any
premature bump a visible violation of an Accepted decision rather than a judgement call. The
version-is-the-update-signal discipline still holds *within* `3.9.x-dev`: every behaviour-changing
commit bumps the patch and syncs all surfaces (`scripts/sync-version.mjs`). This ADR governs only the
one bump that crosses from dev to stable.

## Consequences

The `-dev` suffix stays until items 1–5 are all true. This is the honest cost of the deploy-gated
ceiling: the number cannot go to 4.0.0 while the outcome loop has never run on real data, and it should
not. When it does change, it changes once, cleanly, with the briefing and the measured metrics beside it.
