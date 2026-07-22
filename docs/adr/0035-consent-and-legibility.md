---
id: ADR-035
title: Consent and legibility — the nudge is the product, the block is the exception, and the pieces must be nameable
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [consent, enforcement, legibility, install, upgrade, predicates, 4.0]
supersedes: []
relates: [ADR-027, ADR-028, ADR-029, ADR-030, ADR-013, ADR-023]
---

**Status**: Proposed (2026-07-22)

**ADR-030** decided that latent knowledge is not knowledge, and that gates are what convert one into
the other. It was right about the disease and wrong about the dose. This document corrects the dose,
on two independent grounds that arrived the same day and point the same direction: **the blocks were
never blocking**, and **the owner does not want them to**.

---

## Part 1 — The motivating defect: `enforcement: block` cannot block

ADR-030's Verification #1 says, in its own words:

> ✅ **DONE (2026-07-22).** […] Proven by exit code: before ratification the ship trigger exits 0
> (informs); after the owner ratified 9 user-stated lessons, five triggers exit 1 and refuse.

**That claim is false, and the way it became false is more instructive than the fact that it is.**
It was verified by running `scripts/lesson-gate.mjs` directly on the command line — the one caller
in the entire system that is *not* a gate. Every actual caller sits behind a wrapper that discards
the exit code. An ADR whose subject is "knowledge that does not interrupt does not act" verified its
own enforcement through a channel structurally incapable of observing enforcement. That is
lesson `claim-done` — *"verify through a channel CAPABLE of observing the change… never the exit
code of the thing being tested"* — violated inside the document that catalogues it.

### The chain, verified by execution 2026-07-22

The contract is stated in this repo's own working gate, `plugin/scripts/ground-before-write.sh:33`:

```
# CONTRACT: exit 0 = allow · exit 2 + stderr = BLOCK (stderr returns to the model as reason).
```

Four independent breaks, each sufficient alone:

| # | Location | Break | Verified by |
|---|---|---|---|
| 1 | `scripts/lesson-gate.mjs:63,86` | exits **1**, not 2. Exit 1 is not a block signal — it is an error. | `grep -n process.exit` |
| 2 | `scripts/lesson-gate.mjs` | **15 `console.log`, 0 `console.error`.** The refusal reason goes to stdout; only stderr returns to the model. | stream audit |
| 3 | `plugin/scripts/lesson-hooks.sh` | `\|\| true` swallows the code, then `exit 0` unconditionally. | file read |
| 4 | `plugin/hooks/hooks.json:43,94,103,147` | every invocation appends `2>&1 \|\| true` — merges stderr into stdout, *then* discards. | grep |

Run end to end:

```
$ echo '{}' | bash plugin/scripts/lesson-hooks.sh Stop 2>&1 ; echo "EXIT: $?"

  ⚑ BLOCKED — you are about to report progress or state.
  ⛔ When given work to complete, run it to DONE…
      you have had to say this 6 times across 1 project(s)
  ⚑ BLOCKED — you are about to claim something works.
  ⛔ Before claiming something works, verify through a channel CAPABLE of observing the change…
      you have had to say this 25 times across 3 project(s)
EXIT: 0
```

**It prints `BLOCKED` and returns 0 — the allow code.** Twice. The word is decoration.

### A third defect, found while verifying the first two

`plugin/scripts/lesson-hooks.sh` maps `PreToolUse-push → ship`. **`plugin/hooks/hooks.json` contains
no `push` entry at all** (`grep -n push` → no matches). The `ship` trigger — the one guarding
release, the decision point with the largest blast radius — is unreachable from the plugin. It was
never wired, and nothing noticed, because a gate that does nothing and a gate that is never called
are indistinguishable from the outside. This is the second-order cost of gates that fail silently:
they destroy the evidence that would reveal they are missing.

### Defect 2: `block` is condition-free, and that makes it unusable

`scripts/lesson-gate.mjs` **reads no stdin** (`grep -n "stdin\|process.stdin"` → no matches). It
receives no tool name, no arguments, no diff, no file path. Its entire blocking predicate is:

```js
const blocking = inForce.filter(
  (l) => l.enforcement === ENFORCEMENT.BLOCK && (l.status === RATIFIED || l.status === ACTIVE),
);
```

Read that honestly: *block if a block-lesson exists.* Nothing about the action in progress. So the
only semantics `block` can currently express is **"refuse everything at this event, forever"** —
which is not a rule, it is an outage.

