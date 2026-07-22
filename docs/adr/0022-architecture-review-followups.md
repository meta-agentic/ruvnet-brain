---
id: ADR-022
title: Architecture-review follow-ups — what was fixed now, and what is deliberately deferred (with reasons)
status: Accepted
date: 2026-07-18
authors: [Stuart Kerr, Claude Code]
tags: [architecture, tech-debt, host-model, console, proactivity, honesty]
supersedes: []
relates: [ADR-020, ADR-021, ADR-013, ADR-014]
updated: 2026-07-18
---

**Status**: Accepted (this ADR is the honest record; the deferred items are tracked here, not dropped)

## Context

A rigorous architectural review (2026-07-18) generalized ~14 downstream-reported issues into ~5 root
patterns, all filed by a single consumer running on a machine whose layout differs from the author's:

1. **"My machine is the world"** — scripts hardcode the author's layout and treat absence as "0" rather
   than "not detected here" (#4/#6/#17/#18/#19/#22).
2. **UI outruns the data pipeline** — a rendering ships before its feeder is wired, then the gap is
   filled with a fabricated or hardcoded value (#15/#16/#20/#21).
3. **Gates parse structured input with regex over the whole command** (#12/#13/#17).
4. **ADR drift** — status labels asserted, not proven; frontmatter disagreeing with body.
5. **Per-turn context tax** — overlapping gates re-inject the same standing guidance every turn.
6. **META-ROOT: one-off remediation** — each bug fixed in the one file the reporter named, no shared
   module, no class-level regression fixture, so the class survives to generate the next ticket.

## Decision — fixed now (this session)

- **Pattern 2 / honesty:** all 8 live fabrications ripped out; three RE-DERIVING gates that prove-fail on
  the live known-bad (**ADR-020**): coverage badge, repo-count surfaces (now incl. the explainer),
  ADR-citation integrity.
- **Pattern 3:** one shared `hook-input.mjs` JSON parser; `design-wall.sh` + `verify-interface.sh` ported
  onto it; the live design-wall fail-open fixed (**ADR-021**).
- **Pattern 4:** ADR-0013's Implemented-vs-Proposed self-contradiction reconciled.
- **Pattern 5:** per-turn injection cut ~37% (measured 1491→937 tokens/build-turn); the hardcoded,
  ungrounded substitution numbers removed; the grounding gate's false-positive on its own guidance hooks
  fixed.

## Decision — deliberately deferred (tracked, with reasons — NOT silently dropped)

1. **`host-model.mjs` shared env resolver (Pattern 1 / 6).** The review's highest-blast-radius fix:
   consolidate npm-prefix / project-root / repo-identity / install-channel resolution into one module all
   scripts import, so an empty result renders "not detected here", never "0".
   **Deferred because:** the underlying bugs (#4/#6/#17/#18/#19/#22) are *already individually fixed* — this
   is preventive consolidation, not a live defect. The refactor touches `stack-sync.mjs` and the console
   (`onboarding-console.mjs`), which crashed for 100% of users once (#15); doing it safely needs a headless
   "not-the-author's-machine" CI harness built first (synthetic HOME, npx-only, plugin-only), and that
   deserves careful daytime work, not a 3am rush. The one latent instance (`onboarding-console.mjs:742`
   hardcoded `~/Code` fallback) is verified unreachable in practice (guarded upstream by
   `currentValidIds()` re-derivation). **Next step:** build the headless harness, then extract the module.

2. **Console auto-detection of ABSENT rUv tools (the "recommend what's missing" mandate).** The console
   shows your installed stack + currency today; it does not yet surface tools you're *missing*.
   **Deferred because:** the ingredient exists — `stack-sync.mjs` already has the "what SHOULD be installed"
   table — so the mechanics are a small add (diff table vs installed, emit absent + install command). The
   hard part is *design, not code*: a blanket "you're missing ruflo, agentic-flow, …" list would be PUSHY
   and noisy, violating the nudge-don't-force principle. The recommendation must be relevance-weighted
   (offer what would help this user, leaned-in, never forced). Until that's designed, the tips page states
   the install OPTIONS honestly (marketplace / `npm i -g` / `npx`) rather than the product over-claiming.
   The tips text was explicitly softened this session to NOT claim auto-detection the console can't do.

3. **`fabrication-tells` catch-all gate.** Designed in ADR-020, deferred there: a loose textual net is
   false-positive-prone, and a gate that cries wolf gets disabled. The three deterministic gates cover the
   classes that actually shipped.

4. **Split the console monolith** (`app.js` 2,294 LOC, `onboarding-console.mjs` 939 LOC — gather mixed with
   render, the structural cause behind the #15/#16/#20/#21 cluster). A large, higher-risk refactor;
   sequence it after `host-model.mjs` and the headless harness exist.

## Consequences

- The deferred items are now a written, reasoned backlog — not vibes, and not silently abandoned. Each
  names the concrete next step and why it wasn't rushed.
- The template for all of them is the distribution fix that was already done RIGHT (ADR: release.mjs +
  pre-push `verify-channels`): a mechanism, not a promise. Apply the same instinct when these are picked up.
