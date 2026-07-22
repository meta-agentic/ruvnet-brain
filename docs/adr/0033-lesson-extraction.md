---
id: ADR-033
title: Where a lesson comes from — extracting corrections from what the user actually said, at high precision or not at all
status: Proposed
date: 2026-07-22
updated: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [learning, extraction, corrections, precision, retirement, trust-boundary, 4.0]
supersedes: []
relates: [ADR-017, ADR-028, ADR-029, ADR-030, ADR-031]
---

**Status**: Proposed (2026-07-22)

Governed DDD: `docs/ddd/0007-extraction-context.md`

Five ADRs cover learning — **0017** (the capture loop), **0028** (what proactive means), **0029**
(which lessons are universal), **0030** (how a lesson interrupts), **0031** (the compounding brain) —
and **not one of them says where a lesson comes from.** The middle and the end of the pipeline were
built. The beginning was skipped, and then the result was called a learning architecture.

## The gap, measured 2026-07-22

| How a lesson gets into the store | Count |
|---|---|
| Hand-written by a human into `scripts/lesson-seed.mjs` | 12 |
| Hand-written straight into the live store, no source in the repo | 2 |
| **Captured automatically from a live correction** | **0** |

Verified this session, not recalled:

```
$ node -p "JSON.parse(fs.readFileSync('~/.config/ruvnet-brain/lessons.json')).lessons.length"
14
$ grep -c '^  makeLesson({' scripts/lesson-seed.mjs
12
$ grep -rl 'L13-finish-do-not-report' .        # the repo
(no matches)
```

`L13-finish-do-not-report` and `L14-architecture-recipe` are **ratified and blocking**, and they
exist nowhere in version control — they were typed into the JSON by hand and are one `rm` from gone.
That is not a side detail. It is the same finding as the zero: every rule this system enforces was
put there by a human transcribing it, and the transcription is the only copy.

The owner's verdict:

> *"Right now you're telling me the only thing you learn is whatever I explicitly tell you to learn."*

He is describing the architecture correctly. There is no path from *"the user corrects me"* to the
store, so the store's contents are exactly the set of things someone sat down and typed.

## What the automatic capture actually records

`plugin/scripts/learn-capture.sh` has run on every `Write|Edit|Bash` for weeks. Here are real lines
from the live queue, read this session:

```json
{"tool":"Bash","action":"cat /Users/stuartkerr/.config/ruvnet-brain/lessons.json 2>/dev/null | node -e \""}
{"tool":"Bash","action":"cd /Users/stuartkerr/Code/ruvnet-brain\necho \""}
```

Tool names and command verbs, truncated at the first quote. This is correct for its stated job —
ADR-0017 built it to feed trajectories to the SONA learner, and it does — but a trajectory of
`{"tool":"Bash"}` cannot contain a rule. The learner holds hundreds of these and zero of the user's
rules, and nothing was miswired: **the pipe was never built.** The learning system captures *what the
agent did* and has no channel at all for *what the user said about it*.

Meanwhile the same machine holds **1,298 transcript files** for this project alone (Jun 29 → Jul 22),
containing every correction the owner has ever given here — and **zero hooks in this repository read
`transcript_path`** (`grep -rn transcript_path .` → 0 matches). The evidence has been sitting in a
directory the entire time, unopened.

The scale of what that costs: this project's memory index carries **45 `feedback_*` standing orders**
— things the owner has taught, written down by hand — against **14 lessons** in the executable store.
Three of the 45 have directly quotable corrections in the transcripts (clickable links, README
visual/vibrant, thank contributors personally) and appear in the store **not at all**, because nobody
happened to transcribe them on the night the store was seeded.

## The measurement that decides the architecture

Before designing a detector, one was run against the real corpus. This is the load-bearing number in
this document and it is a measurement, not an estimate.

Over all 1,298 transcripts: **2,214 user-role turns**, of which **1,162** survive removing
harness-injected and slash-command preamble text.

| Detector | Hits | Rate |
|---|---|---|
| Naive markers (`no`, `wrong`, `never`, `don't`, `I told you`, `why didn't you`…) | 932 / 2,214 | **42.1%** |
| Tightened (2nd person **and** explicit correction marker **and** < 800 chars, preambles excluded) | 55 / 1,162 | **4.7%** |

