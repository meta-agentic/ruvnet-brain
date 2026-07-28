# DDD-0013 — The Verdict context and the External-Signal context

Updated: 2026-07-27 | Version 1.0.0
Created: 2026-07-27

Governs **ADR-058** (the 95 contract). Relates: DDD-0004, DDD-0005, DDD-0008, DDD-0010, ADR-050,
ADR-053, ADR-055.

**Status**: Proposed (2026-07-27) · two-sided duel (Claude Fable 5 + GPT-5.6-Sol)

---

## Why two contexts, and why they share nothing

**Verdict** answers *"may this candidate claim health?"* — batch, SHA-addressed, runs in CI.
**External-Signal** answers *"did the world outside this repo just go red, and does the user know?"*
— event-driven, runs on the user's machine, speaks in-session.

They share **nothing** but the word "verdict". A shared kernel is **refused**, and the refusal has a
price attached: the last time a predicate was shared across channels, **all channels failed
together** — ADR-050's issue pipeline, where one poisoned owner-comment predicate silenced every
alarm at once. Two contexts that fail independently beat one that fails completely.

---

## Context 1 — VERDICT

### Ubiquitous language

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Invariant** | One of the eight named release-critical properties | a test, a suite, a percentage |
| **InvariantResult** | `PASS · FAIL · UNKNOWN` **on a stated SHA**, with its evidence artifact | a boolean |
| **UNKNOWN** | the detector could not tell | a pass, a skip, or "probably fine" |
| **Mutant** | a deliberate break that MUST turn a check red | a hypothetical |
| **Verdict** | the vector **minimum** over all eight | an average, a score, a composite |

### Aggregate: **CandidateVerdict** (root: the candidate SHA)

**Invariants — each tied to a real, dated failure:**

1. **No verdict exists without all eight results present; an absent result is `UNKNOWN`, and
   `UNKNOWN` is never `PASS`.**
   *`behavioral-l1-l4.mjs --levels L5` printed `OVERALL: PASS` on zero executed checks, exit 0. A
   run that measured nothing certified itself.*
2. **The verdict is the vector minimum. No averaging operation exists on this aggregate — by
   construction, no method computes a composite.**
   *18/100 on a stranger's machine coexisted with "all pass" on one README page because a composite
   absorbed the worst number.*
3. **Append-only: a verdict for SHA X is never edited, only superseded by a verdict for SHA Y.**
   *Gate C++ v1 graded the parent commit.*

### Aggregate: **IncidentCorpus**

4. **Every case cites a real incident, and every listed incident has ≥1 case.**
   *Four issues — #12, #13, #41, #44 — on one file, with no regression corpus between them.*
5. **Every detector has at least one false-POSITIVE case and one false-NEGATIVE mutant.**
   *Four of the five incidents were false positives. A corpus that only catches misses recreates the
   one-sided fix pattern that produced five patches.*

### Aggregate: **CounterfactualTrap**

6. **A trap whose CONTROL run passes is INVALID — the result is `UNKNOWN`, never a pass.**
   *L4's `must:` string list could not fail on broken behaviour and certified "behavioral, all pass"
   for weeks. This is its exact inversion.*
7. **A surviving mutant anywhere is a stop-the-line event: the release gate goes FAIL, not warn.**

### Domain events
`InvariantMeasured` · `CandidateDegraded` · `MutantSurvived` (stop-the-line) · `CorpusCaseAdded` ·
`TrapInvalidated`

---

## Context 2 — EXTERNAL-SIGNAL

### Aggregate: **SignalDebt**
Root: `(source, repo, ref)` — e.g. `(gh-ci, stuinfla/ruvnet-brain, <sha>)`, `(vercel, project,
deployId)`, or `(cli, session, toolUseId)` for an observed non-zero exit.
States: `pending → resolved(conclusion) | unverifiable(reason)`. **No other transitions.**

**Invariants:**

1. **UNKNOWN STAYS OPEN.** An API error, rate-limit, or missing/unauthenticated CLI resolves
   **nothing**; the debt persists as `pending` or becomes `unverifiable` with a stated reason.
   *`ci-verdict.mjs`'s existing law — an unknown main is a red main — and the founding incident: CI
   red while every local surface stayed calm and the OWNER had to report it.*
2. **Speak on TRANSITIONS only. Green produces zero bytes** unless it closes a previously-surfaced
   red, which earns exactly one closing line.
   *`hijack-ruvnet.sh:9` already learned this for blocking — a false-positive-heavy interceptor
   bricks trust and gets disabled. It holds identically for speech.*