The contrast is exact. `plugin/scripts/version-bump-gate.sh` is the one gate that genuinely blocks,
and it is **101 lines** of bespoke bash — because 100 of those lines are the *predicate*: which
files changed, whether they are behavioural, whether the version moved. **The store holds the
MESSAGE and never the CONDITION.** Left unaddressed, every real blocking rule needs its own script,
and the thousand hooks the owner explicitly rejected walk back in through the side door.

---

## Part 2 — The owner's correction, which resolves Part 1

2026-07-22:

> *"Nudging somebody is very fair. Forcing them through a gate is not. That's where we need to add
> some elegance before it's going to work for a larger number of people. More advanced people have
> different ways they implement it, and we need to be supportive of how they like to work."*
>
> *"That approach, that respect for the individual and how they do it, is a big part of the win."*
>
> *"A core reason why you exist is to make murky and confusing things clear, tangible, accessible,
> and selectable. That has to apply to how we're implemented as well."*
>
> *"All of these additional steps are the difference between acting as a good partner and forcing
> something down somebody's throat, which, even if it's good medicine, doesn't feel good."*

The bug and the philosophy converge, and the convergence is the whole decision: **the accidental
behaviour is the correct default.** Everything currently exits 0 and merely informs. That is what a
nudge *is*. The defect is not that it fails to force — it is that it **says `BLOCKED` while
allowing**, and a system that misrepresents its own force is lying to the user regardless of which
direction the lie runs.

So the fix is not to make the blocks block. It is to **make the nudge deliberate, honest and
excellent**, and to make blocking a narrow, explicitly-chosen exception.

### The evidence that a nudge can be enough

ADR-030's own measurement is usually quoted as "gates 8/8, prose 0/6." The interesting question is
*why prose lost*, and the answer is not force — it is **timing and evidence**. Prose sat in a file
read hours earlier with no provenance. Gates arrived at the decision point carrying a specific
reason. A nudge delivered at the decision point, carrying *"you have had to say this 25 times across
3 projects"* and the actual observed failure, has the timing and the evidence. It differs from a
gate in exactly one respect: **you can proceed anyway.**

That difference is not a weakness to be engineered out. It is the product.

---

## Decision

### 1. The consent ladder — six levels, each with an exact hook contract

Replaces block/checklist/inject/review. Every level states its exit code, its stream, and — the part
the current implementation has never had — **who is permitted to set it.**

| Level | Exit | Stream | Model sees it? | Who may set it |
|---|---|---|---|---|
| `off` | 0 | — | no | **user only** |
| `inform` | 0 | stdout | yes, as context | miner or model |
| **`nudge`** ← **DEFAULT** | 0 | stdout, evidence-carrying | yes, at the decision point | miner or model |
| `checklist` | 0 | stdout + acknowledgement contract | yes; must visibly answer | ratified lesson |
| `review` | 0 | stdout, at review time only | at review, not at the moment | declared, human-checked |
| `block` | **2** | **stderr** | yes, as a refusal reason | **user opts in THIS rule, and a predicate exists** |

Four rules make this ladder honest, and each closes a break verified above:

**(a) Exit 2 + stderr is the ONLY thing that blocks.** Not exit 1. Not stdout. A level that does not
emit exit 2 on stderr may not use the word "blocked" in its output — the vocabulary is bound to the
mechanism. Break #1 and #2, closed by making the word cost something.

**(b) The wrapper must stop laundering exit codes.** `lesson-hooks.sh` propagates 2; `hooks.json`
drops `2>&1 || true` on lesson invocations. Note the ordering constraint: `2>&1` alone would defeat
(a) even after the exit code is fixed, because the reason would arrive on the wrong stream. Both
must change together or neither works — which is precisely how this stayed broken through a review
that examined each file separately.

**(c) `nudge` is the default for every lesson, always.** A mined lesson, a model-inferred lesson, a
ratified lesson — all land on `nudge`. Nothing reaches `block` by promotion, by ratification, by
repeat count, or by any automatic path whatsoever. ADR-030 §1b escalates *prose → gate* on repeat
count; **that escalation now terminates at `nudge`**, and repeat count becomes the strongest
argument the nudge carries rather than a trigger that arms it.

