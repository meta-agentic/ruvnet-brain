# DDD-0007 — The Extraction bounded context

Updated: 2026-07-22 | Version 1.0.0
Created: 2026-07-22

Governs **ADR-033** (where a lesson comes from).

**Status**: Proposed (2026-07-22)

---

## Why this context exists separately from Learning

DDD-0005 owns the question *"how should this agent behave, and how does that improve?"* Its aggregate
root is the **Lesson**, and its central invariant is that a Lesson must be able to act — a trigger, an
enforcement level, evidence of a failure.

Extraction owns a strictly earlier and entirely different question: **"did the user just teach me
something, and can I prove it?"** That is not a question about behaviour. It is a question about
**interpretation of speech**, and it fails in ways a Lesson cannot:

| | Learning (DDD-0005) fails by | Extraction (DDD-0007) fails by |
|---|---|---|
| Wrong output | a true rule that never fires (latent knowledge) | a **rule that was never taught** (fabrication) |
| Blast radius | one unenforced rule | the store's credibility, permanently |
| Correction path | escalate it to a gate | there is none — a fabricated rule looks identical to a real one |
| Evidence | an observed failure | a **verbatim human utterance and its coordinates** |

Collapsing them was the tempting move and would have been the dangerous one. DDD-0005's invariants
are all about *making a lesson act*; every one of them assumes the lesson is true, because a human
wrote it. **Extraction is the first component that creates Lessons without a human**, so it needs a
completely different invariant set — one concerned with provenance, not with force.

The dependency runs one way and only one way: **Extraction depends on Learning. Learning does not
know Extraction exists.** DDD-0005 must remain valid if this context is deleted tomorrow.

---

## Ubiquitous language

| Term | Precise meaning (exactly one) | Explicitly NOT |
|---|---|---|
| **Utterance** | One user-role turn, verified to originate from the human — not the harness, not a skill preamble, not a tool result | any block with `role: user` in the transcript |
| **Correction** | An Utterance that rejects an agent action **and quantifies over future occasions** | disagreement, frustration, a negation, or a task instruction |
| **Instruction** | An Utterance directing one action on one occasion (*"push this now"*) | a Correction. This distinction is the whole detector. |
| **Fact dispute** | An Utterance rejecting a claim about the world rather than an agent action | a Correction. Teaches nothing about behaviour. |
| **Signal** | One of the four required predicates: Adjacency, Behaviour-directed, Quantification, Negative valence | a keyword, a score, or a weight |
| **Detection** | The conjunction of all four Signals holding over one Utterance | any Signal firing |
| **CandidateLesson** | A Lesson-shaped proposal built from exactly one Correction, always `model-inferred` / `candidate` | a Lesson. It is not one until a human ratifies it. |
| **Generalization** | A *proposed alternative phrasing* at broader scope, carried **alongside** the verbatim statement | a rewrite, a normalization, a cleanup |
| **Retirement** | The lifecycle of a lesson that stopped applying: `dormant` \| `stale` | `demoted`, which means **wrong** — a different thing entirely |
| **Operating point** | The measured precision/recall pair at which the detector is permitted to write | a confidence threshold or a tuning knob |
| **Ratification** | The human act that converts a CandidateLesson into policy | approval, acceptance, or anything a machine can perform |

### Terms that collide across contexts, named so they stop

- **Evidence.** In DDD-0005 it is *an observed failure* (`evidence[].observed`). Here it is *a
  verbatim utterance plus transcript coordinates*. Ours becomes theirs at the boundary — never the
  reverse. This context never invents an `observed` string.
- **Signal.** DDD-0005 uses it loosely for *promotion vs escalation evidence*. Here it is one of
  exactly four named predicates. Where ambiguity is possible, say **Detection Signal**.
- **Surface.** DDD-0005: what a hook can observe at a trigger. DDD-0006: the Capability Panel. This
  context does not use the bare word at all.
- **Candidate.** DDD-0005's `STATUS.CANDIDATE` is a *state a Lesson can be in*. Our **CandidateLesson**
  is a distinct aggregate that has not yet crossed into DDD-0005 at all.

---

## Aggregates and their invariants

### Aggregate: **Correction** (root)

The consistency boundary for *"was something actually taught?"*. Constructed by one factory that
throws; nothing else may produce one.

**Invariants — each maps to a real, dated failure:**

1. **A Correction MUST carry the user's verbatim words and their transcript coordinates.**
   *A paraphrase cannot be audited, and the whole ratification surface is a human reading his own
   sentence. ADR-029 §3: legibility beats cleverness when blast radius is total.*
2. **A Correction MUST be preceded by an observed agent action (Adjacency).**
   *Measured 2026-07-22: the highest-scoring hit across 1,298 transcripts was
   `[Your previous response had no visible output…]` — harness-injected text. Without Adjacency the
   detector learns rules from its own scaffolding.*
