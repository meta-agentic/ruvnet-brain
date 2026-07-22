---
id: ADR-030
title: Latent knowledge is not knowledge — few gates, many lessons, retrieved at the decision point
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [learning, enforcement, gates, context-budget, compounding, 4.0]
supersedes: []
relates: [ADR-027, ADR-028, ADR-029]
---

**Status**: Proposed (2026-07-22)

Completes the 4.0 trilogy: **ADR-028** defines what proactive means, **ADR-029** mines which lessons
are universal, and **this** is how a promoted lesson actually changes behaviour instead of becoming
one more paragraph nobody acts on.

## The critique this exists to answer

The owner, 2026-07-22, and it is the sharpest thing said in the entire project:

> *"Knowledge you don't use, knowledge you don't leverage every time, knowledge you're not
> consistent with, is not knowledge. Latent knowledge and knowledge are two very different things.
> You've told me a dozen times, 'Oh, I knew it was there, I just didn't follow it,' which tells me
> that's a worthless strategy."*

He is describing a measurable fact, not a feeling. **ADR-029 would be worthless without this
document**: mining 284 lessons and writing them into a file that gets read past produces a longer
file and identical behaviour.

## The measurement that decides the architecture

From a single session (2026-07-21/22), sorted by what actually happened:

| Knowledge form | Instances | Complied? |
|---|---|---|
| `ground-before-write` gate | 3 | **3/3** — stopped a hand-roll every time |
| `verify-interface` gate | 1 | **1/1** — blocked a guessed CLI flag |
| `narrative-version` gate | 1 | **1/1** — forced the release story to be written |
| `sync-version --check` gate | 1 | **1/1** |
| no-hardcoded-version gate | 2 | **2/2** — caught the author's own test fixtures |
| **CLAUDE.md prose: "bump the version on any behaviour change"** | 6 commits | **0/6** — the owner caught it |
| **Memory file: "thank contributors personally"** | 2 issues | complied, but the owner still had to ask |

**Gates: 8/8. Prose: 0/6 on the load-bearing one.** The same model, the same session, the same
stated intentions. The only variable was whether the knowledge could interrupt.

This is ADR-027's finding — *"knowledge that does not interrupt does not act"* — reproduced under
controlled conditions, and it settles the storage question: **a lesson's tier determines whether it
is latent or active, and prose is the latent tier.**

## The constraint that rules out the obvious fix

The naive response is a gate per lesson. The owner pre-empted it, correctly:

> *"The answer can't be implementing a thousand hooks, because all that's going to do is clog my
> context. There has to be a more elegant architecture."*

He is right on both counts. 284 lessons at roughly 150 tokens each is **~42,000 tokens** — more than
the working context of most sessions, spent before a single word of the actual task. And a
per-lesson hook file is unmaintainable within a month.

## Decision

### 1. Gates are per DECISION POINT, not per lesson. There are five.

Behaviour only goes wrong at a small number of moments. The gate count is **fixed forever** — it does
not grow with the lesson count, which is the entire trick.

| # | Decision point | Hook | The question it forces |
|---|---|---|---|
| 1 | Before writing code | `PreToolUse(Write\|Edit)` | "Does rUv already ship this? Is it grounded?" |
| 2 | Before claiming done | `Stop` / pre-response | "Did you RUN it, or are you asserting?" |
| 3 | Before shipping | `pre-push` | "Version bumped? Docs current? Both suites green?" |
| 4 | Before answering | `UserPromptSubmit` | "Did you recall prior decisions on this?" |
| 5 | After finishing work | `PostToolUse` / `SessionEnd` | "State checkpointed? People thanked? Lesson captured?" |

Four of these hooks **already exist** in this project. This is not new infrastructure; it is giving
the existing hooks a lesson store to consult.

### 2. Lessons are DATA the gates read — never code

A promoted lesson is a row, not a file. Each carries the decision point it belongs to, so a gate can
ask for exactly its own moment's lessons and nothing else.

Adding a lesson therefore adds **zero** files, **zero** hooks, and zero maintenance. The system
scales in the dimension that grows (lessons) and stays fixed in the dimension that costs (gates).

### 3. Retrieval at the decision point, not bulk loading — this is the context answer

A gate injects the top 2–3 lessons **relevant to that moment**, retrieved semantically from the
personal brain. Not all 284.

| Approach | Context cost | Verdict |
|---|---|---|
| All 284 lessons in CLAUDE.md | ~42,000 tokens | impossible |
| Today: ~21 hand-written global rules | ~3,000 tokens | current baseline |
| **Constitutional 7 + 3 retrieved per gate** | **~1,450 tokens** | **cheaper than today** |

