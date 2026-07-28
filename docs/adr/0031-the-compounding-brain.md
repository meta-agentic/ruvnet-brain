---
id: ADR-031
title: The compounding brain — rUv's corpus + the user's working knowledge + accumulated experience, made operative
status: Proposed
date: 2026-07-22
updated: 2026-07-28
authors: [Stuart Kerr, Claude Code]
tags: [learning, darwin, policy-surfaces, compounding, north-star, 4.0]
supersedes: []
relates: [ADR-027, ADR-028, ADR-029, ADR-030]
---

**Status**: Proposed (2026-07-22)

Governed DDD: `docs/ddd/0005-learning-context.md`

This is the capstone of the 4.0 set. **ADR-028** defines proactivity, **ADR-029** mines which lessons
are universal, **ADR-030** makes a lesson interrupt instead of sit — and **this** says what the brain
IS, and grounds the learning engine in rUv's shipped Darwin rather than a parallel invention.

## The thesis, in the owner's words

> *"That RuvNet brain is the storage of my knowledge of not only how Ruv likes to work but also how
> I like to work. Together, that brain is your Ruv stuff plus my knowledge plus the education plus
> the experience. Together, that gives us something that is a huge win for ongoing increases in
> intelligence that grows and compounds on a daily basis."*

The brain has been built as **one third** of that. It indexes rUv's 69 repositories and answers
questions about them. It holds none of how *this user* works, and nothing about it compounds.

| Component | Status today |
|---|---|
| rUv's corpus (69 repos, ~150k chunks) | ✅ built, queryable, kept fresh nightly |
| The user's working knowledge (how *they* work) | ❌ 736 lessons exist, trapped in 41 project silos |
| Accumulated experience (what worked, what failed) | ❌ captured, never distilled into behaviour |

A brain that knows rUv perfectly and its user not at all is an encyclopedia. The compounding only
starts when the second and third columns are real and feed the first.

## The finding that proves every claim in this document

While writing this ADR, the brain was asked — for the first time in three weeks — *"what should we
be using that we aren't?"* rather than *"am I about to duplicate something?"*

It answered immediately: `@metaharness/darwin`, per `agentic-flow/docs/adr/ADR-075` (Accepted,
shipped 2.1.0). *"Freeze the model, evolve the harness."* It mutates one of **seven policy
surfaces** — `planner`, `contextBuilder`, `reviewer`, `retryPolicy`, `toolPolicy`, `memoryPolicy`,
`scorePolicy` — sandboxes each, and keeps only what measurably improves.

Then the machine was checked, and this is the part that matters:

```
.metaharness/  — present in THIS repository, last written 2026-07-09

  gen  surface          finalScore  taskSuccess  promoted
  0    baseline           0.285         0.0        yes
  2    toolPolicy         0.765         0.6        no
  2    reviewer           0.765         0.6        no
  2    memoryPolicy       0.765         0.6        no
  3    reviewer           0.765         0.6        no
  … 16 variants across 7 surfaces, 13 with real task success
```

**Darwin ran here on 2026-07-07. It lifted the harness score 0.285 → 0.765 — a 168% improvement —
by evolving `reviewer`, `memoryPolicy`, and `scorePolicy`: the exact three surfaces this project
spent 2026-07-22 hand-building. It promoted none of them, and has sat idle for two weeks.**

Three compounding facts:

1. **0.765 is the precise midpoint published in rUv's ADR-075** (`0.765 → 0.985`). We reached the
   documented halfway mark of his measured lift and stopped there.
2. **Why nothing promoted is already diagnosed upstream.** `metaharness` ADR-087: the lightweight
   ADR-072 promotion rule is *"one sample, ceiling-bound (every safe variant scores the same), and
   trivially game-able."* Every variant here plateaued at exactly 0.765, so under that rule none
   could beat another and nothing was kept. **The fix is also already written** — ADR-087 wires a
   graded benchmark gate into `evolve()` behind an opt-in `--bench` flag, with a hash-pinned suite
   so a variant cannot rewrite the benchmark to flatter itself.
3. **`OPENROUTER_API_KEY` has been set the entire time.** The write layer was funded, installed,
   and idle.

This is ADR-027's North Star case, committed by the tool's own author, against the tool built to
prevent it — and it is the most complete evidence available that the thesis is correct.

## The root cause, stated precisely

The brain was queried **defensively** and never **offensively**.

Every consultation for three weeks was triggered by the `ground-before-write` gate: *"am I about to
duplicate something?"* That gate is excellent and fired correctly every time — including twice while
this ADR was being written. But it only ever fires when code is about to be written in rUv's domain.

**Nothing ever asked "what should we be using that we aren't?"** So the brain answered every question
put to it, perfectly, for three weeks — and the one question that would have surfaced a 168% lift
sitting in a directory in this very repository was never asked.

**Retrieval without volition is the defect, and it is the same defect in the product and in the
agent operating it.** The product waits to be asked; the agent only asks when blocked.

