# DDD-0009 — The Consent bounded context

Updated: 2026-07-27

Governs **ADR-035** (consent and legibility).

**Status**: Proposed (2026-07-22)

---

## Why this context exists separately

Learning (DDD-0005) answers *"what should this agent do differently, and how does that improve?"* —
it reasons about **behaviour**.

Consent answers *"how much force may that behaviour exert on this user's machine, and did they agree
to it?"* — it reasons about **authority**. A lesson is knowledge; a level of force is a claim on
someone else's autonomy. They have been treated as one thing since the beginning, and the seam is
where the project's current defect lives: `enforcement` sits on the Lesson aggregate as though "how
true is this" and "how hard may it push you" were the same question. They are not. Truth is earned
from evidence, which the Learning context owns. **Force is granted by the user, and cannot be earned
at all.**

The practical consequence of the split: a lesson can accumulate unlimited evidence — 25 repeats
across 3 projects, as `claim-done` has — and still not be permitted to block, because evidence is
not consent and no amount of the first converts into the second.

---

## Ubiquitous language

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Consent** | A recorded, revocable grant of authority from the user for a specific force at a specific scope | a EULA, an install flag, a default |
| **Scope** | Where consent and learning apply: `user` (default) or `project` | where files happen to sit on disk |
| **Nudge** | Evidence-carrying interruption at the decision point that **exits 0** — it informs and allows | a soft block, a warning, a weak gate |
| **Block** | Refusal via **exit 2 + stderr**, requiring per-rule consent **and** a predicate | any output containing the word "blocked" |
| **Predicate** | The machine-evaluable condition making a lesson apply *right now*, evaluated from hook stdin | the trigger, which is only the moment |
| **Piece** | An independently installable component with a nameable function and a stateable loss | a module, a file, a package |
| **Consent ledger** | The durable record of decisions, living outside the bundle | a settings key |
| **Predicate registry** | Bounded (≤12) set of named `repo-state` predicates | a plugin system |
| **Silence** | Absence of an answer. **Never** consent | implied agreement, "they didn't object" |

### Three distinctions that must never collapse

**Trigger ≠ Predicate.** The trigger is *when* a lesson is considered (`write-code`, `ship`); the
predicate is *whether it applies to this particular action* (`path-matches: **/*.mjs`). Collapsing
them produced the shipped defect: `scripts/lesson-gate.mjs` reads no stdin, so it has triggers and no
predicates, and therefore `block` can only mean "refuse everything at this event, forever."

**Nudge ≠ weak Block.** A nudge is not a block that gave up. It is the deliberate product — the owner,
2026-07-22: *"Nudging somebody is very fair. Forcing them through a gate is not."* Treating nudge as
a degraded block invites "fixing" it into forcing, which is the exact regression ADR-035 exists to
prevent.

**Evidence ≠ Consent.** Learning produces evidence. Only the user produces consent. Any path where
sufficient evidence automatically raises force is a boundary violation, however well-motivated.

---

## Aggregates and their invariants

### Aggregate: **Consent grant** (root)

The consistency boundary for authority. Nothing may raise force without a grant.

**Invariants — each is a real, verified failure:**

1. **A `block` grant MUST name exactly one lesson.**
   *A blanket grant is how `enforcement: block` became condition-free. Verified 2026-07-22: the gate's
   entire predicate is `enforcement === BLOCK && ratified` — no reference to the action in progress.*