The architecture that makes behaviour *more* consistent also makes context *smaller*, because
relevance beats volume. That is the elegance the owner asked for, and it is why "retrieve at the
moment" is load-bearing rather than a nicety.

### 4. Three tiers, chosen by the job — not one store for everything

| Tier | Home | Holds | Job |
|---|---|---|---|
| **Corpus** | `~/.cache/ruvnet-brain/personal.rvf` | every promoted lesson, embedded | semantic recall at a decision point |
| **Constitution** | `~/.claude/CLAUDE.md` (fenced) | ~7 always-true rules | always-on, cheap, human-editable |
| **Enforcement** | 5 existing hooks | no lessons of their own | converts latent → active |

The personal RVF store answers the owner's direct question ("can you put it in a personal RuvNet
brain?"): **yes, and it is the right home** — because it is **user data outside the shipped bundle**,
which is precisely what makes a promoted lesson survive `--update` and the nightly refresh
(ADR-029 §5). A lesson stored in the bundle would be destroyed by the next release; that is not a
detail, it is the difference between compounding and starting over.

But the RVF store alone cannot make anything comply — it is a pull surface. Storage and enforcement
are different problems, and conflating them is how a lesson becomes latent.

### 5. Every promoted lesson is visible and reversible — one screen, one click

The owner's requirement: *"I should be able to see them all at a global level, and I should be able
to go delete any ones you thought were global but are really project-based."*

Non-negotiable, because ADR-029's promotion bar is evidence-based but not infallible — a keyword
cluster can absolutely lift something local. So every promoted lesson shows:

- its text, and the **decision point** it fires at
- **provenance**: which projects independently taught it, and how many times
- **demote**, which removes it from the constitution and marks it project-scoped so it is never
  re-promoted by a later mining run

Demotion must be **sticky**. A one-click demote that the next nightly mine silently undoes is worse
than no demote at all, because the user will stop trusting the control and, correctly, stop using it.

## Why this is the compounding loop, finally closed

```
  work happens
      ↓
  lesson captured                     (project memory — already automatic)
      ↓
  learned in a 2nd project            (ADR-029: independent rediscovery = evidence)
      ↓
  promoted to the personal brain      (survives updates: user data, outside the bundle)
      ↓
  retrieved by a gate at the moment   (THIS ADR: latent → active)
      ↓
  behaviour changes, in every project
      ↓
  outcome observed → demote if wrong  (the loop's error-correction)
```

Every previous attempt broke at the fourth arrow. Everything up to "promoted" already existed in
pieces; nothing turned a promoted lesson into an interruption, so nothing changed behaviour.

## Anti-goals

- **A gate per lesson.** The gate count is fixed at the number of decision points. If it starts
  growing with the lesson count, this design has failed and should be reverted, not extended.
- **Injecting everything "just in case."** A gate that injects 20 lessons is a gate people learn to
  ignore, and an ignored gate is prose with extra latency.
- **Silent promotion.** A rule the user cannot see, audit, and delete is a rule imposed on them.
- **Blocking on soft preferences.** Only non-negotiables block. Preferences are *injected as
  context*; taste that refuses to let you work is a bug, and it is how users disable gates entirely.

## Consequences

- Adding a lesson costs nothing structural — no file, no hook, no maintenance.
- Context cost goes DOWN relative to today while consistency goes up.
- **New risk:** a wrongly-promoted lesson now *blocks work* across every project rather than merely
  cluttering a file. This is exactly why §5 (visible, demotable, sticky) is not optional, and why
  only non-negotiables are permitted to block.
- The five gates become the highest-leverage code in the repo. They need their own tests, and a gate
  that fails open must say so loudly rather than silently passing.

## Verification (what must be true before this is Accepted)

1. ❌ A promoted lesson demonstrably changes behaviour at its decision point — shown by the gate
   firing on a case it would previously have let through, proven against known-bad first.
2. ❌ Measured context cost of the constitution + per-gate retrieval is **below** today's baseline.
   The claim above is a calculation, not a measurement, and must not be repeated as fact until
   instrumented.
3. ❌ A promoted lesson survives `npx ruvnet-brain --update` and a nightly refresh (shared with
   ADR-029 #3).
4. ❌ The management surface lists every promoted lesson with provenance, and demotion is sticky
   across a subsequent mining run.
5. ❌ Adversarial cross-model review recorded, per ADR-027 principle 6 — still outstanding for
   ADR-027, 028, 029 and this one.
