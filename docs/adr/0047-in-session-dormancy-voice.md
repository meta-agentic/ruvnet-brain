---
id: ADR-047
title: In-session dormancy voice — session-start delivery, a stable ceiling, and no offer without a verified undo
status: Rejected
date: 2026-07-24
updated: 2026-07-24
authors: [Stuart Kerr, Claude Code]
tags: [proactive, advocacy, L3, dormancy, session-start, consent, 4.0]
supersedes: []
relates: [ADR-027, ADR-028, ADR-032, ADR-040, ADR-043, ADR-045, ADR-046]
governs:
  - plugin/scripts/anticipate.sh
  - plugin/scripts/unprompted-runtime.mjs
  - plugin/scripts/session-start.sh
  - plugin/hooks/hooks.json
  - scripts/capability-registry.mjs
  - scripts/capability-audit.mjs
  - scripts/goal-match.mjs
  - scripts/advocacy-outcomes.mjs
  - scripts/onboarding-console.mjs
  - scripts/remedy-registry.mjs
---

**Status**: Rejected (2026-07-24)

REJECTED after a two-duelist review — Fable 5 ACCEPT-WITH-CHANGES (52/100), GPT-5.6-Sol REJECT (31/100).
Full record: `docs/reviews/0047-duel-in-session-dormancy-voice.md`. Do not implement this document.

**The diagnosis stands; the delivery system does not.** `capability-audit.mjs` still has zero callers and
is still the largest 4.0 gap. What the duel established is that this design has nothing correct to
deliver: five `turnOn` commands, ZERO verified inverses, and the one claimed exception sources its undo
from a different executor than the action it offers. Sol's arithmetic put the honest launch surface at
**zero capabilities**.

**It then went to zero in a second, sharper sense.** Fixing the five unsound OFF branches the duel found
(learner-quiet, distillation-thin, harness-evolution-ran, write-gates-advisory, session-capture-partial)
took this machine to **10 on / 1 unknown / 0 off**. There is nothing dormant here to offer. We were one
step from building a delivery system whose acceptance test could not be constructed.

**The narrowed path, in order — this is what supersedes the document below:**
1. ONE real Offer executor: a project-scoped distillation wrapper with a WAL-safe backup, a fail-closed
   durable receipt, a verified pattern delta, and a tested restore. (Verified live: raw
   `ruflo memory distill run --help` exposes no backup option.)
2. Fix the ledger contract BEFORE any hook — offer_id, session_id, scope + project identity, a monotonic
   state generation, and a transactional claim. `(key,state)` cannot distinguish off→on→off.
3. Make the ceiling survive a killed terminal; SessionEnd may enrich an outcome but cannot be what makes
   it true.
4. Real explanation fields (whatIs, whyItMatters, whatChanges, execute, undo) rather than a teaching
   paragraph derived from counter-bearing evidence prose.
5. Only then re-open whether the generic infrastructure has earned existence.

**What was salvaged and shipped from this review anyway:** all five OFF-branch corrections, and the
independent confirmation that STATE.IDLE had been wired into exactly one detector while a case literally
named 'IDLE' still returned OFF.

Governed DDD: `docs/ddd/0012-advocacy-delivery-context.md` — a policy under the Advocacy bounded
context (DDD-0004), not a new one. See that document for the boundary test applied and why it
comes out that way.

REPLACES ADR-045 (`docs/adr/0045-state-based-advocacy-the-explained-offer.md`, Rejected by both
Fable 5 and GPT-5.6-Sol — the first double-REJECT in this project) and is written specifically not
to repeat its shape. It also builds directly on ADR-046's freshness/atomicity discipline where the
two overlap (the offer ledger is itself a read-model; see §Verification).

## Why this exists

`scripts/capability-audit.mjs` answers "what capability is installed, usable, and never used?" and
has had, verified 2026-07-23, exactly one non-comment reference to itself: its own
`invokedDirectly` CLI guard (`scripts/capability-audit.mjs:294-296`). `scripts/wired-check.mjs:246-252`
already records this as a HELD module — deliberately, honestly unwired — and states in its own
words what would unblock it:

> *"HELD because the fix is a real decision — one in-session consumer that speaks unprompted, with
> a one-action permanent silence — not a line of wiring."*