3. **One writer per state file.** `pending.jsonl` is written only by the signal-watch hook;
   `ci-status.json` only by the poller.
   *F10/F21: SessionEnd's three concurrent uncoordinated writers.*
4. **Observation never blocks and never manufactures a refusal.** A watcher malfunction — parse
   failure, unexpected envelope shape — degrades to silence plus a health record.
   *ADR-055 §1.2: malfunction ≠ decision.*
5. **A surfaced red carries the actionable minimum**: CLI name, exit or conclusion, the first
   actionable stderr line or run URL, and the one-line fix where known.
   *`install.mjs`'s lesson — a diagnostic that discards the diagnosis cost a real reporter a
   debugging session.*
6. **Silent-off is scored equal to crashing.** A capability that cannot function must SAY so, once,
   with the fix.
   *`hijack-ruvnet.sh:31`'s `command -v jq || exit 0` disables the entire interceptor on a jq-less
   machine and tells nobody.*

### Aggregate: **SurfacingLedger** (root: session)

7. **Once per debt per transition, dial-governed (ADR-052), dismissal respected.**
   *The 22 duplicate public comments of the #38 state-clobber incident — dedup state is part of the
   domain, not an implementation nicety.*

### Domain events
`CliOutcomeObserved` · `PushObserved` · `DeployObserved` · `VerdictResolved` · `SignalSurfaced` ·
`SignalDismissed` · `DebtMarkedUnverifiable` · `WatcherDegraded`

---

## Anti-corruption boundaries

**Against Claude Code's hook contract.** One translator: `hook-input.mjs`. Exit semantics
(`0 allow · 2 block`), envelope field access, and command classification never appear outside it.
The Bash `tool_response` shape enters the domain **only** through fixtures captured from real
envelopes; the domain holds `CliOutcome {exitClass, firstActionableLine}`, never raw host JSON.
*The #13 regex-truncation and the F20 held-open-stdin classes both lived exactly at this boundary.*

**Against git.** A SHA is an opaque identity token. Push detection comes from `commandNodes()`
**executable-position** classification, never a string grep — *a commit message containing "git push"
is DATA, the #12 lesson generalized.* We never parse porcelain; only documented `--json` output
crosses, translated by one adapter.

**Against gh / vercel / netlify.** A `VerdictProvider` port per CLI; adapters are fixture-injectable
so CI needs neither network nor auth. **CLI absence and unauthenticated states are TYPED capability
states, not errors.** Adapters carry a **read-only verb whitelist**; a state-changing verb in an
adapter is a boundary violation the mesh lint fails.

**Against the user's settings.json and third-party plugins.** Enumerate, report, **never execute,
never charge, never mutate** — with the byte-equivalence invariant as proof. Their hooks' health is
THEIR truth; inventing a verdict for a foreign hook is fiction.

**Against rUv's ADR status enum.** Neither context writes rUv's enum values into repo documents, and
neither treats an ADR status as a runtime fact — status claims are DERIVED (ADR-024/ADR-037), never
asserted from a document field.

---

## What these contexts do NOT own — plainly

- **The model's obedience.** No context can own it. Verdict measures **artifacts and order**; it
  never claims to have measured intent. *This sentence is the entire correction of L4.*
- **GitHub issue SLA semantics** — the Issue-Pipeline context (ADR-050) owns those. External-Signal
  shares its session-start surfacing **pattern**, never its **predicates** — the
  one-poisoned-predicate incident is why.
- **Heavy-path retrieval performance** — the Performance surface owns the 19.6s rerank; Verdict gates
  only the decision lane it was promised.
- **Lesson storage and promotion** — the Learning context (DDD-0005). D4's traps consume lessons
  through its public face and never touch its stores.
- **The user's CI configuration** — we read verdicts about their pipelines; we never write workflows
  into their repos.
- **Claude Code's parallel hook scheduling** — hooks fire in parallel by host contract; the mesh
  invariants constrain OUR registrations only.

---

## Currency log

| Date | What changed | Why (with referents) |
|---|---|---|
| 2026-07-27 | Created | Bounded contexts for ADR-058. Two-sided duel; both designs independently produced a tri-state per-invariant verdict and a vector-minimum release gate, and both refused a shared kernel between the two contexts for the ADR-050 reason. Every invariant above is tied to a dated failure in this repo, not to a principle |
