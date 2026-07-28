---
id: ADR-028
title: What "proactive" means — the maturity ladder, and why a page you must visit is not proactivity
status: Proposed
date: 2026-07-22
updated: 2026-07-27
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

**L3 is PARTIAL, and the earlier claim here was FALSE — corrected 2026-07-22 07:00.**

This section previously read: *"five gates exit 1 and refuse the action — same wire, no code
change."* That is wrong, and the way it was wrong matters more than the fact.

Claude Code's hook contract — documented in this repo's own `plugin/scripts/ground-before-write.sh:33`
— is **`exit 0 = allow · exit 2 + stderr = BLOCK`**. `lesson-gate.mjs` exits **1**, writes to
**stdout**, and `lesson-hooks.sh` discards the code with `|| true` before exiting 0. Verified by
execution: the dispatcher prints the word "BLOCKED" and returns **exit 0**, permitting the action.

The proof that was cited was obtained by running the gate CLI **by hand in a terminal** — the one
caller in the system that is not a gate. This is L01 (verify through a channel CAPABLE of observing
the truth) violated by the very document that records L01, which is the second time that exact
inversion has happened in 24 hours.

A second defect compounds it: `block` is **condition-free**. The gate blocks whenever any ratified
block-lesson exists at a trigger; it reads no diff, no tool input, no stdin. So `block` can only
mean "refuse everything at this event, forever" — which is why the sole genuinely-working gate
(`version-bump-gate.sh`) carries its predicate in 60 lines of bespoke bash. The store holds the
message, never the condition.

**What is actually true today:** lessons are stored, ratified, retrieved at the right decision
point, and their text reaches a hook. Nothing refuses anything. That is L3-minus: contextual
delivery without enforcement.

**Resolution — and the defect and the philosophy point the same way.** The owner, 2026-07-22:
*"Nudging somebody is very fair. Forcing them through a gate is not."* So the fix is NOT to convert
these into hard blocks. It is to make the nudge deliberate and correct (stderr so the model actually
receives it, exit 0 so it never refuses), and to make blocking a narrow exception a user opts a
specific rule into. Governed by ADR-035.

**L4 and L5 remain unbuilt.** 4.0 is not claimable until both land with the five test classes green.

### L5 — what is now MEASURED, and what is still unbuilt (2026-07-27, ADR-058 §D4)

The sentence above stayed true for a reason worth naming: L5's falsifiable test — *"a lesson
validated in project A demonstrably changes behaviour in project B, and survives a nightly
refresh"* — had no harness, so "unbuilt" and "unmeasured" were indistinguishable. An independent
grader scored D4 36/100 with the deduction *"L5 is explicitly unbuilt. The required proof is project
A outcome changing behavior in project B and surviving refresh."*

**That proof now exists as a check, and it is a RATE, not a verdict:** `scripts/learning-replay.mjs`,
invariant name **`LEARNING-REPLAY`**, result artifact `data/learning-replay-result.json` (stating the
SHA it was measured on), consumed by `scripts/claims-verify.mjs`'s critical-invariant vector, run
nightly by `scripts/nightly-wrapper.sh` with `.github/workflows/learning-replay.yml` as the currency
gate on its freshness.

**Measured 2026-07-27, claude-haiku-4-5, FIVE independent N=3 sets (15 runs, 15 control arms,
~$0.09–0.16 and ~55–70s per set), each after a real refresh — a new Stable-Spine generation
installed and the pointer flipped between record and replay:**

| | measured |
|---|---|
| treated arm carried the token | **15/15** |
| brain-off control carried the token | **3/15** |
| lesson delivered before the first tool call (treated) | **15/15** |
| set verdicts | PASS · INCONCLUSIVE · INCONCLUSIVE · INCONCLUSIVE · **PASS** |

**Why five sets, stated so it cannot be mistaken for fishing:** every set after the first was forced
by an edit to a file in `LOAD_BEARING`, which by this harness's own currency rule invalidates the
recorded result. Sets 2–4 were shipped and committed exactly as measured, INCONCLUSIVE included —
the artifact was never re-rolled to improve it. The committed artifact today reflects set 5 because
set 5 is the one measured on the shipped code, and the row above exists so that PASS is never read
without the other four.

**The separation is clean AND the trap is invalid a large fraction of the time, and both halves of
that sentence matter.** The lesson changed the produced artifact on every single run where it was
delivered — 15/15, with the control at 3/15. But haiku reaches `--query` unaided in roughly a fifth
of control runs, and under ADR-058's aggregation (N=3, any single control success invalidates the
set) a per-run contamination rate of ~0.2 leaves the trap conclusive only ≈ 51% of nights. Three of
five sets landed INCONCLUSIVE, `claims-verify.mjs` reported each as a loud SKIP, and `--check`
exited 3. **None of those was ever a pass.**

That is the invariant working, not failing: on those nights the trap genuinely measured the model's
priors rather than the brain's delivery, and saying so is the entire point. The fix is NOT to
loosen the token to `-q`-only so `--query` stops counting — the control demonstrably reached a
correct way of passing the query WITHOUT the lesson, and crediting the lesson anyway is exactly the
self-deception invariant 6 exists to stop. The fix, when it comes, is a token whose control-side
prior is genuinely low, chosen BEFORE the runs rather than after them. **Until then, treat a green
LEARNING-REPLAY night as ~50/50 to be reportable at all — a property of this trap, not of the wire
it measures.**

**What that does NOT license.** Three things, stated so the number is not read as more than it is:

1. **It measures DELIVERY and EFFECT, not the promotion bar.** The fixture lesson is stored unscoped,
   which `lesson-gate.mjs` treats as "applies anywhere, by declaration". ADR-029's win-twice
   cross-project bar — the thing that decides which lessons EARN the right to travel — is not
   exercised by this trap. The *Compounding rate* row below (lessons promoted ÷ lessons learned) is
   therefore still unmeasured; only the *survival across a refresh* half of it is.
2. **A control that also succeeds INVALIDATES the result** (DDD-0013 invariant 6). The trap reports
   INCONCLUSIVE, never a pass — and it is structurally unable to do otherwise. Measured live: with
   the control pre-seeded, the harness reported INCONCLUSIVE and exited 3.
3. **One trap is one trap.** L5 as a LEVEL means every validated lesson compounds across every
   project; this proves one lesson did, three times out of three, on one machine, on one model.

So the honest line is: **L5's mechanism is now measurable and measured; L5 as a level is still
unbuilt.** The difference between those two sentences is the entire reason this section exists.

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