That sentence is this ADR. `scripts/onboarding-console.mjs:1836-1852` names the same gap from the
other side, for the sibling file `capability-registry.mjs`: it is now wired to `/api/capabilities`
(a **pull** surface, ADR-028's own diagnosed failure), with the comment *"Detection without
delivery is a nicer way of doing nothing."* Both files agree on the defect. Neither commits to the
fix, because the fix is a design decision with real failure modes — which is exactly what ADR-045
tried to supply, and exactly where it went wrong.

## What ADR-045 got wrong, restated as the shape this ADR must not repeat

Both duelists converged on three failures (`docs/reviews/0045-duel-state-based-advocacy.md`). Each
one is a *shape*, not a one-off bug, and each has a named countermeasure in the Decision below:

| ADR-045's failure (cited) | The shape of the mistake | This ADR's countermeasure |
|---|---|---|
| Both "off" findings were false positives — one counted backlog remaining, the other flagged a correctly-declined publish as a dormancy | **Conflated "never used," "still failing," and "backlog pending" into one state.** | §1 — a named, strict `isDormant()` predicate that excludes exactly these two shapes, applied uniformly by every producer. |
| Made state-triggered findings the **primary** in-session voice, deleting goal-match's relevance gate | **Promoted the harder rung's gate away instead of adding a second channel.** | §2 — goal-match stays the unconditional gate for in-session (mid-turn) speech; state-triggered findings get a **different** channel, not a bigger microphone on the same one. |
| The ceiling didn't exist (unlocked read-modify-rename ⇒ effective ceiling of 2); `--dismiss` omitted `scope:"forever"`; `stateHashOf()` hashes evidence prose containing live counters, so a high-severity dismissal could never stick | **Declared a guarantee ("silenceable in one action, permanently") that the code beneath it could not keep.** | §3 + §5 — a stable identity that cannot be re-armed by a counter tick, and a budget that is exactly 1 at every severity so there is nothing left for a counter to re-open. |
| `turnOn` is `null` for two rows and `{human,cmd}` for the rest (renders `[object Object]` if printed raw); no `whatChanges`, no `undo` field exists at all | **Assumed a four-part explanation was constructible from data that does not carry three of the four parts.** | §6 — a validated Offer schema; a row that cannot construct one is never offered, full stop. |
| All eleven `whatItBuysYou` strings are console/pull-context copy; delivered unprompted mid-task they read as an upsell (`scripts/capability-registry.mjs:474` verbatim, quoted below) | **Reused pull-surface marketing copy as interruption copy.** | §7 — the unprompted Offer is built from measured `evidence` and the mechanical `turnOn.human` description; the console's `whatItBuysYou` string is banned from this path by construction. |
| Ordered the model to self-install hooks (Decision 4) while its own remedy registry and its own detector both document why that is unsafe today | **Asked for delivery of a Remedy class that has never had a real, reversible executor.** | §8 — hook-installing remedies stay unofferable until one lock-guarded installer with a durable consent record and an uninstall manifest exists; this ADR does not build that installer, it raises the bar such a remedy must clear. |

## Decision

### 1 — Dormancy, defined strictly, and the IDLE state already supplies half of it

**Dormant := a capability whose registry row reports `state === 'off'`, and nothing else.**

That single-line predicate is deliberately not a new mechanism. It is a *name* for what
`capability-registry.mjs` was already corrected to compute the same day this ADR was written
(3.9.50, "N3 — kill the one named false-positive class"), verified by reading the live file:

- **Backlog-pending is already excluded.** `cross-project-lessons`'s `detect()` no longer returns
  `off` for a nonzero promotable backlog; it reads the actual marker
  (`~/.claude/CLAUDE.md` containing `BEGIN ruvnet-brain: promoted-lessons`) and reports `ON` with
  the backlog as a footnote when promotion is genuinely in force
  (`scripts/capability-registry.mjs:508-529`).
- **Failing-but-installed is already excluded.** `nightly-refresh`'s `detect()` returns `STATE.ON`
  (not `OFF`) for a job that ran and exited non-zero, with the evidence sentence explicitly
  stating *"a health problem to look into, not a capability to switch on"*
  (`scripts/capability-registry.mjs:719-726`).

So the strict definition costs nothing new to state; it costs a rule that every future producer
must consume `state` rather than re-deriving "is this bad?" from evidence prose, which is exactly
the two-thresholds-for-one-decision failure this repo has paid for repeatedly (named at
`plugin/scripts/anticipate.sh:79-88`, `scripts/goal-match.mjs:264-269`, `docs/ddd/0004-advocacy-context.md`
v1.2.0 changelog).

**A third exclusion the two-category framing misses, and it already has a name and a home.**
`STATE.IDLE` (`scripts/capability-registry.mjs:90-113`) was added the same day for exactly this
shape: *"you think it's on; it is set up and it is not running."* `cheap-model-routing` is IDLE
when it has real receipts (proof it ran before) but the invoking gate is unwired
(`scripts/capability-registry.mjs:471-486`). That is not "never used" — it was used, and a wiring
defect severed it. **IDLE is a Wiring finding (DDD-0010's own vocabulary: "has ≥1 Caller"), not a
dormancy Finding**, and `isDormant()` excludes it by construction (only `'off'` qualifies, not
`'idle'`). This ADR does not build IDLE's delivery path — see §"What this does not do" — it only
makes sure IDLE can never be mistaken for OFF at the one predicate every producer must share.

**Verified the same predicate resolves `capability-audit.mjs`'s own findings correctly, without a
special case.** Its three detectors are shaped differently (bespoke evidence objects, not the
registry's four-state enum) but resolve cleanly onto the same line:

- `detectDormantEvolution` requires `idleDays > 3 && best.score > baseline`
  (`scripts/capability-audit.mjs:132`) — it ran, it improved something, *then* went idle. **IDLE-shaped, not dormant.**
- `detectFundedButIdle` requires `idleDays > 7` on a directory that already exists
  (`scripts/capability-audit.mjs:155-161`) — same shape.
- `detectLearnerIdle`'s two live branches split exactly along this line: `INITIALISED_EMPTY`
  ("genuinely records 0 trajectories and 0 patterns — it has been created but never fed",
  `scripts/capability-audit.mjs:224-236`) is **dormant** by the strict definition; `IDLE` ("it
  learned before and stopped", `scripts/capability-audit.mjs:238-253`) is **not** — and the code's
  own name for the branch is `IDLE`, borrowed from `learning-enable.mjs`'s verdict codes.

Net effect: of `capability-audit.mjs`'s four possible findings, exactly one
(`capability:learner-never-ran`) is eligible under this ADR's dormancy predicate at all. The other
three are IDLE-shaped and are explicitly out of this ADR's delivery scope (see §"What this does
not do").

### 2 — Two delivery channels, never one microphone turned up

**Goal-match remains the unconditional gate for anything spoken mid-turn.**
`plugin/scripts/anticipate.sh` is unchanged in this respect: its `suggest` mode still requires a
`matchGoal()` hit (`plugin/scripts/anticipate.sh:419-421`) before a single byte is built. This ADR
adds nothing to that path's eligibility rule — it only tightens what a match is allowed to become
(§6) and how long a "no" lasts (§5).

**State-triggered dormancy — a Finding that is real regardless of what the user is currently
typing — gets its own channel: SessionStart, not a bypass of the in-session gate.** The reason is
structural, not stylistic: `UserPromptSubmit`'s payload carries free text to match a goal against;
`SessionStart`'s does not (`plugin/hooks/hooks.json:5-26` — matcher `startup`/`resume`, no prompt
field), so there is nothing for goal-match to gate *on* at that boundary in the first place. Asking
it to gate anyway is what produced ADR-045's error: deleting a gate that cannot fire at this event
rather than recognizing the event needs a *different* eligibility rule.

**Mechanically:** extend `plugin/hooks/hooks.json`'s `SessionStart` array with a second producer
entry dispatched through the *existing* chokepoint (`hook-shim.mjs unprompted-speech SessionStart`),
alongside the current bare `session-start` dispatch — not instead of it, since the nightly-failure
and health-alarm content already there is Alarm-channel and must keep bypassing the dial exactly as
today. `plugin/scripts/unprompted-runtime.mjs`'s `BUILTIN_REGISTRY`
(`plugin/scripts/unprompted-runtime.mjs:119-124`) currently maps only four events
(`UserPromptSubmit`, `PreToolUse-write`, `PreToolUse-bash`, `PreToolUse-push`) to producers; this
ADR adds a fifth key, `'SessionStart'`, mapped to `anticipate.sh` invoked with a new mode flag
(below) — **reusing the same producer file**, not a new one, and **reusing the runtime's existing
candidate contract unchanged** (`{channel:'advocacy', effect:'advisory', copy, hookEventName,
findingId, severity, observationHash}` — `plugin/scripts/unprompted-runtime.mjs:29-31`). No change
to the runtime's parsing, anti-spoof, or delivery logic is required; only its registry table grows
by one row, and its per-channel policy for `advocacy` (`plugin/scripts/unprompted-runtime.mjs:281-303`)
already does everything this new producer needs (dial + ledger + OFFERED recording).

**`anticipate.sh` gains one new mode, `session`,** selected by a fourth CLI form
(`--session-digest`, parsed beside the existing `--dismiss`/`--undismiss`/`--status` block at
`plugin/scripts/anticipate.sh:93-99`). Unlike `suggest`, it does **not** read a prompt or call
`matchGoal()` — there is nothing to match a goal against at session start. It instead: audits once
(`auditAll()`), filters to `isDormant(row)` (§1) **and** `buildOffer(row) !== null` (§6), applies
the corrected identity and one-shot budget (§3, §5), and — if anything survives — picks the single
highest-blast-radius survivor. "Highest blast radius" is not a new ranking function: it is simply
first-in-list, because `CAPABILITIES` is already ordered that way on purpose ("Ordered by blast
radius: the ones whose dormancy costs the most sit at the top, because this list is rendered in
order and nobody reads to the bottom," `scripts/capability-registry.mjs:250-252`). At most one
candidate is emitted, matching `anticipate.sh`'s existing single-best-match discipline
(`plugin/scripts/anticipate.sh:441-443`).

**IDLE findings are not delivered by this channel either.** They fall out of `isDormant()`
automatically (§1); this ADR takes no position on how or whether they should be surfaced, beyond
naming that DDD-0010 (Wiring) is where that vocabulary already lives.

### 3 — The ceiling: a stable identity, never counter-bearing prose

**Verified the exact defect the constraint describes.** `advocacy-outcomes.mjs`'s `stateHashOf()`
hashes the *evidence string(s)* a detector reports (`scripts/advocacy-outcomes.mjs:174-186`), and
those strings are built from live counters — `"744 lessons across 41 projects"`
(`scripts/capability-registry.mjs:528`), `"38 receipts, most recent 4.8 days ago"`-shaped sentences
(`scripts/capability-registry.mjs:483-487`). `shouldStillOffer()`'s high-severity reprieve compares
this hash to the one recorded at the last dismissal
(`scripts/advocacy-outcomes.mjs:420-422`: `stateHash !== o.lastDismissal.stateHash`) and treats any
difference as "the world changed, you may speak again." A counter that ticks on every run mints a
fresh hash on every run, so a high-severity dismissal can never actually stick — the exact defect
the 0045 duel found (`docs/reviews/0045-duel-state-based-advocacy.md:44-47`).

**Fix: identity is `(capability key, state)`, never the prose.** This is not a new mechanism to
build from scratch — `docs/ddd/0004-advocacy-context.md:215-226` already specifies the correct
shape as `observationHash = SHA-256(canonicalJSON({v, detectorId, findingId, state, severity,
material}))`, `material` being a detector-declared *bucketed band*, explicitly excluding
"timestamps, session ids, mtimes, evidence ordering, prose." That design has existed since 2026-07-22
and has zero callers — this ADR is the first caller. For the surface this ADR builds, `material`
starts as `null` for every capability (none of the eleven detectors currently declares one), which
already strictly improves on hashing raw evidence: identity collapses to `(key, state)`, which
changes only when the registry's own state transition fires
(`CapabilityStateChanged`, `docs/ddd/0006-capability-context.md:166-174`), never when a counter
inside a stable state ticks. Declaring a `material` band for a specific detector that genuinely
needs sub-state granularity is a future, per-detector enhancement, not a precondition of this ADR.

**"Ever, across sessions" is already the existing scoping rule, not a new one.**
`shouldStillOffer()` is deliberately not scoped by project or session
(`scripts/advocacy-outcomes.mjs:378-386`: *"these recommendations are about the user's MACHINE...
so per-repo suppression would ask the same person the same question once per checkout"*). This ADR
changes only the *identity* fed into it, not its scoping.

### 4 — IGNORED accrues at SessionEnd, not behind a console poll

**Verified the exact gap.** `reconcileIgnored()` (`scripts/advocacy-outcomes.mjs:550-568`) has
exactly one caller today: `onboarding-console.mjs`'s `/api/capabilities` handler
(`scripts/onboarding-console.mjs:665-687`), which supplies staleness via `findStaleOffers()` — a
**24-hour wall clock**, chosen specifically because *"this endpoint has no session concept of its
own... inventing a session counter here would be evidence this file does not have"*
(`scripts/onboarding-console.mjs:715-720`). That reasoning is correct for an HTTP read-model and
wrong as the *only* path: a user who never opens the console never accrues an ignore, no matter how
many sessions pass — precisely the duel's Finding 2
(`docs/reviews/0045-duel-state-based-advocacy.md:46-48`, *"A user who never opens the console never
accrues ignores — ADR-028's own named structural failure, reproduced inside the fix for it"*).

**Fix: a SessionEnd hook has exactly the session concept the console lacks, so give it the same
job.** A new dispatch id (e.g. `advocacy-reconcile`) is added to `plugin/hooks/hooks.json`'s
`SessionEnd` array (currently only `learn-flush`, `plugin/hooks/hooks.json:130-141`) — as a
sibling entry, not folded into `learn-flush`, because bookkeeping the DismissalLedger is Advocacy's
concern and `learn-flush` is Learning's (DDD-0004 vs DDD-0005 stay separate contexts; mixing them
in one script is the same modelling error DDD-0009 was written to undo for lessons). This new
script does **not** write user-facing bytes — it performs no speech at all, so it does not run
under `unprompted-runtime.mjs`'s chokepoint (which exists specifically to own *bytes*,
`docs/ddd/0004-advocacy-context.md:114-127`); it calls `reconcileApplied()` then `reconcileIgnored()`
directly, in that order — the same order `computeCapabilities()` already uses and for the same
stated reason, *"so a capability the user just switched on is never miscounted as ignored in the
same pass"* (`scripts/onboarding-console.mjs:671-677`).

**The staleness rule becomes: an offer still pending when THIS session ends, for a capability the
fresh audit still reports `off`, is `ignored`.** No 24-hour threshold is needed or invented — the
session boundary *is* the natural unit "did the user have a fair chance to react" already measures
elsewhere in this file (`anticipate.sh`'s own per-session ceiling,
`plugin/scripts/anticipate.sh:365-376`). This is deliberately weaker evidence than a dismissal
(`IGNORE_WEIGHT = 0.2`, `scripts/advocacy-outcomes.mjs:121`), so treating even a short session as one
ignore-tick is proportionate: it takes several silent session-ends to approach a budget a single
explicit "no" already exhausts (§5).

### 5 — One explicit no is final, at every severity, for advocacy — escalation belongs to alarms

**Verified the current mechanism does not actually deliver the guarantee it advertises.**
`DISMISSAL_BUDGET = { normal: 1, high: 3 }` (`scripts/advocacy-outcomes.mjs:120`) plus the
state-change reprieve (`scripts/advocacy-outcomes.mjs:420-422`) means a high-severity finding "comes
back to argue after a no" — `anticipate.sh`'s own CLI text says so out loud: *"a single click cannot
bury a high-severity finding, so it may still resurface until the budget is spent"*
(`plugin/scripts/anticipate.sh:320-323`). ADR-028 already lists this shape as an anti-goal
("interruption without an off switch," `docs/adr/0028-what-proactive-means.md:135-136`) and the 0045
duel named it directly (`docs/reviews/0045-duel-state-based-advocacy.md:25-35`).

**Fix, and it is a policy change, not new machinery.** Every advocacy caller of
`shouldStillOffer()`/`record()` — both the existing `anticipate.sh` `suggest` path and the new
`session` mode from §2 — passes `severity: null` (never a real tier) into both functions.
`weightClass(null)` already resolves to `'normal'`
(`scripts/advocacy-outcomes.mjs:157-160`, documented as the deliberately quieter default), which
collapses `DISMISSAL_BUDGET` to its `normal: 1` branch uniformly, and the high-severity reprieve
branch (gated on `cls === 'high'`, `scripts/advocacy-outcomes.mjs:420`) becomes unreachable for
advocacy by construction — **without editing the shared ledger module's generic API**, which stays
available for a future caller that genuinely needs severity-weighted escalation. `HARD_DISMISSAL_CAP`
(`scripts/advocacy-outcomes.mjs:123`) is now moot for advocacy (one dismissal already ends it) and is
left as a defence-in-depth backstop rather than removed. `anticipate.sh`'s CLI messaging
(`plugin/scripts/anticipate.sh:320-323`) must be corrected in the same change — it currently promises
behaviour this ADR retires, and a control whose own copy misdescribes its force is the exact failure
`docs/ddd/0009-consent-context.md`'s "vocabulary may not outrun the exit code" invariant already
condemns for a different mechanism.

**Where does escalation actually belong, then?** It already has a home: `HealthDegraded` and
`IntegrityFailed` (`docs/ddd/0004-advocacy-context.md:237-239`) are Alarm-channel domain events, and
Alarm is, by DDD-0004's own three-channel table, *"always delivered... no, silence here = a broken
install that looks healthy"* (`docs/ddd/0004-advocacy-context.md:99`). A finding severe enough to
need to argue past a "no" was never Advocacy — it should have been raised as one of these events
instead. This ADR does not build a new alarm-classification pipeline; it removes the borrowed
escalation mechanic from Advocacy and names where genuine escalation already, correctly, lives.

### 6 — The Offer schema: no verified undo, no offer

**The core invariant this enforces already exists** (`docs/ddd/0004-advocacy-context.md:76-82`: *"A
Finding may not exist without a Remedy, and a Remedy may not exist without an inverse"*), and it is
currently under-enforced in exactly the place ADR-045 broke it: `matchGoal()`
(`scripts/goal-match.mjs:339-376`) filters candidates on `state` and `confidence` alone — it never
checks `cap.turnOn` at all. So a goal can *today* point at a `turnOn: null` capability
(`corrections-not-obeyed` → `lessons-in-force`, `catching-bad-writes-in-review` → `write-gates`,
`knowledge-going-stale` → `nightly-refresh`, `tuning-the-harness-itself` → `harness-evolution`, and
`resolving-the-same-problem` can match `learning-hooks` via its permitted `'unknown'` state,
`scripts/goal-match.mjs:196,362`) and `anticipate.sh`'s COPY builder gracefully degrades to *"no
verified one-line command exists for it — offer to walk them through it"*
(`plugin/scripts/anticipate.sh:459-461`) rather than refusing to speak. That is a soft version of
exactly ADR-045's mistake: an unfulfillable offer, worded politely.

**Fix: a validated Offer value, built by one shared, pure function** (specified here, e.g.
`scripts/advocacy-offer.mjs`, used by both `anticipate.sh` modes so the rule cannot drift between
the two producers):

```
Offer := { whatIs, whatChanges, turnOn, undo }
buildOffer(row) → Offer | null      // never throws — see the fail-safe note below
```

`buildOffer()` returns `null` — dropping the row entirely, before `matchGoal()` or the session-mode
selector ever sees it — unless **both** `row.turnOn` and a new, equally-verified `row.turnOff`
(or an `UNDO_KINDS`-shaped `{kind, human}`, reusing the closed vocabulary already defined in
`scripts/remedy-registry.mjs:36-43` rather than inventing a parallel one) are present. `undo` may be
`{kind: 'none', human: '<why nothing needs reversing>'}` — the same "NONE is a real, declared value,
not an absence" discipline `remedy-registry.mjs:34-36` already applies — but it may never be
absent/`null`.

**Verified this is achievable for at least one capability today, not merely hypothetical.**
`memory-distillation`'s action (`ruflo memory distill run`) already has a real, verified inverse
registered under a different id: `remedy-registry.mjs`'s `distill-fleet` remedy snapshots each store
via `ruflo memory backup` before distilling and declares `inverse: () => ({ kind:
K.RESTORE_STORE_BACKUPS })` (`scripts/remedy-registry.mjs:86-97`). `buildOffer()` can source
`memory-distillation`'s `undo` from that existing, proven inverse rather than inventing a new one —
concrete proof this schema is buildable, not aspirational.

**Verified this is NOT yet true for six of the eleven capabilities, and the registry already says
why, in its own words** — `learning-hooks`, `lessons-in-force`, `harness-evolution`, `write-gates`,
`session-capture`, `nightly-refresh` all carry `turnOn: null` today, each for a distinct, deliberate
reason documented at `scripts/capability-registry.mjs:33-52` (no CLI exists; ratification is
deliberately withheld from the model; multi-step machine mutation with no single verified command).
None of the six has an `undo` either. Under this schema, `buildOffer()` returns `null` for all six —
**not a bug, the correct, honest consequence of the invariant**, and consistent with the tradeoff
ADR-028 already names explicitly: recall (0.80 target) is lower priority than a zero false-alarm
rate, and an offer with no working button is a false alarm about the product's own capability, not
about the user's machine.

**Fail-safe discipline differs by execution context, deliberately.** The console's
`makeRecommendation()` *throws* on a missing invariant (`docs/ddd/0004-advocacy-context.md:79-82`) —
correct there, because it runs synchronously inside a developer-facing build/test, and a silent
`null` would let a broken recommendation ship unnoticed. `buildOffer()`, called from an unprompted
background producer, *returns null* instead — the same invariant, enforced the way
`plugin/scripts/anticipate.sh`'s own header already mandates for this execution context ("If in
doubt, nothing," `plugin/scripts/anticipate.sh:33-34`) and the way `loadOutcomes()` is documented to
behave ("a mechanism that suppresses recommendations must fail toward SPEAKING" — inverted here
because the risk this function guards against is fabricating an offer, not suppressing a true one;
either way, failure must never propagate as a crash that could take down a hook,
`scripts/advocacy-outcomes.mjs:283-291`).

### 7 — Copy for the interruption context: evidence-first, neutral, no loss-framing

**Verified the exact sentence the duel objected to.** `capability-registry.mjs:474` reads, verbatim:
*"The rules your AI works by get tested against each other, and the version that measurably does
better becomes the new default."* That is accurate, well-written *console* copy — read by a
nervous developer, unprompted, mid-task, it announces the tool wants to rewrite its own operating
rules (`docs/reviews/0045-duel-state-based-advocacy.md:59-63`).

**Fix: `whatItBuysYou` is banned from `buildOffer()`'s output, by construction, not by style
guidance.** `whatIs` and `whatChanges` are built from exactly two sources: the row's own `evidence`
string (already neutral — it is a measurement, e.g. *"38 receipts, most recent 4.8 days ago"*,
`scripts/capability-registry.mjs:487`) and `turnOn.human` (already a factual description of the
mechanical action, e.g. *"Mine this project's stored memories into reusable patterns"*,
`scripts/capability-registry.mjs:315` — a description of *what happens*, not a pitch for *why it's
good*). If a future edit tries to fold `whatItBuysYou` into the Offer, `buildOffer()` must reject
it the same way `assertRegistryClosure()`-style tests already reject a malformed remedy — a
mechanical rule, checkable by a test, not a comment asking nicely. This mirrors
`docs/ddd/0004-advocacy-context.md`'s existing `plainImpact ≥ 40 chars` invariant on Remedy: a
different field, the same discipline (enforce the *quality axis* at construction, not by review).

### 8 — Hook-installing remedies stay unofferable until one lock-guarded installer exists

**This is a corollary of §6, made explicit because it is the constraint ADR-045 violated most
directly** (its Decision 4 ordered the model to explain-then-install a hook). `session-capture`,
`write-gates`, `nightly-refresh`, and `learning-hooks` are precisely the four capabilities whose
`turnOn` is `null` *because* turning them on means hand-editing `settings.json` hook arrays or
loading a launchd plist — multi-step machine mutation with no single verified command
(`scripts/capability-registry.mjs:46-52`). `advocacy-outcomes.mjs:197`'s own measured finding — a
read-modify-write on a settings JSON under four concurrent writers lost a setting in 19 of 20 trials,
every writer returning `ok: true` — is exactly why. Under §6's schema they already return `null`
from `buildOffer()` and are therefore never offered; this section states the bar they would have to
clear to change that, so a future build does not re-derive it from scratch or re-attempt a bare
read-modify-write.

**The bar, stated precisely, and reusing primitives this repo already has proven correct rather
than inventing new ones:**

1. **One lock-guarded writer.** `withLock()`/`writeAtomic()` (`scripts/user-settings.mjs:314,369`,
   `LOCK_WAIT_MS = 5000` at `scripts/user-settings.mjs:301`) already solve exactly this class of
   race for `scripts/install-scope.mjs` (`scripts/install-scope.mjs:40`, reused rather than
   reimplemented specifically *because* the alternative reintroduces the 19-in-20 loss). A
   hook-installer must acquire the same lock, re-read the file under it, apply its change, and write
   via the same atomic-rename primitive — never a bare `copyFileSync`/read-modify-write.
2. **A durable consent record, not a settings flag.** This reuses `docs/ddd/0009-consent-context.md`'s
   existing **Consent grant** aggregate and its invariants verbatim — a grant that is scoped, revocable,
   sticky across updates, and never created by silence (`docs/ddd/0009-consent-context.md:61-86`) — for
   a new *force* (installing a hook) alongside the ones it already governs (nudge/block for lessons).
   This is a genuine extension of an existing aggregate's domain, not a new consent mechanism.
3. **An uninstall manifest.** What the installer added — which hook entries, in which array, in
   which file — is recorded at install time so `--uninstall` removes exactly that and nothing else.
   `scripts/install-scope.mjs:26-30`'s own stated discipline — *"what it cannot reverse, it PRINTS
   and hands to the user"* — is the fallback when a manifest cannot be constructed; it is not a
   substitute for one when it can.
4. **Proven by an install → update → uninstall → clean test**, per the constraint's own phrasing —
   not a unit test of the installer's parser, an end-to-end run against a real settings file that
   asserts the file is byte-identical to its pre-install state after `--uninstall`.

**This ADR does not build the installer.** Building it is out of scope here (design-only, and a
genuinely separate unit of work); what changes is that `capability-registry.mjs`'s `turnOn: null`
for these four rows is now understood as a *load-bearing gate*, not a placeholder to be filled in
casually — and no advocacy surface (in-session or session-start) may offer any of the four until it
is.

## What this does NOT do

- **It does not change `anticipate.sh`'s in-session eligibility rule beyond §5's severity
  normalization and §6's schema filter.** Goal-match remains mandatory for mid-turn speech.
- **It does not build IDLE's delivery path.** `cheap-model-routing`'s IDLE state and three of
  `capability-audit.mjs`'s four detectors are IDLE-shaped and are named, not delivered, here — see
  DDD-0012 for why that is DDD-0010's (Wiring) territory, not Advocacy's.
- **It does not build the hook-installer** (§8) — it raises the bar such a remedy must clear.
- **It does not add a `material` band to any detector** (§3) — `(key, state)` identity is the
  floor this ADR requires; per-detector sub-buckets are a future refinement of already-specified,
  unbuilt DDD-0004 machinery.
- **It does not touch the Alarm channel's mechanics** — it only names where escalation belongs
  (§5) instead of building new escalation.
- **It does not rewrite any of the eleven `whatItBuysYou` console strings.** They remain correct
  *console* copy; §7 only forbids their reuse in the unprompted path.

## Verification (before Accepted) — each falsifiable, each proven to fail on the un-fixed code first

1. **Dormancy predicate.** A table-driven unit test asserts `isDormant()` returns `false` for a
   fixture row with `state: 'idle'` and for the pre-fix `cross-project-lessons`/`nightly-refresh`
   shapes (reconstructed from their old logic), and `true` only for genuine `'off'` — proven to
   fail against a naive `state !== 'on'` implementation first.
2. **Channel separation.** A `SessionStart` fixture payload (no prompt field) reaches the new
   `session` mode and produces a candidate without ever calling `matchGoal()` — proven by a spy
   that fails the test if `matchGoal` is invoked from that path.
3. **Identity stability.** Two audits of the same capability with identical `state` but different
   evidence *counters* (e.g. `"38 receipts"` vs `"41 receipts"`) produce the *same* identity;
   changing `state` produces a *different* one. Proven to fail against `stateHashOf(evidence)`
   first.
4. **IGNORED at SessionEnd.** An offer recorded pending, with no console ever polled, accrues one
   `ignored` record when a fixture SessionEnd fires with the capability still `off`. Proven to fail
   with `reconcileIgnored()` uncalled (today's state).
5. **One no is final.** A dismissal at `severity: 'important'` results in `shouldStillOffer() ===
   false` on the very next check, with no state-change reprieve able to reopen it. Proven to fail
   against the current `DISMISSAL_BUDGET.high = 3` + reprieve behaviour first.
6. **No offer without undo.** `buildOffer()` returns `null` for all six `turnOn: null` capabilities
   named in §6, and returns a real Offer for `memory-distillation` sourcing its `undo` from
   `remedy-registry.mjs`'s `distill-fleet` inverse. Proven by asserting the six explicitly, not by
   absence of a crash.
7. **Copy discipline.** A test asserts the Offer's `whatIs`/`whatChanges` strings never contain the
   verbatim text of any capability's `whatItBuysYou` field, across all eleven capabilities.
8. **Hook-installer gate holds.** `buildOffer()` returns `null` for `session-capture`, `write-gates`,
   `nightly-refresh`, and `learning-hooks` unconditionally, until a lock-guarded installer with a
   passing install→update→uninstall→clean test exists — this test is expected to keep failing (i.e.
   keep asserting `null`) for as long as that installer is unbuilt, and is itself the tripwire that
   must be updated, deliberately, the day it is.
9. **Cross-model duel.** Fable 5 × GPT-5.6-Sol review this ADR and its DDD, GPT-5.6-Sol asked to
   RUN the code per the standing discipline (`docs/adr/0045-*.md:93-95`), recorded in
   `docs/reviews/0047-*.md`.

## Consequences

- **A short-term recall drop, named and accepted.** Six of eleven capabilities become permanently
  unofferable via advocacy (in-session or session-start) until they earn a real `undo` — a stricter
  floor than ADR-045's, and a lower measured recall than a system that offers everything it can
  detect. ADR-028 already ranks a zero false-alarm rate above the 0.80 recall target; this is that
  ranking applied literally.
- **`anticipate.sh` grows one mode and loses nothing** — the existing `suggest`/`--dismiss`/
  `--undismiss`/`--status` behaviour is unchanged except for §5's severity normalization and §6's
  schema filter, both narrowing rather than expanding what can be said.
- **The runtime chokepoint (`unprompted-runtime.mjs`) grows by one registry row, not one new
  concept** — its candidate contract, anti-spoof, and per-channel policy are reused unchanged.
- **A new, small, non-speaking SessionEnd script is added** — the first thing in this repo whose
  entire job is ledger bookkeeping with zero bytes to the user, which is a real category (distinct
  from both "advisory" and "block") that `unprompted-runtime.mjs`'s chokepoint correctly does not
  need to own.
- **The hook-installer named in §8 remains a real, un-scheduled unit of future work.** Naming the
  bar is not building the ladder; four capabilities stay honestly out of reach until it exists.
