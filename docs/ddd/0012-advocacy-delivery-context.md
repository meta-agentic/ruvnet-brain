# DDD-0012 — Advocacy Delivery: a policy under the Advocacy context, not a bounded context

Updated: 2026-07-24 | Version 1.0.0
Created: 2026-07-24

Governs **ADR-047** (in-session dormancy voice — session-start delivery, a stable ceiling, and no
offer without a verified undo).

**Status**: Proposed (2026-07-24)

---

## The question this document exists to settle, before it writes a single invariant

DDD-0011 (Freshness) was rejected in part for exactly this failure:
*"the Intent/atomicity aggregate ... has nothing to do with freshness; it is write atomicity for the
lesson store, in this document because it came from the same duel rather than the same domain. It
should be a policy under DDD-0008, not a context of its own"*
(`docs/adr/0046-freshness-contract-and-atomic-user-actions.md:59-63`).

This document is deliberately not permitted to make that mistake by omission. So before any
ubiquitous-language table: **does "Advocacy Delivery" reason about a domain concept that DDD-0004
does not already own, using vocabulary DDD-0004 does not already have?**

### Applying the test

DDD-0004 (`docs/ddd/0004-advocacy-context.md`) already owns:

- The full transformation Observation → Finding → Remedy → Dismissal
  (`docs/ddd/0004-advocacy-context.md:75-88`).
- A **DismissalLedger** aggregate, with its shipped mechanism named and file-cited
  (`docs/ddd/0004-advocacy-context.md:187-231`).
- A **Remedy** aggregate whose invariant is *already* "no Finding without a Remedy, no Remedy
  without an inverse" (`docs/ddd/0004-advocacy-context.md:76-82,181-186`).
- A **three-channel model** (Alarm / Advocacy / Promotion) with a stated consent owner per channel
  (`docs/ddd/0004-advocacy-context.md:89-112`).
- A **cross-context delivery seam** — `unprompted-runtime.mjs` — already modelled as *not* a single
  consent policy but a shared byte-ownership mechanism serving three different contexts' channels
  (`docs/ddd/0004-advocacy-context.md:114-167`).

Everything ADR-047 decides is a **tightening of one of these five**, not a sixth thing:

