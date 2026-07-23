# DDD-0004 — The Advocacy bounded context

Updated: 2026-07-23 09:00:00 EDT | Version 1.2.0
Created: 2026-07-21 18:30:00 EDT
Governs: ADR-027 (Capability advocacy + the death of passive signals), ADR-032 (the capability surface + advocacy dial)

> **v1.2.0 (2026-07-23) — the DismissalLedger got a single, real implementation, and the enforcement
> chokepoint's own example of the bug it was written against is fixed.** Two things had ZERO
> production callers: `advocacy-outcomes.mjs`'s `shouldStillOffer()`/`DISMISSAL_BUDGET` (the
> severity-weighted suppression this section already specified in shape), and `reconcileIgnored()`
> (the ledger's third outcome). Meanwhile `anticipate.sh` kept its OWN binary dismissed-Set — one
> dismissal muted a Finding forever, at every severity, with no re-offer path — which is the EXACT
> "key on the bare capability name" failure line 134 named by file and line number. Both are now
> wired: `anticipate.sh` (every mode: suggest, `--dismiss`, `--undismiss`, `--status`) consults
> `shouldStillOffer()` as its ONLY suppression decision, and `onboarding-console.mjs`'s
> `/api/capabilities` audit supplies `reconcileIgnored()` its pending-and-stale ids via a wall-clock
> rule (`findStaleOffers()`, 24h pending + still `off`) it computes itself — the ledger deliberately
> does not invent that clock (see the DismissalLedger section below, and `pendingOffers()` in
> `advocacy-outcomes.mjs`, for exactly which part of "shipped" this is and which part is still the
> `observationHash`/`compare()` target design below).
>
> **v1.1.0 (2026-07-22) — reconciled to the advocacy-dial duel.** Fable 5 and GPT-5.6 independently
> attacked ADR-032 + this context and converged (see ADR-032 §"Adversarial review"). Three findings
> changed the model and are folded in below as §"The three channels", §"The enforcement chokepoint",
> and a precise `observationHash` spec under DismissalLedger. The v1.0.0 body is unchanged and still
> correct; these are additions, not corrections.

## Why a bounded context at all

"Tell the user something useful" is currently smeared across five places with five vocabularies and
no shared invariants:

| Where | Vocabulary | What it emits | Can it act? |
|---|---|---|---|
| Session-start hook | "playbook", "take the wheel" | prompt text | no |
| `search_ruvnet` response | "evidence", "caveat" | formatted passages | no |
| Console health card | "score", "dimension", "fail" | a number and a colour | **no** |
| Console recommendations | "recommendation", "apply" | actionable ids | yes |
| GONG / brain-alarm | "outage" | a loud in-band alarm | n/a (informs) |

Four of those five can KNOW something is wrong and cannot DO anything about it. That is the defect
ADR-027 exists to end, and it is a modelling failure before it is a coding failure: we never named
the thing that turns knowledge into an offer.

This context owns exactly that transformation.

## Ubiquitous language

| Term | Meaning (exactly one) |
|---|---|
| **Capability** | A discrete RuvNet feature a user can have. Has an install state and an active state — the two are independent, and their divergence is the whole point. |
| **Dormant** | Installed but not active. **A defect, never a neutral state.** The single most valuable thing this context detects. |
| **Observation** | A measured fact about THIS machine (`1,884 queued events`; `last trained 6.0 days ago`). Never a guess, never a default, never a hardcoded assumption. |
| **Finding** | An Observation judged to be a problem or an opportunity. A Finding without a Remedy may not be surfaced. |
| **Remedy** | An executable action that resolves a Finding, with a recorded inverse. No Remedy ⇒ no Finding ⇒ silence. |
| **Advocacy** | Offering a Remedy the user did not ask for. Distinguished from *answering*, which is reactive. |
| **Dismissal** | A user's recorded "not now" for one Finding. Suppresses re-offer until the underlying Observation materially changes. |
| **Active signal** | A signal that interrupts: a gate, a recommendation, or an alarm. |
| **Passive signal** | A signal that merely renders: prose, a card, a log line. **Prohibited for anything load-bearing.** |

## The core invariant

> **A Finding may not exist without a Remedy, and a Remedy may not exist without an inverse.**

This is not a guideline. It is enforced at construction by
`console-engine.makeRecommendation()`, which throws on any recommendation missing evidence, cost,
undo, or (when `touchesMachine`) a plain-English impact statement. A developer cannot ship a
worry-only card without deleting that gate, which is a visible, reviewable act.

Corollary, and the harder discipline: **if we cannot fix it, we do not report it as a Finding.** We
either build the Remedy or we say plainly that it needs a human and name the exact command. What we
never do is render an alarming number and walk away — which is precisely what "memory 49/100,
store is corrupt" did for an unknown number of days.

## The three channels (v1.1.0 — the duel's central correction)

The earlier plan had ONE `advocacy` setting (`off / important-only / all`) govern every unprompted
utterance. Both reviewers rejected it independently, for the same reason: three DIFFERENT kinds of
speech, with three DIFFERENT consent bars, were being forced through one knob — which produced an
unresolvable contradiction (a `silent` user must still be told their brain is broken) and made the
one setting either unsafe or useless. The model now names three channels:

| Channel | What it is | Governed by | May a user silence it? |
|---|---|---|---|
| **Alarm** | The brain is broken *right now* — `HealthDegraded`, `IntegrityFailed`, a dead nightly. A fact about a failure, not an opinion. | Nothing. Always speaks. | No. Silence here = a broken install that looks healthy. |
| **Advocacy** | A `Finding` with a `Remedy` the user did not ask for — the Observation→Finding→Remedy flow this context owns. | The `advocacy` dial. | Yes — that is the dial's entire job. |
| **Promotion** | First-run onboarding: "open the Console once", the router offer, "what's new". Not steady-state. | A one-time onboarding flow, silenced by anything below `all`. | Yes, and it never repeats regardless. |

**The invariant that makes the dial safe (ADR-032): the level governs INTERRUPTION, never
AVAILABILITY.** The capability panel always renders every capability in every state at every level —
it is a *pull* surface, and pulling it is consent. The dial decides only what may speak *unprompted*.
So `silent` is genuinely silent AND cannot hide a fact from a user who opens the panel. Both halves
are load-bearing; either alone is the failure.

`Alarm` is therefore lifted OUT of the `advocacy` dial entirely. `HealthDegraded` / `IntegrityFailed`
(already domain events above) are alarms by definition and bypass the dial. This is what resolves the
`silent`-vs-GONG contradiction: a user at `silent` still hears an outage, because an outage was never
advocacy.

## The enforcement chokepoint (v1.1.0 — seams, not components)

The dial is worthless if any hook can forget to consult it — and the audit that motivated this proved
exactly that: emitters spoke unprompted while reading no setting at all. A per-hook check is the same
class of bug as the Stop-hook incident (a forgotten guard). So the invariant is structural:

> **Every unprompted utterance passes through ONE runtime that reads the level and the DismissalLedger
> and alone decides whether bytes reach the user. An emitter returns a structured candidate
> (`{channel, findingId, severity, observationHash, copy}`); it never writes user-facing bytes
> directly. Raw text from an emitter is a protocol violation — dropped, not forwarded.**

This is enforceable for RuvNet Brain's own hooks (not arbitrary third-party hooks), and it is proven
by a registry test that fails if any advocacy/promotion emitter is wired to anything other than the
runtime — the same shape as the `hook-contract` failsafe test shipped 2026-07-22. A test that asserts
on the runtime's structured output instead of the real process stdout would be a test with no teeth:
the assertion must read what the user's terminal would actually receive.

## Aggregates

**1. CapabilityAudit** (root)
- Invariant: reports only what was observed on this machine; a capability that could not be probed
  is `unknown`, never `absent`. "I could not check" and "you do not have it" are different claims
  and conflating them is how a product starts lying.
- Emits: `Finding[]`

**2. Finding**
- Invariant: carries ≥1 Observation, exactly one Remedy, and a severity.
- Severity is bounded by evidence: `IMPORTANT` requires a measurement on this machine.

**3. Remedy**
- Invariant: has `change.human` and `undo.human`. Machine-touching remedies additionally require
  `plainImpact` (≥40 chars) — long enough that it cannot be a slogan.
- Executor lives outside this context (Recommendation decides; the server acts) — the same
  no-I/O separation DDD-0002 established for `console-engine`.

**4. DismissalLedger**
- Invariant: append-only. A dismissal is scoped to a Finding *and the Observation that produced it*,
  so a materially worse state re-offers rather than staying silent forever.
- Rationale: without this, advocacy degrades into nagging, and nagging is how a real alarm gets
  trained out of a user's attention.
- **SHIPPED (v1.2.0, 2026-07-23) — `advocacy-outcomes.mjs` is this aggregate's ONE implementation,
  and `anticipate.sh` its ONE caller.** `shouldStillOffer(id, {severity, stateHash})` is the single
  suppression policy for every mode of the Advocacy channel's L4 hook (suggest, `--dismiss`,
  `--undismiss`, `--status`) — nothing else in that file keeps a shadow copy of "is this suppressed".
  The rule it implements is a coarser stand-in for the full spec below, not that spec verbatim:
  `DISMISSAL_BUDGET` (`{normal: 1, high: 3}`) plays the role of `compare()` — a materially-worse
  severity CLASS needs more refusals to bury, rather than a per-detector comparison of arbitrary
  severity bands — and `stateHashOf(evidence)` plays the role of `observationHash`, hashing whatever
  string a detector already reports as evidence rather than a canonical `{v, detectorId, findingId,
  state, severity, material}` JSON shape. `RESET` (an append-only checkpoint, never a deletion) is
  `--undismiss`'s undo. This closes the exact failure this section warned about below by file and
  line: keying suppression on the bare capability name with no re-offer path (what `anticipate.sh`
  did before this build, at every severity, forever) is what a distracted click on a corrupt-store
  warning would have silenced permanently.