**(d) `block` requires two independent keys.** A per-rule user opt-in **and** a predicate (§2). Both
absent by default. This is the narrow exception the owner allowed for, and its narrowness is
structural rather than advisory — with no predicate the level is unreachable regardless of consent.

> **Why `checklist` survives as separate from `nudge`.** It exits 0 and cannot refuse, so it is a
> nudge by force. It differs in being *verifiable after the fact*: it demands a visible answer in the
> output, which a later pass can check. It is the honest home for rules that need accountability but
> must never obstruct — and it is where a rule belongs when someone reaches for `block` and cannot
> write the predicate.

### 2. The condition problem — predicates as data, with a bounded and honestly-stated escape hatch

**Prerequisite: the gate must read stdin.** Today it reads none, so no predicate of any design can
be evaluated. Every option below is blocked on this, and it is the first implementation step.

Three approaches were considered.

| Option | Cost | Verdict |
|---|---|---|
| **A.** Predicates as a general expression language | An interpreter, a grammar, a security surface, and a debugging story for user-authored expressions we cannot test | **Rejected** — we would ship a small programming language to avoid writing scripts, then debug it forever |
| **B.** Closed set of composable predicate KINDS, evaluated from hook stdin | One evaluator; new kinds are design reviews | **Adopted for the common cases** |
| **C.** Concede that conditional blocking needs bespoke code | Honest, but unbounded — the thousand hooks | **Adopted, bounded and named** |

**Adopted: B for what stdin can answer, C for what it cannot — with C bounded and registered.**

**Kind set (closed).** Each is pure data on the lesson and evaluable from what a hook genuinely
observes:

| Kind | Evaluates against | Example |
|---|---|---|
| `always` | — | the current behaviour. **Legal for `nudge`; illegal for `block`.** |
| `tool-is` | `tool_name` from PreToolUse stdin | `Write`, `Edit`, `Bash` |
| `path-matches` | `tool_input.file_path` | `**/*.mjs`, `plugin/hooks/*` |
| `content-matches` | the content/diff being written | `/process\.exit\(1\)/` |
| `command-matches` | `tool_input.command` for Bash | `/^git push/` |
| `repo-state` | a **named, registered** predicate (§2b) | `version-unchanged` |

**§2b — the escape hatch, stated without varnish.** `repo-state` names a predicate from a registry;
`version-bump-gate.sh`'s 101 lines become the single registered predicate `version-unchanged`, which
any lesson may reference by name.

**This does not eliminate bespoke code, and claiming otherwise would repeat exactly the error Part 1
documents.** What it eliminates is *a script per lesson*. Many lessons share one predicate; the
registry grows with **kinds of machine state** (few, slow, reviewable), never with lesson count —
the same invariant DDD-0005 already imposes on the trigger set, applied to the second axis.

**Bound: at most 12 registered `repo-state` predicates.** Adding the 13th is a design review that
must argue why the taxonomy was under-enumerated, not a routine addition. If the registry is growing
with the lesson count, this design has failed and should be reverted rather than extended.

**Invariant: `block` may not use `always`.** A block with no condition is an outage. If the predicate
cannot be written, the honest level is `checklist` — which is exactly what DDD-0005 invariant 3
already says about `block` needing a machine-verifiable check, and which the implementation ignored.

### 3. The consent model — per-user by default, per-project by explicit choice

What differs, exactly. Paths verified on this machine 2026-07-22.

| | **Per-user** (default, recommended) | **Per-project** |
|---|---|---|
| Lesson store | `~/.config/ruvnet-brain/lessons.json` | `<project>/.ruvnet-brain/lessons.json` |
| Hooks | `~/.claude/settings.json` | `<project>/.claude/settings.json` |
| Corpus | `~/.cache/ruvnet-brain/kb` — **shared either way** | *same shared cache* |
| Learning scope | a lesson learned anywhere applies everywhere | stays in this project |
| **Cross-project promotion** | **available** | **structurally impossible** |
| Version updates | one place, one command | per project; drifts independently |

**The corpus is shared in both modes and that is not a detail.** It is 69 repositories of embedded
RVF; duplicating it per project would cost gigabytes per project to buy nothing. Per-project isolates
*learning and enforcement*, never the knowledge base.

**The cost of per-project, stated plainly because a user cannot consent to what they were not told:**
ADR-029's promotion bar is **independent rediscovery — the same lesson taught in ≥2 projects that
cannot see each other**. In per-project mode there is no second project, so the bar is unreachable by
construction. Per-project does not slow compounding down; it switches it off. A user may want exactly
that — a client repo with strict isolation is a real and legitimate reason — but they must choose it
knowing.