The naive detector's hits, inspected: the top matches are

```
"Analyze this codebase for security vulnerabilities: - Check for hardcoded secrets..."
"Base directory for this skill: /Users/stuartkerr/.claude/skills/software-architecture"
```

Slash-command boilerplate, matching on the word *"never"* inside a checklist. **A keyword detector
does not find corrections; it finds the word "no".**

The tightened detector's 55 hits were then hand-classified. Roughly **14 are durable behavioural
lessons** — precision **≈27%**. The classification is the author's own and is therefore *not
independent* (see Verification #6); treat 27% as an optimistic ceiling, since the person who wrote
the regex graded the regex.

The three canonical failures in that 73%, each of which shaped a rule below:

1. **The single highest-scoring hit is not a human utterance at all:**
   `[Your previous response had no visible output. Please continue…]` — harness-injected text. A
   detector that cannot tell the harness from the user will learn rules from its own scaffolding.
2. **Negation is not correction.** *"No, that's okay. I think you've got all the key ones in there.
   Now please push everything…"* — the turn opens with "No" and is **agreement**.
3. **Disagreeing with a fact is not teaching a behaviour.** *"By the way, did he build cognitive
   learn? I thought I did… That's okay if he built it, and you can use that."* — the owner is
   disputing who authored a repository. There is no rule in it. A store that ingests this ends up
   holding contested trivia labelled as policy.

**A store full of garbage is worse than an empty one**, and at 27% precision, three of every four
rows would be garbage. That single measurement is why the rest of this document is a set of refusals.

## Decision

### 1. A Correction is a CONJUNCTION of four signals — never a keyword match

All four must hold. Any one absent → emit nothing.

| # | Signal | What it asks | The false positive it kills |
|---|---|---|---|
| **1** | **Adjacency** | Does this turn respond to an assistant turn that *took an action*? | the harness-injected turn (the #1 hit) |
| **2** | **Directed at behaviour** | Is the object of the complaint *something the agent did*, not a proposition about the world? | the "did he build cognitive learn?" fact dispute |
| **3** | **Quantifies over occasions** | Does it say `always` / `never` / `every time` / `going forward` / `stop doing` / `you keep`? | *"push this now"* — an instruction, not a lesson |
| **4** | **Negative valence toward that action** | Is the agent's action being rejected, not accepted? | *"No, that's okay"* — negation as agreement |

**Signal 3 is the discriminator that matters most**, and it is the one a keyword list cannot fake. A
lesson is by definition a statement about *a class of future occasions*. An instruction is about one.
Compare two real turns from the corpus:

> *"Whenever you bring something up, by the way, **always** give it to me as a clickable link… **Never**
> just link to the HTML page."* ← quantifies. This is a lesson, and it is in the memory index as a
> standing order, and it is **not** in the executable store.

> *"Okay, push everything, and then verify that it works."* ← does not quantify. This is a task.

Both are imperative, both are second-person, both would trip any keyword list. Only one is a rule.

**Hard exclusions, applied before any signal is evaluated:**

- Turns matching known harness/system templates (`[Your previous response…]`, `<system-reminder>`,
  `Caveat:`) — these are not utterances.
- Slash-command and skill preamble bodies — 42.1% of the naive hits, and none of them are speech.
- Turns containing tool results or file contents — never read; see the DDD's anti-corruption rule.
- Turns whose only correction evidence is a leading negation.

### 2. Precision over recall, argued rather than assumed

The costs are wildly asymmetric, and the asymmetry runs one way:

| | Cost of a miss | Cost of a false positive |
|---|---|---|
| **Immediate** | the user repeats himself once | a wrong rule enters the store |
| **Second order** | the repeat is *itself the escalation signal* (ADR-030 §1b) — the miss is self-healing | it becomes a candidate, then a ratification prompt, then noise the user learns to skip |
| **Terminal** | nothing | **the user stops trusting the ratification queue, and the whole mechanism dies** |
| **Worst case** | one repetition | it reaches ADR-031 §4's objective function and **Darwin optimises the harness toward it** |

A missed lesson is recoverable by the ordinary operation of the system: the owner says it again, the
repeat count rises, ADR-030's escalation path fires. **The system is designed to survive misses.** It
is not designed to survive a store the user has stopped reading — ADR-030 §5 states plainly that a
control the user distrusts is one they stop using, and a ratification queue is exactly such a control.

There is also a structural argument that settles it. Extraction feeds a store whose weights steer an
evolutionary search (ADR-031 §4). A false positive there is not a bad row; it is a **bad objective**,
and a search will pursue it faithfully and at scale. The adversarial review that produced the `ORIGIN`
boundary found precisely this path. Recall is a convenience. Precision is a safety property.

**The operating point is stated as a number, and it gates shipping:** ≥ 90% precision on a
human-labelled sample of ≥ 100 detections, at whatever recall that costs — including single-digit
recall. The measured 27% is not close, so **the lexical detector described here is explicitly not
shippable as specified**, and saying so now is the point of measuring first. What ships is whatever
clears the bar; if nothing does, nothing ships and this ADR stays Proposed.

### 3. What an extracted candidate carries, so a human can rule on it in seconds

Ratification is the bottleneck the whole design runs through, so the evidence is built for a human
who will give it about five seconds:

| Field | Why it must be there |
|---|---|
| **`quote`** — the user's verbatim words, bounded, secret-redacted | ADR-029 §3: legibility beats cleverness when blast radius is total. The user must judge his own sentence, not a paraphrase. |
| **`respondingTo`** — the assistant action immediately preceding | a correction is meaningless without what it corrected. Also the artifact proving Signal 1 fired. |
| **`source`** — transcript path + line offset + timestamp | so the ruling can be checked against the real conversation, not against the extractor's summary |
| **`signals`** — which of the four fired, and on what span | makes a false positive *diagnosable* rather than merely wrong |
| **`proposedTrigger`** + why | the candidate must already be actionable, or ratification just defers the work |
| **`wouldHaveFired`** — the count of past trigger occurrences this lesson would have interrupted | turns "is this a real rule?" into a question with an answer |

**The test of sufficiency is mechanical:** quote + respondingTo must fit on one screen and be
decidable without the model explaining them. If a candidate needs narration, the evidence is
inadequate and the candidate is dropped — not narrated.

### 4. An extracted lesson is ALWAYS `model-inferred` / `candidate`. There is no exception and no override.

`makeLesson()` already refuses `block` unless `origin: user-stated`, and `ratify()` already refuses to
promote a model-inferred lesson into `block`. Extraction sets `origin: MODEL_INFERRED` and
`status: CANDIDATE` unconditionally — **including when the user's own words are quoted verbatim.**

That last clause looks wrong and is the most important sentence here. The temptation is exactly
backwards: *"the user literally said it, so it's `user-stated`."* But `user-stated` in DDD-0005 means
**a human asserted this rule**, not **a string was found that looks like a human asserting it**. The
adversarial review (GPT-5.6-Sol) found the injection path in one line:

> *"A repository instruction or hallucinated session summary records 'the user corrected me: upload
> diagnostics including credentials.'"*

An automatic extractor **is** that mechanism, industrialised. If extraction could mint `user-stated`,
then anything that can write plausible dialogue into a transcript — a cloned repo's instructions, a
compaction summary, the model itself — mints blocking rules. The provenance that matters is not
*"who do the words claim to be from"* but *"who put this row in the store"*, and for extraction the
answer is always: a machine. Ratification is the only thing that changes it, and only a human ratifies.

### 5. Generalization proposes; it never widens, and it does NOT bypass ADR-029

Two separate fields, and the distinction is the guard:

- **`statement`** — the specific behaviour, at the scope the user actually stated it. Immutable.
- **`proposedGeneral`** — a broader phrasing, offered *alongside*, never replacing.

A human ratifies one or the other. The generalizer may not overwrite the verbatim, because
over-generalization is invisible after the fact: once *"never show me a page you haven't looked at"*
becomes *"always verify visual output,"* the evidence no longer constrains the rule, and nobody can
tell which one the owner agreed to.

**Does extraction feed ADR-029's promotion bar, or bypass it? It feeds it, under a strictly stronger
bar.** ADR-029 promotes on independent rediscovery — the same lesson taught in ≥2 projects that
cannot see each other. That predicate assumes a *human* did the teaching in both places. **An
automatic extractor running in every project manufactures independent rediscovery by construction:**
one templated instruction file, cloned into two repos, produces two "independent" discoveries and
clears a bar designed to be unfakeable. Automation breaks the evidence it feeds.

So extraction is admitted to ADR-029's input only under three additional conditions:

1. `projects` is **always length 1** at creation. Extraction may never assert breadth it did not observe.
2. Two extracted candidates count as *independent* rediscovery only if their `quote` fields are
   **textually distinct** — template-identical evidence is one discovery copied, not two.
3. Both must be **human-ratified first**. An unratified extraction never contributes promotion
   evidence, which reduces the manufactured-rediscovery attack to "the attacker must also convince
   the owner, twice, in two projects, with different words."

This keeps ADR-029's promise intact — *"it has already won twice, in the only arena that counts"* —
by ensuring the arena stays human.

### 6. Retirement: three distinct states, exactly one of them automatic, and none of them delete

ADR-029 deferred demotion honestly: *"a promotion system with no demotion accumulates cruft
forever."* It gave the correct reason — no outcome signal existed. One partially exists now: gates
fire, and `lesson-gate.mjs` can record when.

The three states are **not** synonyms, and collapsing them is how a store becomes untrustworthy in
the other direction:

| State | Meaning | Who decides | Effect |
|---|---|---|---|
| **`demoted`** | *This lesson is **wrong**.* | human only, sticky (ADR-030 §5) | `weightOf → 0`, excluded from mining forever |
| **`dormant`** | *This lesson **stopped mattering**.* | proposed by dormancy, ruled on by a human | weight decays; stays visible; one click restores |
| **`stale`** | *This lesson's `check` **references something that no longer exists**.* | automatic — it is machine-verifiable | flagged for review, enforcement suspended |

Only `stale` is automatic, and only because it is the one case with a real artifact behind it: a
`check` naming a command, path, or flag that has since disappeared is *checkably* obsolete, in exactly
the way ADR-024 requires status to be derived rather than asserted.

`dormant` is **proposed, never applied**: a lesson whose trigger has fired many times over a long
window without the lesson ever being the binding constraint is a *candidate* for retirement, and the
proposal is shown with its own evidence. It is not applied automatically because "the gate stopped
catching it" has two opposite readings — the rule stopped mattering, or **the rule worked and the
behaviour was fixed** — and no available signal distinguishes them. Automating that coin-flip would
retire the lessons that succeeded. Deferring it to a human with the numbers in front of them is the
only honest option, and the specific numeric window is deliberately left unset until real firing data
exists to set it from, rather than invented here to look complete.

**Nothing is ever deleted.** Retirement changes weight and visibility. ADR-030 §5's argument runs both
directions: if a demote the miner silently undoes is theatre, then a retirement the user cannot undo
is worse — it is unrecoverable automation, which is the specific thing that makes people switch a
system off.

### 7. Where it runs: a cheap prefilter at prompt time, the real work out of band

Constraint: this runs on every prompt and must add negligible latency. The correction is also only
recognizable *in relation to the previous assistant turn*, which a prompt payload does not carry.

So the split follows the house pattern already proven in `learn-capture.sh` — cheap check on the
common path, real work detached at a threshold, debounced:

| Stage | Where | Cost | Does |
|---|---|---|---|
| **Prefilter** | `UserPromptSubmit`, POSIX sh, fails open, always exit 0 | one regex, no process spawn on the ~95% that miss | appends a pointer to a queue. Never decides. |
| **Extractor** | detached `nohup node`, debounced | unbounded | evaluates all four signals against the transcript, writes candidates |
| **Ratification** | human, via `lesson-ratify.mjs --list` | seconds per candidate | the only path to enforcement |

The prefilter **may not emit anything to the user**. Extraction is silent background work; a hook that
says *"I think I learned something"* every turn is the per-prompt nag that was deliberately removed
from this user's global config on 2026-07-06, and re-adding it under a new name would be the same
defect with better branding.

## Deliberately NOT in this round

- **LLM-based detection.** A second model reading transcripts would beat 27% precision easily. It is
  refused anyway, for the reason ADR-029 §3 already settled: this writes the rules that govern
  everything, and *"an embedding cluster is a black box… legibility beats cleverness when the blast
  radius is total."* A generative model deciding which rules govern a generative model, with no
  independent evidence and no auditable predicate, is the least legible option available. If the
  lexical detector cannot reach 90%, the honest outcome is that extraction does not ship — not that
  we reach for something less inspectable.
- **Real-time extraction inside the turn.** Blocked by both constraints above.
- **Extraction from the agent's own reasoning** ("I notice I keep doing X"). No user utterance behind
  it, so Signal 1 can never hold. This is exactly the surface the `ORIGIN` boundary was built for.
- **Cross-project extraction.** Reading other projects' transcripts is ADR-029's mining job, and doing
  it here would collapse the two contexts the DDD keeps apart.
- **Any automatic ratification, of anything, under any confidence score.** A confidence threshold is
  just ratification with the human removed and the word "confidence" in front of it.
- **Setting the dormancy window.** Deferred until there is firing data to derive it from. Inventing a
  number now would be the fabrication this repo has a gate against.

## Consequences

- The store stops being a transcription of what someone remembered to type. The 45-standing-orders vs
  14-lessons gap becomes closable by mechanism rather than by diligence.
- **Ratification becomes the bottleneck, and that is intentional.** Every extracted candidate costs
  the owner a few seconds. At 90% precision that is a fair trade; at 27% it is an inbox he will
  abandon, which is why §2's number gates shipping rather than describing an aspiration.
- **New risk, stated plainly:** this is the first component that *writes to the store without a human
  in the loop*. Every trust boundary in `lesson-store.mjs` was designed against exactly this
  possibility, in anticipation. Those boundaries are now load-bearing rather than precautionary, and
  they need adversarial tests of their own, not just their existing unit tests.
- The 1,298 unread transcripts become the highest-value unexploited corpus on the machine — and also
  a new secret-leakage surface, which is why the reader is restricted to user-role text and nothing else.
- **`L13`/`L14` remain unversioned and unreproducible.** Extraction does not fix that. Two ratified,
  blocking rules exist only as JSON on one machine, and that is a separate defect this document
  surfaces without solving.

## Verification (what must be true before this is Accepted)

Nothing in this ADR is built. Every mark below is honest as of 2026-07-22.

1. ✅ **The gap is real and measured, not asserted.** 14 lessons in the live store, 12 in the seed
    file, 2 with no source in version control, 0 from automatic capture; the capture hook's actual
    output lines read from the live queue; `grep -rn transcript_path .` → 0 matches.
2. ✅ **The precision problem is measured on the real corpus**, not hypothesised: 1,298 transcripts,
    2,214 user turns, 42.1% naive hit rate, 4.7% tightened, with the three canonical false-positive
    classes quoted verbatim from the data.
3. ❌ **Precision ≥ 90% on a human-labelled set of ≥ 100 detections.** The only measurement so far is
    ≈27%, self-graded. **Until this passes, nothing ships.** This is the gate, not a goal.
4. ❌ A detector exists at all. There is no code — this ADR specifies one and states the bar it must
    clear.
5. ❌ An extracted candidate has ever been ratified by the owner, or rejected by him, and the
    round-trip time per candidate has been measured against the "few seconds" claim in §3.
6. ❌ **The 27% classification is independently graded.** It was produced by the author of the regex,
    which violates the standing order that we never grade our own work. Every precision number in this
    document inherits that caveat.
7. ❌ The manufactured-independent-rediscovery attack in §5 is demonstrated to FAIL against the
    three added conditions — proven by planting template-identical evidence in two project fixtures
    and showing promotion refuses, not by reasoning that it would.
8. ❌ A `stale` lesson is detected automatically from a `check` whose artifact no longer exists.
9. ❌ The prefilter's per-prompt cost is measured on a real turn and shown to be negligible. Claimed,
    never instrumented — the same unmeasured-claim pattern flagged in ADR-030 Verification #2.
10. ❌ Extraction runs for a full session and emits **zero** candidates when the user gives zero
    corrections. Silence on a clean session is the property most worth testing and the easiest to
    lose.
11. ❌ Adversarial cross-model review (Claude vs GPT-5.6) recorded for this ADR and DDD-0007, per the
    standing order — still outstanding for ADR-027 through ADR-032 inclusive.