## Decision

### 1. The brain holds three corpora, not one

| Corpus | Home | Contents | Refresh |
|---|---|---|---|
| **rUv** | `~/.cache/ruvnet-brain/kb` (bundle) | 69 repos, source-grounded | nightly, changed repository segments refreshed; verified bundle promoted as one snapshot |
| **User** | `~/.config/ruvnet-brain/` (user data) | how this person works; promoted lessons | never destroyed by an update |
| **Experience** | AgentDB + `.metaharness/` archive | what was tried, what scored, what was promoted | append-only |

The split by *durability* is the load-bearing part. The rUv corpus is disposable and regenerable.
The user corpus is **not** — it is the only thing on the machine that cannot be rebuilt from a
download, which is exactly why ADR-030 places it outside the bundle. A lesson destroyed by
`--update` never compounds, and compounding is the entire point.

### 2. We do not build a learning engine. Darwin is the learning engine.

Our lesson store (`scripts/lesson-store.mjs`) is not a parallel invention — it is the **`reviewer` +
`scorePolicy` slice of Darwin's seven surfaces**, expressed as data. That reframing is not cosmetic:

- We supply the **objective** (what "good" means for this user), which Darwin cannot know.
- Darwin supplies the **search** (mutate, sandbox, score, promote), which we must not reimplement.
- ADR-087's graded gate supplies **anti-gaming** (hash-pinned suite, statistical promotion,
  clean-replay) — a problem we had not even recognised we had.

The corollary is uncomfortable and correct: **the 0.765 plateau is our fault, not Darwin's.** ADR-075
names the risk in plain words — *"evolution requires a trustworthy benchmark to score against; a weak
benchmark evolves toward the wrong objective."* We ran it against a benchmark with `taskSuccess: 0`
at baseline and then never looked at the result.

### 3. The brain must query itself offensively, on a schedule

The `ground-before-write` gate stays. A second, opposite motion is added: a periodic **capability
audit** that asks the brain what exists that this machine is not using, and surfaces it through the
advocacy path of ADR-027 rather than waiting for a write to be blocked.

This is the difference between a search box and a brain, restated as a mechanism instead of an
aspiration: **defensive retrieval prevents mistakes; offensive retrieval creates value.** We had
only the first.

### 4. The objective function is the user's lessons

Darwin needs a scorer. The lessons of ADR-029/030 — mined from 736 real entries, weighted by how
many times the user had to repeat each one — **are** that scorer. A harness variant that violates
a lesson taught 52 times scores worse than one that respects it.

This closes the loop and makes it self-reinforcing: repetition count becomes objective weight, so
the things the user has had to say most often become the things the harness is most strongly
optimised to stop doing.

## Deliberately NOT in this round

- **Running `evolve --bench` to break the 0.765 plateau.** It needs a curated suite with genuine
  held-out tests, and a weak benchmark evolves toward the wrong objective — the exact failure that
  produced the plateau. Building the suite is the prerequisite, and doing it badly is worse than
  not doing it.
- **Auto-promoting Darwin's winners into the live harness.** Promotion must be graded and reversible
  before it is automatic. ADR-087's gate first.
- **Merging the three corpora into one store.** They have different durability guarantees; one store
  would mean one refresh policy, and the user corpus would inherit the bundle's disposability.

## Consequences

- The brain stops being an encyclopedia about someone else and becomes a record of how *this* user
  and rUv both work, with a measured search process improving the harness between them.
- **The scariest consequence, stated plainly:** a wrong lesson now becomes an optimisation target.
  If a bad rule enters the objective function, Darwin will faithfully evolve the harness toward it.
  This is precisely why ADR-030 §5 (visible, auditable, sticky demotion) is not optional, and why
  the promotion bar is independent rediscovery rather than a similarity score.
- The 0.765 → 0.985 gap becomes a concrete, measurable roadmap item rather than a vague ambition.

## Verification (what must be true before this is Accepted)

1. ❌ The offensive capability audit runs and surfaces at least one real dormant capability the
   defensive gate never would have — with the `.metaharness` finding as the ground-truth first case.
2. ❌ A benchmark suite exists whose baseline `taskSuccess` is non-zero, so evolution has a
   trustworthy objective.
3. ❌ `evolve --bench` promotes at least one variant above 0.765 under the graded gate, reproducibly.
4. ❌ A promoted lesson measurably changes a Darwin score — proving the objective function is wired
   to the user's knowledge and not just adjacent to it.
5. ⚠️ The user corpus survives `--update` and a nightly refresh (shared with ADR-029 #3, ADR-030 #3) —
   demonstrated by isolation 2026-07-23 (unique promotion markers, no update-path writes to `CLAUDE.md`,
   idempotent), not yet by live execution. See ADR-029 #3 for the full evidence.
6. ❌ Adversarial cross-model review (Claude vs GPT-5.6) recorded for this ADR and its DDD, per the
   standing order — outstanding for ADR-027 through ADR-031 inclusive.