**The recommendation language, which is the owner's and is not to be paraphrased into something
smoother:**

> *"Normally this happens on a per-user basis, which lets learning, intelligence, access and software
> versions stay updated universally across all your projects. Only choose per-project if this is
> something you absolutely only use on a per-project basis. Our strong recommendation is per-user —
> but we always want YOU to be the arbiter of how things run on your machine."*

Strong recommendation, stated reason, explicit deference. No dark patterns: per-project is a
same-weight option, not fine print, not a scare screen, not an extra confirmation step. A
recommendation that must be *fought past* is coercion wearing a nicer word.

### 4. Legibility — the pieces, on one screen

The user problem, from a power user to the owner:

> *"I can't use your stuff because it has hooks and this and that. I just loaded the brain into my
> RuVector Brain and I don't get the rest of it."*

He is not confused. **Nobody — including the owner — could name the pieces on demand.** Counts below
are derived at runtime and rendered from live inspection; every one was verified 2026-07-22 and none
is baked into the renderer.

| Piece | What it does | Take it alone and you get | Without it you lose |
|---|---|---|---|
| **Brain corpus** | 69 repos embedded as RVF in `~/.cache/ruvnet-brain/kb` | search over rUv's source **when you remember to ask** | nothing else works — it is the foundation |
| **MCP server** | exposes `search_ruvnet` (1 tool) | the corpus reachable from the agent | you must query by hand, outside the loop |
| **Hooks** | 28 commands across 6 events | knowledge arriving **at the decision point** | the 0/6 column (below) |
| **Lesson store** | 15 lessons over 10 triggers | your corrections retained and resurfaced | you re-teach the same thing; measured up to 25× |
| **Plugin** | skills + slash commands | packaging, discovery, updates | manual install, manual upgrade |
| **Console** | `/configure`, `/rvbc` — see and reverse everything | legibility and one-click undo | you cannot tell what is on |

**What you give up taking only the brain corpus — the specific, quantifiable answer:**

You keep 100% of the knowledge and lose 100% of the *timing*. ADR-030 measured this exact split over
one session: **gates 8/8 obeyed, prose 0/6 on the load-bearing rule** — same model, same session,
same sincere intentions; the only variable was whether knowledge arrived at the decision point.
Corpus-only is the prose column. Concretely you lose: grounding checks at write time, all 10 decision
triggers, the 15 accumulated lessons, cross-project promotion, capability advocacy (ADR-027), and
currency checks (ADR-034).

**This is a legitimate configuration and must be offered as one.** Corpus-only is the right choice
for someone who wants retrieval and nothing in their loop, and the install must present it as a
first-class option rather than a degraded one. It is also the honest answer to the power user: *you
did not misunderstand — you took the piece that works standalone, and here is precisely what the
rest adds.*

### 5. The upgrade conversation — existing users, once, dismissible forever

The owner, and this is the requirement most likely to be quietly dropped:

> *"That's only going to help people newly installing. It needs to be smart enough when it comes up
> to say: version 4 is here, here are some things about it, you have much more finely grained
> control, here's how you should install it, and here are your choices. Please let us know."*

**Trigger.** `SessionStart`, once, when the installed **major** changes and the consent ledger holds
no decision for that major. Never on minor or patch — a nag on every release is how the notice gets
disabled, and a disabled notice protects nobody.

**Content.** What changed (nudge-by-default; blocks now opt-in per rule), what control they gained,
their scope choice with the §3 recommendation, and how to change it later.

**Three responses, all terminal:**

| Response | Recorded | Re-asked? |
|---|---|---|
| Choose a scope | that scope, for this major | no |
| Keep what I have | **an explicit decision**, for this major | no |
| Never ask again | permanent, all future majors | **never** |

**Silence is not consent — this is the load-bearing invariant.** If the user dismisses the notice
without answering, behaviour stays **exactly as it was**; the new default applies to new installs
only. An upgrade that changes enforcement on a machine whose owner never answered is precisely the
thing down-the-throat means, and it would be worse for arriving under a banner about respecting
choice.

**Never re-prompt within a major**, including after a reinstall. The consent ledger lives with user
config, outside the bundle, for the same reason promoted lessons do (ADR-030 §4): a decision
destroyed by the next release is a decision that will be asked again, and being asked twice is how
users learn the control is fake.