3. **A Correction MUST quantify over occasions.**
   *"Push everything and verify it works" and "always give me a clickable link" are both imperative,
   second-person, and negatively toned. Only the second is a rule. Naive markers matched 42.1% of all
   user turns (932/2,214) largely on this confusion.*
4. **A Correction MUST reject an agent ACTION, not a proposition about the world.**
   *Real corpus, 2026-07-22: "did he build cognitive learn? I thought I did" — a dispute over repo
   authorship. Ingesting it stores contested trivia as policy.*
5. **Negation alone MUST NOT satisfy any invariant.**
   *Real corpus: "No, that's okay. I think you've got all the key ones in there." The turn opens with
   "No" and is agreement.*
6. **A Correction MUST NOT be constructed from agent reasoning, a summary, or a compaction artifact.**
   *This is the GPT-5.6-Sol injection path that produced `ORIGIN` in `lesson-store.mjs`: a
   hallucinated "the user corrected me…" becoming a gate. An extractor that accepts synthesized
   dialogue is that attack, automated.*

### Aggregate: **CandidateLesson**

**Invariants:**

1. **`origin` is ALWAYS `model-inferred` and `status` is ALWAYS `candidate` — including when the
   user's words are quoted verbatim.**
   *`user-stated` means a human asserted the rule, not that a matching string was found. Anything
   that can write plausible dialogue into a transcript — a cloned repo, a compaction summary, the
   model itself — would otherwise mint blocking rules.*
2. **Exactly one Correction backs exactly one CandidateLesson.** No merging, no clustering, no
   "consolidated from 6 similar corrections."
   *Merging destroys the verbatim quote, which is the only thing a human can rule on in seconds.*
3. **`projects` has length 1 at creation, always.**
   *Extraction may never assert breadth it did not observe. Breadth is ADR-029's evidence, and
   fabricating it defeats the promotion bar rather than clearing it.*
4. **`repeatCount` is NEVER written from the extractor's own detection count.**
   *DDD-0005 defines repeat count as **how many times the user had to teach the same thing**, and
   `weightOf()` feeds it into ADR-031's objective function. An extractor counting its own detections
   would convert detector noise into evolutionary pressure — the "contaminated proxy" the adversarial
   review already caught once, re-entering through a new door.*
5. **`statement` is immutable; `proposedGeneral` is additive and never replaces it.**
   *Once "never show me a page you haven't looked at" silently becomes "always verify visual output",
   the evidence no longer constrains the rule and nobody can tell which the owner agreed to.*
6. **A CandidateLesson may not be constructed at an enforcement level above `checklist`.**
   *Defence in depth: `makeLesson()` already refuses, but this context must not rely on a downstream
   throw to keep its own promise.*

### Aggregate: **Detector** (a policy, not an entity)

**Invariants:**

1. **The Detector returns nothing unless all four Signals hold.** Silence is the default return value.
   *Constraint: never fabricate. If unsure, emit nothing — a missed lesson costs one repetition, and
   the repetition is itself ADR-030's escalation signal, so misses are self-healing.*
2. **The Detector MUST NOT write until its Operating point has been measured against a human-labelled
   set of ≥ 100 detections at ≥ 90% precision.**
   *The only measurement to date is ≈27%, and it was self-graded. A detector that has never been
   measured has no operating point — it has a hope.*
3. **The Detector MUST NOT emit anything to the user.**
   *The per-prompt context nag was deliberately removed from this user's global config on 2026-07-06
   for interrupting the flow. Re-adding it as "I think I learned something" is the same defect
   rebranded.*
4. **The Detector fails open and exits 0 on every path.**
   *House invariant, shared with `learn-capture.sh`, `ground-ruvnet.sh`, `lesson-hooks.sh`,
   `hook-input.mjs`. A hook that breaks a turn is disabled within a day, and a disabled hook protects
   nothing.*

### Aggregate: **Retirement**

**Invariant: `demoted`, `dormant`, and `stale` are three distinct states and MUST NOT be collapsed.**

| State | Means | Decided by |
|---|---|---|
| `demoted` | the lesson is **wrong** | human only; sticky forever (ADR-030 §5) |
| `dormant` | the lesson **stopped mattering** | *proposed* automatically, ruled on by a human |
| `stale` | the lesson's `check` **references something gone** | automatic — machine-verifiable |

**Invariant: retirement NEVER deletes.** It changes weight and visibility only.
*ADR-030 §5's argument is symmetric: if a demote the miner silently undoes is theatre, a retirement
the user cannot undo is worse — unrecoverable automation is what makes people switch a system off.*

**Invariant: `dormant` is proposed, never applied.**
*"The gate stopped catching it" has two opposite readings — the rule stopped mattering, or **the rule
worked and the behaviour was fixed**. No available signal distinguishes them, so automating it would
retire precisely the lessons that succeeded.*

---

## Domain events

