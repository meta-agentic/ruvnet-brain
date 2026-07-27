# DDD-0005 — The Learning bounded context

Updated: 2026-07-27

Governs **ADR-028** (what proactive means), **ADR-029** (which lessons are universal), **ADR-030**
(how a lesson acts), **ADR-031** (the compounding brain).

**Status**: Proposed (2026-07-22)

---

## Why this context exists separately

Advocacy (DDD-0004) answers *"what should this user turn on?"* — it reasons about the **machine**.

Learning answers *"how should this agent behave, and how does that improve?"* — it reasons about the
**agent**. They share a delivery surface (a recommendation) and nothing else. Collapsing them was
tempting and would have been wrong: a capability recommendation is about state the user owns, while a
lesson is about behaviour the agent owes. Different lifecycles, different evidence, different failure
modes, different blast radius when wrong.

---

## Ubiquitous language

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Lesson** | A statement of behaviour bound to a **trigger** and an **enforcement level**, backed by observed failures | a note, a preference, a paragraph in CLAUDE.md |
| **Trigger** | The moment a lesson becomes applicable, drawn from a closed set of decision points | a topic or a tag |
| **Enforcement** | `block` \| `checklist` \| `inject` \| `review` — how forcefully the lesson acts | a severity or a priority score |
| **Surface** | What a hook can observe at that trigger: `tool`, `text`, or `plan` | where the lesson is stored |
| **Repeat count** | How many times the user had to teach the same thing | a popularity or usefulness score |
| **Independent rediscovery** | The same lesson taught in ≥2 projects that cannot see each other | the same lesson repeated in one project |
| **Promotion** | Project-scoped → user-scoped, on independent-rediscovery evidence | copying a file upward |
| **Escalation** | Prose → gate, triggered by repeat count within one project | making a rule sound sterner |
| **Demotion** | The user declaring a promoted lesson wrong; **sticky** across future mining | deleting a file |
| **Policy surface** | One of Darwin's seven mutable harness components | our own invented abstraction |
| **Objective function** | The user's weighted lessons, used to score harness variants | a benchmark score |

### Two words that must never be confused

**Promotion ≠ Escalation.** They read from the same data and mean opposite things:

- *Taught across ≥2 **projects*** → the knowledge is **universal** → **promote** its scope.
- *Taught ≥3 times **within one project*** → the existing rule is **not being enforced** →
  **escalate** its force.

Conflating them produces the two catastrophic errors of this design: promoting local noise into the
global constitution, or leaving a violated rule as prose because it was "already global."

---

## Aggregates and their invariants

### Aggregate: **Lesson** (root)

The consistency boundary. A Lesson is only ever created through `makeLesson()`, which throws.

**Invariants — each one is a real failure this project shipped:**

1. **A Lesson MUST have a trigger.**
   *Without it, nothing can ask "does this apply now?" — measured: prose 0/6 compliance, gates 8/8.*
2. **A Lesson MUST carry evidence of an observed failure.**
   *A rule with no failure behind it is a preference, and preferences may not become rules.*
3. **`block` MUST carry a machine-verifiable `check`.**
   *"Be careful" cannot block. If the check cannot be written, the honest level is `checklist`.*
4. **A `plan`-surface trigger may NOT be `block` or `inject`.**
   *No hook observes what the agent chooses to work on. Claiming otherwise dresses a bias as a gate.*
5. **Demotion is sticky.**
   *A demote the next mining run silently undoes is theatre, and teaches the user to distrust the control.*

### Aggregate: **Trigger set** (a closed enumeration, not an entity)

**Invariant: the trigger set MUST NOT grow with the lesson count.** This is the load-bearing
architectural constraint. Gates scale with decision *types* (few, stable); lessons scale with
experience (many, unbounded). If a lesson arrives needing a new trigger, that is a signal the trigger
taxonomy was under-enumerated — a design review, never a per-lesson addition.

*If this invariant is violated, the design has failed and should be reverted rather than extended.*

### Aggregate: **Harness variant** (owned by Darwin, referenced here)

We do **not** own mutation, sandboxing, scoring, or promotion. `@metaharness/darwin` owns all four.
This context owns exactly one thing Darwin cannot know: **the objective** — what "good" means for
this user.

**Invariant: we supply the objective; we never reimplement the search.**
*Violating this is the project's most expensive recurring failure — a fake router while the real one
sat on npm; a hand-rolled capture hook while the real distill pipeline shipped.*

---

## Domain events

| Event | Emitted when | Consumed by |
|---|---|---|
| `LessonCaptured` | a session records a correction | project memory |
| `RediscoveryObserved` | the same lesson appears in a 2nd project | promotion (ADR-029) |
| `LessonPromoted` | it clears the independent-rediscovery bar | the user corpus |
| `RepetitionThresholdCrossed` | taught ≥3× inside one project | **escalation** to a gate (ADR-030) |
| `LessonDemoted` | the user rejects a promotion | mining (permanently excluded) |
| `CapabilityFoundDormant` | the offensive audit finds unused capability | advocacy (DDD-0004) |
| `VariantScored` | Darwin evaluates a harness variant | the archive |

`RepetitionThresholdCrossed` is the event this project most needed and never had. Version discipline
crossed it **fourteen times in this repository** and produced no escalation, because nothing was
listening.

---

## Anti-corruption layer

Two boundaries where foreign models must not leak in:

**1. Against Darwin.** We read its archive and write its objective. We do not model variants,
generations, or promotion internally — those are its concepts, and mirroring them would create two
sources of truth about what was promoted. *We adapt at the boundary: our lessons become a scorer; its
scores become evidence.*

**2. Against Claude Code's memory.** Project memory is written by the harness in a format we do not
control and cannot change. The miner reads **name + description only, never the body** — bodies hold
paths, client names, and URLs, and dragging those into a global rule is the one outcome promotion
must never produce.

---

## What this context deliberately does NOT own

- **Machine state** (what's installed, what's dormant) → Advocacy, DDD-0004.
- **Retrieval over rUv's corpus** → the existing KB context.
- **Mutation and promotion of harness variants** → Darwin.
- **The user's global instructions file** → the user's, always. We write one fenced block and
  preserve everything outside it.

---

## The failure this context is designed around

Stated once, plainly, because every invariant above descends from it:

> **Knowledge that cannot interrupt does not act.**
>
> Measured over one session: gates 8/8 obeyed, prose 0/6 on the load-bearing rule. Same model, same
> session, same sincere intentions. The only variable was whether the knowledge could interrupt.

Every design choice here — the mandatory trigger, the closed enumeration, the enforcement ladder, the
honest `review` level for what cannot be automated — exists to convert latent knowledge into active
knowledge, and to refuse to pretend when that conversion is impossible.