### 6. Deliberately NOT in this round

- **A UI for authoring predicates.** Predicates are data, but hand-authoring is CLI/file-level until
  the kind set has survived real use. Shipping an editor for a taxonomy we have not stress-tested
  would freeze it prematurely.
- **Migrating the 15 existing lessons to predicates.** They all become `nudge`, which legally uses
  `always`. No migration is required, and none should be invented to look thorough.
- **Per-rule consent UI in the console.** The ladder and the ledger land first; the surface follows
  once there is something real to render. ADR-030 §5's demote CLI has the same gap open.
- **Cross-machine consent sync.** Consent is per-machine. Syncing it means syncing a decision the
  user made about *one* machine to machines they were not thinking about.
- **Deciding whether `review` earns its place.** It is carried forward unchanged. It may be
  redundant with `checklist`; that is a real question and answering it here without evidence would
  be the round-number tidiness this project already has a lesson about.

---

## Anti-goals

- **Fixing the block path by making it force.** The defect and the philosophy point the same way.
  Repairing exit codes *without* demoting the default to `nudge` would ship the exact product the
  owner rejected, under the banner of a bug fix.
- **A word that overstates its force.** `BLOCKED` at exit 0 is the current state and it is a lie
  about our own behaviour. `unknown` may never render as `off`, and `nudge` may never say `blocked`.
- **Consent theatre.** A choice presented after the fact, or one where the non-recommended option is
  harder to pick, is not a choice.
- **Predicate creep.** If `repo-state` grows toward one entry per lesson, this design has failed.
- **Making the nudge shout.** A nudge that fires constantly is prose with latency. Retrieval stays
  capped at 2–3 lessons per decision point (ADR-030 §3).

## Consequences

- **`block` becomes rare and real.** Fewer blocks, each with a predicate and explicit consent. Some
  rules the author believes should block will not, because no predicate can be written — that is
  information, not a shortfall.
- **The system must get good at persuasion rather than refusal.** Evidence, provenance and repeat
  counts stop being decoration and become the entire mechanism. A weak nudge now fails silently in a
  way a weak block did not.
- **A user can proceed past every nudge.** Accepted deliberately. The alternative is a product the
  owner has said he does not want, and one the power user has already told us he will not install.
- **Reading stdin is now on the critical path.** It gates predicates and adds a parsing surface to a
  hook that runs on every event. It must fail open (ADR-021's shared parser) — the current gate's
  `catch { process.exit(0) }` is the right instinct and should be preserved.
- **Two new things can drift:** the predicate registry (bounded at 12) and the consent ledger. Both
  need the same visibility ADR-030 §5 demands of promoted lessons.

## Verification (what must be true before this is Accepted)

1. ❌ A `block` lesson with a predicate and explicit consent **actually refuses** — proven from a
   real hook invocation with exit 2 observed by the caller, **not** by running the CLI by hand. The
   channel used must be capable of observing the refusal; that is the precise error this ADR exists
   to correct, and repeating it here would be unforgivable.
2. ❌ A `nudge` lesson exits **0** and the action proceeds, with the lesson text reaching the model.
   Both halves matter: allowing while staying silent is not a nudge.
3. ❌ No level except `block` emits exit 2, and no non-blocking output contains the word "blocked" —
   enforced by a test over all six levels, not by review.
4. ❌ The `ship` trigger fires. It is currently unreachable (no `push` entry in `hooks.json`) and
   nothing detected that; the test must prove the wiring, not the script.
5. ❌ Per-project scope installs to `<project>/.ruvnet-brain/lessons.json`, shares the corpus cache,
   and is **verified not to duplicate** the 69-repo store.
6. ❌ The upgrade notice appears once per major, records all three responses, and — the one most
   likely to regress — **does not change behaviour when dismissed unanswered.**
7. ❌ Every count in §4 is derived at runtime. No literal appears in the renderer; `unknown` renders
   as `unknown`, never as `off` or `0`.
8. ❌ Adversarial cross-model review recorded, per ADR-027 principle 6 and the standing
   cross-model-duel order — still outstanding for ADR-027 through ADR-034 and this one.

**Nothing here is verified.** Part 1's findings are verified by execution and quoted above with
their commands; every decision that follows from them is a proposal, and this section stays ❌ until
each line is separately proven through a channel capable of observing it.
