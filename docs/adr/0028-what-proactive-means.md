---
id: ADR-028
title: What "proactive" means — the maturity ladder, and why a page you must visit is not proactivity
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [strategy, proactivity, north-star, measurement, 4.0]
supersedes: []
relates: [ADR-027, ADR-0013, ADR-029]
---

**Status**: Proposed (2026-07-22)

Governed DDD: `docs/ddd/0004-advocacy-context.md` (extends the Advocacy bounded context)

## Why this exists

ADR-027 declared that "proactive capability advocacy is the product." It was right, and it was not
specific enough to build against. "Proactive" stayed an adjective, so it got implemented as far as
an adjective can carry you — and then stopped, at exactly the point where it still felt like a
dashboard.

The owner's challenge, 2026-07-22, is the reason this document exists: *"What does it mean to be
proactive? How much can you prove it? How did you test it? If you really figure that out, that
changes the whole game. That's a 4.0 release, not a 3.5 release."*

He is right that it is the 4.0. This ADR defines the term precisely enough that a release can be
graded against it instead of described with it.

## The failure this diagnoses

v3.5.0-dev shipped real advocacy: the brain detects dormant capability, recommends a fix, executes
it, and can reverse it. Live on the owner's machine it says, unprompted, *"36 project stores are
embedded but have never been distilled — 6,858 memories sitting in those stores, teaching nothing."*

And it still does not feel like the game changed. The reason is structural, not cosmetic:

> **The console is a page you have to visit. A surface the user must navigate to is a PULL surface.
> Advocacy that waits for you to open it is not proactivity — it is a dashboard with better copy.**

The measurement that proves the point: the capability to say that sentence existed for **21 days**
before it was said. Not because the data was missing — the console had `patterns` and `learns` on
every fleet entry the entire time — but because nothing was structurally obliged to speak.

## Decision: proactivity is a five-level ladder, and each level is a testable claim

| Level | Definition | Falsifiable test |
|---|---|---|
| **L0 Reactive** | Answers a question when asked. | A query returns a grounded, cited answer. |
| **L1 Observant** | Detects and displays machine state. | A known-bad machine renders a card describing the fault. |
| **L2 Advocating** | Detects → recommends → **executes** → **reverses**. Every finding has a remedy with a real inverse. | Every constructible recommendation id resolves to exactly one working executor and one real undo. |
| **L3 Contextual** | Speaks **inside the user's working session**, at the moment of relevance — never requiring navigation to a page. | A dormant capability relevant to the current task surfaces in-session, without the user opening any surface. |
| **L4 Anticipatory** | Infers the user's **goal** and surfaces the capability that serves *that* goal before they hit the wall. | Given a stated task with a known better RuvNet path, the brain names that path before the user commits to the worse one. |
| **L5 Compounding** | Learns whether its own advocacy was right, and **promotes validated lessons to a global store** so every project inherits them. | A lesson validated in project A demonstrably changes behaviour in project B, and survives a nightly refresh. |

**Where we are: L3, as of v3.7.0-dev** (updated 2026-07-22 05:40). L0–L2 shipped earlier.

**L3 landed** and is the one level with a falsifiable proof rather than a description:
`scripts/lesson-gate.mjs` consults the lesson store at a decision point, and
`scripts/lesson-ratify.mjs` is the human control over what may enforce. Measured end to end —
before ratification the ship gate exits 0 (informs); after the owner ratified, five gates
(ship, assert-fact, write-code, claim-done, mutate-machine) exit 1 and **refuse the action**.
Same wire, no code change: enforcement is data.

**L4 and L5 remain unbuilt.** 4.0 is not claimable until both land with the five test classes green.

**4.0 is defined as L3 + L4 + L5 shipped and measured.** Not L2 polished. This is the entire content
of the version decision, and it is why v3.5.0-dev was deliberately not called 4.0.

## The measurement framework (proactivity becomes numbers or it is marketing)

Every claim of proactivity must be reducible to these five. They are the acceptance criteria for 4.0.

