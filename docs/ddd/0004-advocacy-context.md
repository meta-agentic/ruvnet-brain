# DDD-0004 — The Advocacy bounded context

Updated: 2026-07-21 18:30:00 EDT | Version 1.0.0
Created: 2026-07-21 18:30:00 EDT
Governs: ADR-027 (Capability advocacy + the death of passive signals)

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