| Event | Emitted when | Consumed by |
|---|---|---|
| `UtteranceObserved` | the prefilter queues a candidate turn | the detached extractor |
| `CorrectionDetected` | all four Signals hold | CandidateLesson construction |
| `DetectionRejected` | one or more Signals failed — **with which one, and on what span** | the precision ledger |
| `CandidateProposed` | a CandidateLesson is written to the store | the ratification surface |
| `CandidateRatified` | the human accepts it | **Learning (DDD-0005)** — the only crossing into policy |
| `CandidateRejected` | the human refuses it | the precision ledger; sticky, never re-proposed |
| `GeneralizationProposed` | a broader phrasing is offered alongside the verbatim | ratification |
| `LessonWentDormant` | the dormancy proposal is raised | a human, for a ruling |
| `LessonWentStale` | a `check`'s artifact no longer exists | enforcement (suspends it) |

**`DetectionRejected` is the event this design most depends on and is the easiest to omit.** Without
recording *why* a detection failed, precision can never be measured, only asserted — and this ADR's
entire shipping gate is a precision number. A detector that logs only its successes is a detector
whose accuracy is unknowable by construction, which is the same defect as `learn-capture.sh`
reporting healthy at both ends while the pipe between them was severed.

`CandidateRejected` must be **sticky**, for the identical reason demotion is: a rejection the next
extraction run silently re-proposes teaches the user that the control does nothing.

---

## Anti-corruption layer

Three boundaries where a foreign model must not leak in.

### 1. Against Learning (DDD-0005) — the important one

We **construct** through `makeLesson()` and let its invariants reject us. We never reimplement its
validation, and we never work around a throw.

Specifically, this context **may not**:

- set `origin` to anything but `model-inferred`, or `status` to anything but `candidate`;
- call `ratify()`, or any path that raises enforcement;
- write `repeatCount` from its own counts (invariant 4 above);
- assert `projects.length > 1`;
- add a value to the `TRIGGERS` enum. *If an extracted correction needs a trigger that does not
  exist, that is a DDD-0005 design review — never a per-lesson addition. Its trigger set not growing
  with the lesson count is the load-bearing constraint of the whole architecture, and an automatic
  writer is the single most likely thing to breach it.*

Direction of translation: our **Correction** becomes their **`evidence[]`** at the boundary. Their
Lesson never becomes our Correction. If Learning's schema changes, we adapt; Learning does not learn
our vocabulary.

### 2. Against Claude Code's transcript format

A format we do not control, that changes without notice, and that holds secrets — file contents, API
keys in command output, client names, private paths.

- We read **user-role text only**. Never tool results, never file contents, never assistant text
  beyond the minimal action descriptor needed for Adjacency.
- A parse failure is silence, never a guess. *The `hook-input.mjs` lesson: `([^"]*)` cannot cross an
  escaped quote, and the hand-rolled regexes failed open on exactly the payloads most worth reading.
  Only a real parser is correct, in one place, with a known-bad fixture.*
- Quotes are bounded and secret-redacted before storage. **A transcript reader is a new leakage
  surface**, and the store is user data that outlives the bundle.

### 3. Against ADR-029's mining

Extraction produces **project-scoped candidates**. It does not classify universality, does not read
other projects, and does not compute rediscovery. Mining reads *ratified* extractions as one input
among several.

*The rule exists because automation breaks the evidence it feeds: an extractor running everywhere
manufactures "independent rediscovery" from one templated instruction file cloned into two repos —
clearing a bar explicitly designed to be unfakeable. Keeping the two contexts apart, with human
ratification mandatory in between, is what keeps ADR-029's arena human.*

---

## What this context deliberately does NOT own

- **Whether a lesson acts, and how forcefully** → Learning, DDD-0005.
- **Whether a lesson is universal** → ADR-029's mining, which reads our ratified output.
- **The objective function and evolutionary search** → Darwin, referenced by DDD-0005.
- **Machine and capability state** → Capability, DDD-0006.
- **The user's transcripts.** We read them; we never write, move, or prune them.

---

## The failure this context is designed around

Stated once, because every invariant above descends from it:

> **A store full of garbage is worse than an empty one, and the store cannot tell the difference.**
>
> Measured 2026-07-22 across 1,298 transcripts: a naive correction detector fires on 42.1% of user
> turns. A tightened one fires on 4.7% and is right about 27% of the time — self-graded, so
> optimistically. Three of every four rows it would write are not lessons: harness scaffolding,
> agreement that starts with "No", and disputes about facts.
>
> A missed lesson costs one repetition, and the repetition is itself the escalation signal. A
> fabricated lesson costs the user's trust in every row beside it — and, once it reaches the
> objective function, becomes something an evolutionary search will faithfully optimise toward.

Extraction is therefore built as a sequence of refusals: four required signals rather than any, a
verbatim quote rather than a summary, `model-inferred` even when quoting the user, one Correction per
candidate, breadth never asserted, and a measured precision floor that gates shipping rather than
describing an ambition. **Silence is the correct output in every case where the system is unsure,
and it is by far the most common correct output.**