| Metric | Definition | Target | Why it is the honest one |
|---|---|---|---|
| **Precision** | recommendations acted on ÷ recommendations fired | ≥ 0.60 | Below this we are nagging, and a nag trains users to ignore the real alarm. |
| **Recall** | dormant capabilities surfaced ÷ dormant capabilities actually present | ≥ 0.80 | Requires a ground-truth fixture machine — without one, recall is unmeasurable and any claim about it is fabrication. |
| **Latency-to-surface** | time between a capability becoming dormant and the user being told | hours, not weeks | The 21-day baseline is the number this whole project exists to destroy. It is the single best summary metric. |
| **False-alarm rate** | recommendations fired against a verified-healthy machine | **0** | One false alarm costs more trust than ten true ones earn. Non-negotiable. |
| **Compounding rate** | lessons promoted to global ÷ lessons learned, and survival across a refresh | > 0, and survival = 100% | L5's only honest proof. A lesson that does not survive an update was never global. |

### The test taxonomy every level must pass

The owner's requirement, verbatim: *"tested like crazy until it passes, not at a low level but at a
high level, at a medium level, at a low level, at a qualitative level, at a numeric level."* That is
five distinct obligations, and they are not interchangeable:

1. **Unit (low)** — pure functions: does the detector fire on the right input? Table-driven, no I/O.
2. **Integration (medium)** — does the executor actually change the machine, measured before/after
   by an independent tool, not by its own exit code?
3. **End-to-end (high)** — does a real user path, from a cold start, produce the advocacy and let a
   person act on it? Run against real stores, never mocks.
4. **Numeric** — do the five metrics above hit target on a fixture machine with known ground truth?
   A metric without a ground-truth fixture is an opinion.
5. **Qualitative** — read the sentence out loud. Would a competent engineer who did not build this
   find it useful, correct, and non-condescending? This one has no assertion and cannot be
   automated; it is graded by an independent reader, per the standing rule that we never grade our
   own work.

A level is not "done" until all five pass. Historically this project has shipped on (1) and (2) and
called it proven — which is exactly how a recommendation with no executor survived to production.

## Anti-goals (the ways proactivity destroys itself)

- **Nagging.** A recommendation fires once per state change, is dismissible, and never re-fires while
  dismissed. Frequency is a feature with a hard ceiling, not a dial to turn up.
- **Evangelism.** This is *goal-aware capability matching*, not selling RuvNet. Recommending a tool
  to someone whose problem it does not fit is the same failure in the opposite direction, and it is
  the faster one, because it is indistinguishable from salesmanship.
- **Interruption without an off switch.** L3 speaks in-session; anything that speaks in-session must
  be silenceable in one action, permanently, without penalty.
- **Fabricated urgency.** Severity is derived from measured evidence on this machine. Nothing is
  IMPORTANT because it would be good for adoption.

## Consequences

- The version line is now unambiguous: 3.x is L2. 4.0 requires L3+L4+L5, each with all five test
  classes green and the five metrics measured on a ground-truth fixture.
- We owe a **fixture machine** — a reproducible environment with known dormant capabilities — before
  recall or false-alarm rate can be claimed at all. This is the first build item, because without it
  every subsequent number is unfalsifiable.
- L5 is specified separately in ADR-029, and is explicitly a **wiring** job: rUv already ships
  cross-project promotion (`agentic-flow` `hook_transfer`, `agentic-qe/src/learning/
  pattern-promotion.ts`, and ruflo ADR-G008's "win twice to promote" policy). We do not build a
  promotion engine.

## Verification (what must be true before this is Accepted)

1. The ladder is used to grade an actual release, and the grade is published in the README rather
   than asserted in a commit message.
2. A ground-truth fixture machine exists and produces a real number for recall and false-alarm rate.
3. Latency-to-surface is instrumented and reported — the 21-day baseline is recorded, and a current
   value is measurable.
4. An independent reader (not the author) grades the qualitative criterion.
5. This ADR and its DDD survive an adversarial cross-model review, per ADR-027 principle 6 — which
   ADR-027 itself has still not done, and which is why ADR-027 remains Proposed.