| ADR-047 decision | Which existing DDD-0004 concept it tightens |
|---|---|
| §1 Strict dormancy predicate | Refines what may become a `Finding` — the ACL table already gates this (`docs/ddd/0004-advocacy-context.md`'s sibling, DDD-0006, §ACL) |
| §2 A second delivery channel (session-start) for the same `advocacy` channel | Adds one row to the *existing* delivery seam's producer registry — the seam itself, its candidate contract, and its per-channel policy are unchanged |
| §3 Stable identity for the ceiling | Builds the `observationHash` the DismissalLedger aggregate **already specifies** as "target design, not yet shipped" (`docs/ddd/0004-advocacy-context.md:215-226`) |
| §4 IGNORED at SessionEnd | Wires the DismissalLedger's own third outcome (`docs/ddd/0004-advocacy-context.md:206-214`) to a new trigger; no new outcome, no new aggregate |
| §5 One-no-is-final for advocacy | A policy value on the *existing* DismissalLedger's budget parameter, plus a routing rule to the *existing* Alarm channel — no new channel, no new aggregate |
| §6 Offer schema | A stricter constructor for the *existing* Remedy aggregate's invariant, in the *existing* closed `UNDO_KINDS` vocabulary (`scripts/remedy-registry.mjs:36-43`) |
| §7 Copy source discipline | A constraint on which existing field (`evidence`, `turnOn.human`) may populate Remedy's existing `change.human`-shaped text — no new field type |
| §8 Hook-installer bar | A corollary of §6's existing invariant, plus a reference to DDD-0009's *existing* Consent grant aggregate for the new force it needs |

There is no row in that table that requires inventing a term DDD-0004 does not already have, an
aggregate root DDD-0004 does not already contain, or a failure mode distinct from the ones DDD-0004
already names. **Conclusion: Advocacy Delivery is not a bounded context. It is a policy — a set of
tightened invariants and one new routing rule — under the Advocacy context (DDD-0004).** This
document is written as that policy, not as a context, and the remainder of it is organised
accordingly: it does not restate DDD-0004's ubiquitous language as if it were new, it cites the
existing terms it uses, and it spends its own vocabulary only on the two or three things that are
genuinely additions.

This is the harder, less flattering answer, and it is the one the strip test in the table above
actually produces — deleting the ADR-047-specific proper nouns (SessionStart, the `session` mode,
`(key,state)`) from every row above still leaves a sentence that names an *existing* DDD-0004
concept, which is precisely the signal DDD-0011's rejection says to watch for.

---

## What is inherited from DDD-0004 unchanged, and used here without restatement

**Capability, Dormant, Observation, Finding, Remedy, Advocacy, Dismissal, Active/Passive signal** —
all defined at `docs/ddd/0004-advocacy-context.md:61-74`, unchanged.

**The core invariant** — *"A Finding may not exist without a Remedy, and a Remedy may not exist
without an inverse"* (`docs/ddd/0004-advocacy-context.md:76-82`) — unchanged; §"The Offer" below is
a stricter constructor for it, not a different rule.

**The three channels and the enforcement chokepoint** — `docs/ddd/0004-advocacy-context.md:89-167`
— unchanged. This policy adds one producer to one channel's registry; it does not touch the seam's
parsing, anti-spoof, or delivery contract.

**The DismissalLedger aggregate**, its shipped mechanism (`shouldStillOffer`, `record`,
`reconcileApplied`, `reconcileIgnored`) and its documented target design (the full
`observationHash`) — `docs/ddd/0004-advocacy-context.md:187-231` — unchanged in shape. §"Identity
and the ceiling" below specifies *which value* is fed into an interface that already exists.

---

## The two genuinely new pieces of vocabulary

Everything else in this document is policy on existing terms. Exactly two things need names that
DDD-0004 does not already have, because they are genuinely new distinctions this policy draws:

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Eligibility** | Whether a Finding's underlying Capability is `isDormant` under the strict predicate (state === `'off'`, nothing else) | `state !== 'on'` — that also admits `unknown`, `absent`, and `idle`, each a different claim |
| **Offer** | The validated `{whatIs, whatChanges, turnOn, undo}` value a Finding must construct before it may be delivered unprompted | the Remedy itself — Offer is the *unprompted-safe rendering* of a Remedy that has cleared the schema; a Remedy can exist (and render on the pull-surface Panel) without ever becoming an Offer |

Both are refinements of Finding/Remedy respectively, stated as named terms only because ADR-047
needs to refer to them repeatedly and precisely, not because they are new domain concepts with their
own lifecycle.

---

## Policy 1 — Eligibility: dormancy is `state === 'off'`, and nothing routes on evidence prose

**The rule.** A Capability (DDD-0006's aggregate) is eligible to become an Advocacy Finding if and
only if its current `CapabilityState` (DDD-0006 vocabulary, `docs/ddd/0006-capability-context.md:49`)
is exactly `off`. Not `unknown` (nothing to remedy, only to disclose — already DDD-0006's own rule,
`docs/ddd/0006-capability-context.md:24`). Not `absent` (a different, install-level decision — already
DDD-0006's rule, same line). And — the one this policy adds — **not `idle`.**

**Why `idle` needs a policy statement DDD-0006 does not yet make.** DDD-0006 was written before
`STATE.IDLE` existed (`scripts/capability-registry.mjs:90-113`, added 2026-07-24, the same day this
document is). Its four-state closed set (`docs/ddd/0006-capability-context.md:49`) is now five states
in the code, and this policy is where the fifth one gets a ruling: **`idle` is never eligible for an
Advocacy Finding.** It was used, evidence of real value exists, and a wiring defect — not a consent
decision, not an absence — severed it. That is DDD-0010's (Wiring) subject matter by its own
definition: *"Wired = has ≥1 Caller"* (`docs/ddd/0010-wiring-context.md:39`). Routing an `idle`
capability into an Advocacy Finding would ask the user to *decide* something about a fact that is
not theirs to decide — the fix is a wiring change, not a consent grant — which is exactly the wrong
kind of interruption DDD-0004's core invariant exists to prevent ("if we cannot fix it, we do not
report it as a Finding," `docs/ddd/0004-advocacy-context.md:84-86`, read together with the
observation that a wiring defect is not something advocacy *can* fix).

**Enforcement.** One pure predicate, `isDormant(row)`, consulted by every producer that emits an
`advocacy`-channel candidate — both `anticipate.sh`'s existing `suggest` mode and its new `session`
mode (ADR-047 §2) call the *same* function, so the two producers cannot silently disagree about what
"dormant" means the way `capability-registry.mjs` and `learning-enable.mjs` once disagreed about
whether a renamed counter was zero (`scripts/capability-registry.mjs:369-373`).

---

## Policy 2 — Identity and the ceiling: `(capability key, state)`, never counter-bearing prose

**The rule.** The identity fed into `shouldStillOffer()`/`record()`'s `stateHash` parameter for any
advocacy candidate is derived from the capability's `key` and its current `state` alone — a coarse,
quantized value that changes only on a real `CapabilityStateChanged` event
(`docs/ddd/0006-capability-context.md:166-174`), never on a live counter inside a stable state.

**This is not a new mechanism.** DDD-0004's DismissalLedger aggregate already specifies the target
shape — `SHA-256` over canonical JSON of `{v, detectorId, findingId, state, severity, material}`,
with `material` an optional detector-declared *bucketed band*, and explicitly excluding "timestamps,
session ids, mtimes, evidence ordering, prose" (`docs/ddd/0004-advocacy-context.md:215-226`). This
policy is the first caller of that already-specified, previously-unbuilt design, with `material`
defaulting to `null` until a specific detector's own dormancy genuinely needs a sub-bucket.

**Ceiling semantics — unchanged from DDD-0004's DismissalLedger, restated because §5 changes one of
its parameters.** *"Offered once per state change, dismissible, never re-fires while dismissed"*
already holds; the ceiling is not scoped by project or session
(`scripts/advocacy-outcomes.mjs:378-386`, cited by ADR-047 §3) — this policy does not change that
scoping, only the value used to detect a change.

---

## Policy 3 — One no is final for advocacy; escalation is Alarm's, not this policy's

**The rule.** For the `advocacy` channel specifically, the DismissalLedger's severity-weighted
budget collapses to its quiet branch unconditionally: one explicit dismissal ends the conversation,
at every severity, forever (subject only to the identity in Policy 2 changing — a genuinely new
Finding, not a reprieve on the old one).

**Why this belongs here and not as an edit to DDD-0004.** DDD-0004's DismissalLedger aggregate
already supports a severity-weighted budget as a *generic* capability
(`docs/ddd/0004-advocacy-context.md:187-231`) — this policy does not remove that capability from the
shared module, it constrains how the **advocacy channel specifically** calls it (passing a
normalized severity, per ADR-047 §5). A different future channel could still use the generic
severity-weighted form; this is a channel-scoped policy decision, which is exactly the kind of thing
a policy document states and a bounded-context document does not need to.

**Where genuine escalation lives.** `HealthDegraded` and `IntegrityFailed`
(`docs/ddd/0004-advocacy-context.md:237-239`) are Alarm-channel events, and Alarm is unconditional and
unsuppressable by design (`docs/ddd/0004-advocacy-context.md:99,109-112`). A Finding that would need
to argue past a "no" was misclassified; it belongs there, not in a bigger advocacy budget. This
policy draws that line; it does not build a new alarm-classification mechanism.

---

## Policy 4 — IGNORED accrues at SessionEnd, closing the pull-surface dependency

**The rule.** `reconcileIgnored()` (an existing DismissalLedger operation,
`docs/ddd/0004-advocacy-context.md:206-214`) is called at the SessionEnd boundary, for every pending
offer whose capability the fresh audit still reports `off` (Policy 1's predicate), in addition to —
never instead of — its existing console-poll caller.

**Why this is a policy statement and not a new aggregate.** `reconcileIgnored()`'s own contract
already anticipates more than one caller: it *"does not compute [staleness] itself... staleness is
left to whichever caller actually has a clock or a session concept to judge it by"*
(`docs/ddd/0004-advocacy-context.md:212-214`, sourced from `scripts/advocacy-outcomes.mjs:518-528`'s
own header). A SessionEnd hook is exactly the caller with a session concept the header names as
missing from the console. This is the second caller the design was already built to accept, not a
new design.

---

## Policy 5 — The Offer: a stricter constructor for Remedy, in the interruption context

**The rule.** Before any advocacy candidate is emitted — by either producer — its Remedy must
construct a valid `Offer := {whatIs, whatChanges, turnOn, undo}`. Construction fails (returns
`null`, never throws — see ADR-047 §6 for why the failure mode differs from the console's
`makeRecommendation()`) unless:

1. `turnOn` is present and verified (DDD-0004's existing rule).
2. `undo` is present and verified, in the closed `UNDO_KINDS` vocabulary already defined by
   `scripts/remedy-registry.mjs:36-43` — including the real, declared value `NONE` for a genuinely
   irreversible-but-harmless action, under the same discipline that value already carries
   (`scripts/remedy-registry.mjs:34-36`: *"this genuinely has none" and "nobody wrote one" must
   never look the same*).
3. `whatIs` and `whatChanges` are derived **only** from the Finding's `evidence` (a measurement) and
   `turnOn.human` (a mechanical description) — never from the console-facing `whatItBuysYou` field,
   which remains valid Remedy content for the pull-surface Panel but is banned from this
   constructor's output.

**This is a stricter Remedy, not a new aggregate.** DDD-0004 already requires `change.human` and
`undo.human` (`docs/ddd/0004-advocacy-context.md:181-186`); this policy requires the same two fields
to additionally be sourced from a restricted vocabulary and a restricted set of input fields when the
Remedy is destined for unprompted delivery. A Remedy that fails Offer-construction is not deleted —
it still satisfies DDD-0004's weaker, pull-context invariant and may still render on the Capability
Panel (DDD-0006); it is only excluded from `advocacy`-channel delivery.

---

## Anti-corruption layer against Capability (DDD-0006)

This policy consumes exactly three fields off a `capability-registry.auditAll()` row: `key`,
`state`, `turnOn` — plus `evidence` for Offer construction (Policy 5). It does **not** consume
`scope`, `Provenance`, or `Evidence tier` — those remain internal to Capability
(`docs/ddd/0006-capability-context.md:41-56`), matching DDD-0004's own existing boundary rule
(*"Advocacy depends on Capability. Capability does not know Advocacy exists,"*
`docs/ddd/0006-capability-context.md:36-37`). The one addition this policy makes to that existing
ACL table (`docs/ddd/0006-capability-context.md:190-195`) is the `idle` row Policy 1 states above —
DDD-0006 predates `STATE.IDLE`, so its ACL table is silent on it; this document is the place that
silence gets filled, without editing DDD-0006 itself.

## Anti-corruption layer against Wiring (DDD-0010)

**New boundary, stated here because neither DDD-0004 nor DDD-0006 draws it.** A Capability in state
`idle` is never translated into an Advocacy Finding (Policy 1). It is, instead, exactly the shape
DDD-0010 already names: *"Held. Built, kept, knowingly unwired, with a stated bar"*
(`docs/ddd/0010-wiring-context.md:43`) or, when its own audit already reports the reason (a missing
Caller), a `ModuleFoundUnwired`-shaped fact (`docs/ddd/0010-wiring-context.md:105`). This policy takes
no position on how or whether that fact reaches a user — only that Advocacy Delivery must not
misclassify it as a consent decision. Building that delivery path is future work belonging to
whichever document eventually governs it; naming the boundary here prevents this policy's own
producers from quietly reabsorbing `idle` into `off` the way `cross-project-lessons` and
`nightly-refresh` were once quietly reabsorbed into a false `off` (ADR-047 §1).

## Anti-corruption layer against Consent (DDD-0009)

**Reused, not reinvented, for ADR-047 §8's hook-installer bar.** DDD-0009's **Consent grant**
aggregate is already scoped, revocable, sticky-across-updates, and — the invariant that matters
most here — never created by silence (`docs/ddd/0009-consent-context.md:61-86`, esp. invariant 3).
Today it governs one force: enforcement level for a lesson (`off < inform < nudge < checklist <
review < block`, `docs/ddd/0009-consent-context.md:87-107`). A hook-installing Remedy earning a
verified `undo` (Policy 5) needs a durable consent record with the *same* properties for a
*different* force — "install this hook" rather than "block on this lesson." This policy does not
define a second consent mechanism; it names DDD-0009's aggregate as the one to extend, with a new
force value, when that installer is eventually built. The distinction DDD-0009 already draws —
*"Evidence ≠ Consent... force is granted, never earned"* (`docs/ddd/0009-consent-context.md:54-58`)
— applies here without modification: no amount of measured dormancy evidence ever converts into
permission to install a hook. Only the user's grant does.

---

## Domain events this policy adds

| Event | Raised when | Consumed by |
|---|---|---|
| `AdvocacyOfferConstructed(findingId)` | `buildOffer()` succeeds for a dormant Finding | the delivery producer (emits the candidate) |
| `AdvocacyOfferRefused(findingId, reason)` | `buildOffer()` returns `null` — no verified undo, or copy-source violation | nothing that speaks — a diagnostic surface only (e.g. `wired-check.mjs`-style visibility), never the user |
| `AdvocacyOfferIgnoredAtSessionEnd(findingId)` | Policy 4 fires | `reconcileIgnored()` — the DismissalLedger, exactly as the console-poll path already consumes it |
| `AdvocacyDismissalFinal(findingId)` | a dismissal is recorded for the `advocacy` channel | the DismissalLedger — no reprieve branch subscribes to this event under Policy 3 |

All four are events *on* DDD-0004's existing aggregates (Finding, Remedy, DismissalLedger) — none
introduces a new aggregate root, consistent with this document's opening conclusion.

---

## What this policy explicitly does NOT do

- **It does not define a new bounded context**, per the test applied at the top of this document.
- **It does not change DDD-0006's or DDD-0010's own files** — the ACL sections above are additions
  visible from this policy's side of the boundary only, exactly as DDD-0006 and DDD-0009 each added
  an ACL section describing their boundary against DDD-0004 without editing DDD-0004 itself
  (`docs/ddd/0006-capability-context.md:178-231`, `docs/ddd/0009-consent-context.md:163-198`).
- **It does not build the hook-installer** named in the Consent ACL above, or the IDLE-delivery path
  named in the Wiring ACL above. Both are named boundaries, not built mechanisms.
- **It does not add a `material` band to `observationHash`** for any specific detector — Policy 2's
  `(key, state)` floor is what this document requires; per-detector bands are a future, independent
  enhancement of DDD-0004's already-specified design.

## Known gaps in this model (honest as of 2026-07-24)

- **`buildOffer()` does not exist yet.** This document specifies its contract (Policy 5); it is not
  built, and until it is, every advocacy candidate in the codebase is constructed the old,
  unvalidated way. ADR-047's Verification §6 is the tripwire for this gap.
- **The SessionEnd reconciliation script (Policy 4) does not exist yet** — `reconcileIgnored()`'s
  only caller today remains the console's 24-hour wall-clock path
  (`scripts/onboarding-console.mjs:665-687`).
- **No capability other than `memory-distillation` has a verified `undo` sourced and checked
  end-to-end** — ADR-047 §6 shows the mechanism is reachable for one capability; it does not claim
  the other four `turnOn`-having capabilities (`workflow-pattern-learning`, `cheap-model-routing`,
  `cross-project-lessons`, `mcp-servers`) have had their undo verified. That verification is
  explicitly unclaimed here rather than assumed.