2. **A `block` grant MUST reference a predicate that is not `always`.**
   *`always` + `block` is an outage, not a rule. Mirrors DDD-0005 invariant 3 ("`block` MUST carry a
   machine-verifiable check") — which the implementation ignored, so it is restated here where the
   grant is issued and can be refused.*

3. **Silence MUST NOT create or alter a grant.**
   *An upgrade that changes enforcement on a machine whose owner never answered is coercion arriving
   under a banner about respecting choice.*

4. **A grant MUST be revocable, and revocation MUST be sticky across updates.**
   *Same lesson as ADR-030 §5's sticky demotion: a control the next release silently undoes teaches
   the user the control is fake, and they stop using it — correctly.*

5. **A grant MUST be scoped, and scope MUST be explicit.**
   *A user consenting for one client repo has not consented for every repo on the machine.*

### Aggregate: **Enforcement level** (a closed, ordered enumeration)

`off < inform < nudge < checklist < review < block`

**Invariant: the DEFAULT is `nudge`, and no automatic path reaches `block`.** Not promotion, not
ratification, not repeat count. ADR-030 §1b escalates on repeat count; **that escalation terminates
at `nudge`.**

**Invariant: force is bound to mechanism — the vocabulary may not outrun the exit code.** Only
`block` emits exit 2 on stderr; only `block` may say "blocked."

*Verified 2026-07-22, and the reason this is an invariant rather than a style note:*

```
$ echo '{}' | bash plugin/scripts/lesson-hooks.sh Stop 2>&1 ; echo "EXIT: $?"
  ⚑ BLOCKED — you are about to report progress or state.
EXIT: 0
```

*It printed `BLOCKED` and returned the allow code. A system that misstates its own force is lying to
the user, and the direction of the lie does not redeem it.*

### Aggregate: **Predicate registry** (bounded set, not an entity)

**Invariant: the registry MUST NOT grow with the lesson count.** Bound: **12** named `repo-state`
predicates. It grows with *kinds of machine state* — few, slow, reviewable — never with experience.

*This is DDD-0005's trigger-set invariant applied to the second axis. That one bounds gates against
lesson count; without this one, lessons stay data while their conditions become a script apiece, and
the thousand hooks the owner rejected return through the back door. `version-bump-gate.sh` is
**101 lines**, of which ~100 are predicate — that is the cost being bounded.*

**Invariant: the registry is a concession and must be labelled one.** Pure-data kinds (`tool-is`,
`path-matches`, `content-matches`, `command-matches`) cover what hook stdin can answer.
`repo-state` covers what it cannot, and it is real code. *Claiming this design eliminates bespoke
predicates would repeat the exact error ADR-035 documents: asserting a property the system does not
have. It eliminates a script per **lesson**, not a script per **kind of condition**.*

### Aggregate: **Piece** (referenced for legibility, owned by no context)

**Invariant: every Piece MUST state its loss, specifically and quantifiably.**

*"You lose some functionality" is not a statement of loss. "You lose the decision-point timing —
measured at gates 8/8 versus prose 0/6 in one session" is. The power user who said "I just loaded the
brain into my RuVector Brain and I don't get the rest of it" was not confused; he was **uninformed**,
and vague loss statements are what left him that way.*

**Invariant: every count shown MUST be derived at runtime; `unknown` renders as `unknown`.**
*The standing order: the product can never lie. A fabricated count on the page that explains the
system is the worst possible place for one.*

---

## Domain events

| Event | Emitted when | Consumed by |
|---|---|---|
| `ScopeChosen` | user picks `user` or `project` at install or upgrade | install; the consent ledger |
| `ConsentGranted` | user opts a specific lesson into `block` | the gate (unlocks exit 2 for that lesson) |
| `ConsentRevoked` | user withdraws a grant | the gate (lesson falls back to `nudge`) |
| `UpgradeNoticeShown` | a new major, no ledger entry for it | the ledger (suppresses repeats) |
| `UpgradeNoticeDismissed` | dismissed with **no** answer | **nothing — behaviour is unchanged.** The event exists so silence is *recorded* without being *acted on* |
| `NeverAskAgainSet` | user opts out of all future notices | the ledger, permanently |
| `NudgeDelivered` | a lesson surfaces at a decision point, exit 0 | outcome observation |
| `NudgeOverridden` | the user proceeds past a nudge | **outcome observation — the most valuable signal here** |
| `PredicateRegistered` | a `repo-state` predicate is added | the registry (checks the bound of 12) |

`NudgeOverridden` is the event this context most needs and does not yet have. A nudge that is always
overridden is prose with extra latency (ADR-030's anti-goal, restated at a different level); a nudge
never overridden may be a candidate the user would consent to blocking. **Override rate is the only
honest evidence about whether nudging works**, and without it the central bet of ADR-035 stays an
assertion — which is why it appears in the ADR's Verification as ❌ rather than in its Consequences
as a claim.

---

## Anti-corruption layer

**1. Against Learning (DDD-0005) — the load-bearing boundary.**

Learning owns the Lesson: its statement, trigger, evidence, repeat count, promotion and demotion.
Consent owns force and scope alone.

Today these are fused: `enforcement` is a field on the Lesson, so `scripts/lesson-gate.mjs` can read
force straight off it and no consent check is possible or even representable. The adaptation:

> **The gate reads force from the consent ledger, never from the lesson.** A lesson's
> `intendedEnforcement` is Learning's *proposal*; the ledger's grant is the *authority*. Where they
> disagree, the ledger wins, and it wins in the safe direction — absent a grant, force is `nudge`.

*Concretely: `claim-done` carries 25 repeats across 3 projects — overwhelming evidence, and still
exits 0 without a grant. That is the boundary doing its job, and it should look uncomfortable.*

**2. Against Claude Code's hook contract.**

We do not own it and cannot change it: `exit 0 = allow`, `exit 2 + stderr = block`, stdout is
context. We adapt to it exactly and never reinterpret it — `exit 1` is an error, not a soft block,
and treating it as one is how four independent breaks in a single chain went unnoticed.

*Verified 2026-07-22: `lesson-gate.mjs` exits 1 with 15 `console.log` and 0 `console.error`;
`lesson-hooks.sh` appends `|| true` then `exit 0`; `hooks.json` wraps every call in `2>&1 || true`.
Four breaks, each sufficient alone. **Ordering matters — fixing the exit code without removing
`2>&1` still fails**, because the reason arrives on the wrong stream. That interaction is why each
file passed its own review and the chain did not.*

**3. Against the Install/Update context (DDD-0003).**

Install executes a scope decision; it does not make one. Update ships bytes; it does not alter
grants. *The consent ledger lives with user config, outside the bundle — the same reason promoted
lessons do (ADR-030 §4). A decision destroyed by the next release is a decision that will be asked
again, and being asked twice teaches the user the control is theatre.*

---

## What this context deliberately does NOT own

- **Lesson content, evidence, promotion, demotion** → Learning, DDD-0005.
- **What is installed and what is dormant** → Advocacy, DDD-0004.
- **Delivering bytes** → Update, DDD-0003.
- **The user's global instructions file** → the user's, always.
- **Whether a lesson is *true***. Consent governs force, never correctness. A well-consented block on
  a wrong lesson is a correctly-authorised mistake, and Learning owns the mistake.

---

## The failure this context is designed around

Two failures, and they resolve to one:

> **1. The system said `BLOCKED` and returned the allow code.** Verified by execution 2026-07-22.
> Four independent breaks between the store and the hook contract, in an area whose ADR claimed
> enforcement was *"proven by exit code"* — proven by running the CLI by hand, the one caller that is
> not a gate.
>
> **2. The owner does not want blocking to be the default anyway.** *"Nudging somebody is very fair.
> Forcing them through a gate is not… that respect for the individual and how they do it is a big
> part of the win."*

**The accidental behaviour was the correct default.** Everything exits 0 and merely informs — that is
what a nudge is. The defect was never insufficient force; it was **a system misrepresenting its own
force**, and a user who could neither see the pieces nor choose among them.

Every invariant here descends from that: force is granted, never earned; silence is never consent;
the vocabulary may not outrun the exit code; and every piece must state, quantifiably, what you lose
by leaving it out.