- **THE THIRD OUTCOME, ALSO SHIPPED.** `reconcileIgnored()` had zero callers too — precision's
  denominator (`applied + dismissed + ignored`) silently excluded `ignored`, which is optimistic in
  the same direction "record only the applies" is. `onboarding-console.mjs`'s `/api/capabilities`
  audit now supplies it: an offer that is still pending (no applied/dismissed) AND the audit right
  now still reports the capability `off` AND it has sat that way ≥24h is `ignored`. The ledger
  deliberately does not compute this itself (`pendingOffers()` only enumerates what is pending;
  staleness is left to whichever caller actually has a clock or a session concept to judge it by —
  see both files' header comments) — a wall-clock rule was chosen here specifically because this
  caller (a polled HTTP read-model) has no session concept of its own to reach for instead.
- **STILL THE TARGET DESIGN, NOT YET SHIPPED:** the full `observationHash` (v1.1.0, both reviewers
  converged on this shape): `SHA-256` over the RFC-8785 canonical JSON of `{v, detectorId, findingId,
  state, severity, material}`. `material` holds detector-owned *semantic bands*, not raw values —
  `{enabled, total}` bucketed for disabled-hooks, a staleness *threshold band* for a quiet learner, an
  integrity status/error-code for corruption. **Excluded on purpose:** timestamps, session ids,
  mtimes, evidence ordering, prose, and absolute `$HOME` paths — anything that changes without the
  problem changing. Get this wrong in either direction and the ledger fails: include a timestamp and
  "once per observation" degrades to "once per restart" (a nag); key on the bare capability name and
  a worsening problem is silenced forever (the failure the SHIPPED bullet above just closed for
  `anticipate.sh`, on the coarser mechanism actually wired — the canonical hash and per-detector
  `compare()` below remain proposed for a future detector that needs a genuinely structured
  severity band `stateHashOf()`'s plain string hash cannot express).
- **Re-offer rule (target design):** each detector supplies `compare(old, new)` over its own severity
  band. A *materially worse* band re-opens the Finding; equal or better stays silent. Hash inequality
  **alone** never implies worsening — only the detector's `compare` may, because only it knows which
  direction of its band matters to the user. A dismissed Finding still renders in the panel, marked
  dismissed: the user silenced it, they did not make it untrue.

## Domain events

| Event | Raised when | Consumed by |
|---|---|---|
| `CapabilityFoundDormant` | audit sees installed + inactive | Recommendation, Console |
| `HealthDegraded(from, to)` | a score drops materially vs its persisted baseline | Alarm (GONG) |
| `IntegrityFailed(store, detail)` | `integrity_check` returns anything but `ok` | Alarm + Recommendation |
| `RemedyApplied(id, result)` | an executor completes | DismissalLedger, telemetry-free local log |
| `FindingDismissed(id, observationHash)` | user declines | DismissalLedger |

`HealthDegraded` carries **both** numbers deliberately. A score of 49 in isolation is ambiguous; 100 → 49
is unambiguous, and it is the signal that would have caught this failure days earlier.

## Boundaries — what this context does NOT own

- **It does not implement learning.** SONA, MoE, ReasoningBank, and the `ruflo hooks` pipeline are
  rUv's. This context detects their state and advocates for them. Rebuilding any of it is the
  substitution failure the whole project exists to prevent.
- **It does not own retrieval.** `search_ruvnet` answers questions; Advocacy raises them.
- **It does not own presentation.** It decides; the console renders (DDD-0002 §8).
- **It does not resolve rUv's store fragmentation** (project-local vs global learner, issue #2245).
  It must read the store that learning actually writes, or disclose that two exist. Papering over an
  upstream disagreement would be inventing a truth we do not have.

## Anti-corruption layer

Ruflo's CLI is the upstream. Its flags and stores drift between versions — proven this session, where
documented `--train-neural` did not exist in the installed build. Therefore:

- Interfaces are **grounded before use** (`--help` read, never guessed) — already enforced by the
  `verify-interface` gate.
- Executors treat a non-zero exit as *failure to act*, never as *state unknown*, and re-measure to
  confirm the result rather than trusting an exit code.
- No ruflo behavior is asserted from memory or from documentation alone; the measurement is the
  proof. This session produced two false claims from exactly that shortcut.

## Why this modelling and not the obvious alternative

The tempting design is "add a warning banner when something looks wrong." Rejected: it produces
another passive signal, which is the disease rather than the cure — and we now have five documented
instances of passive signals knowing the truth and changing nothing.

The second alternative is "auto-fix everything silently." Rejected harder: it violates the consent
principle established earlier this session (a corporate machine had a background daemon installed
without meaningful consent), and it removes the user's ability to say no. Advocacy offers; it does
not seize.

The chosen shape — **Observation → Finding → Remedy, with dismissal** — is the only one that both
acts and asks.
