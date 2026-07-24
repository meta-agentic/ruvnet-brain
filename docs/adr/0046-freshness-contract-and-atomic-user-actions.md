---
id: ADR-046
title: Every rendered claim carries its as-of, and every user action is one transaction
status: Rejected
date: 2026-07-24
updated: 2026-07-24
authors: [Stuart Kerr, Claude Code]
tags: [freshness, atomicity, console, trust, 4.0]
supersedes: []
relates: [ADR-028, ADR-040, ADR-045, DDD-0008]
governs:
  - scripts/onboarding-console.mjs
  - scripts/lesson-store.mjs
  - console/app.js
  - console/activity.js
---

**Status**: **REJECTED** by Fable 5 (50/100), 2026-07-24 — rewrite required before any of this is
built. Governed DDD: `docs/ddd/0011-freshness-context.md`.

> **Decision 2 was not merely wrong — it was a regression, and it shipped.** "Recompute in-band past
> the ceiling" reintroduced the outage documented forty lines above the edit in
> `scripts/onboarding-console.mjs` (the 2026-07-17 demo-hang fix): inline compute freezes a
> single-threaded server for 13–49s, and `curl` saw 000 on roughly one request in three. Because the
> console is opened occasionally rather than polled, **over-ceiling is the common case** — so it made
> the documented hang the default path.
>
> **Fixed in 3.9.44** by doing what this ADR's own DDD had already licensed and the ADR then
> overrode: DDD-0011 INV-4 makes withholding first-class, and its event table says
> `MeasurementExpired` triggers "re-measure **or withhold**." Past the ceiling we now serve the value
> with `stale: true` and its real age — the claim is *withdrawn, not disguised* — and refresh in a
> detached child. Proven on the failing case: 58ms, marked stale, `/api/state` still answering in
> 3.6ms alongside it. Inline compute survives only when no prior measurement exists.
>
> **Five further changes required before this can be Accepted. None are built.**
>
> 1. **Read-after-write invalidation.** A successful mutation must delete every cache whose payload
>    embeds the mutated fact. Without it the motivating incident *recurs inside the new rules*: the
>    user toggles a lesson, and `/api/capabilities` keeps serving a claim about that same lesson that
>    is under-ceiling, fully stamped, fully compliant — and false, caused by the user's own click.
>    Wall-clock freshness cannot deliver read-your-own-writes.
> 2. **Decision 4's `enabled` boolean erases intent the store deliberately defends.** `restore()`
>    documents that it does NOT restore status — "un-hiding something is not the same act as agreeing
>    to it." A boolean collapses *undecided*, *declined*, *agreed* and *agreed-then-switched-off* into
>    two values, and makes un-hiding mean agreeing. Needs `desired: on | off | undecided`.
> 3. **INV-2 ("the boundary is the pixel") has no enforcement and is already violated.** `ageMs`,
>    `stale` and `warming` have zero consumers in the client. Needs a fetch wrapper that refuses
>    un-enveloped data, one shared freshness badge, and a browser test that plants an old cache and
>    asserts the rendered DOM. All five of the ADR's verification items were server-side.
> 4. **The Age definition contradicts itself.** A server-computed age freezes at response time, so a
>    page left open shows "2 minutes old" three hours later. The client must tick from `measuredAt`;
>    the server value is the initial one, not the eternal one.
> 5. **One named ceiling constant** (the tree currently has 15m, 10m, 10m, and none), `writeCache`
>    made tmp+rename like `saveLessons`, and `measuredAt` stamped at MEASUREMENT rather than at
>    cache-write — the DDD's own second table row forbids the latter and every producer violates it.
>
> **DDD-0011's bounded-context claim is also rejected.** Freshness and Currency (DDD-0008) are one
> invariant — *no claim without a verifiable as-of; past tolerance, withdraw it* — on two entity types
> with two clocks. And the Intent/atomicity aggregate (INV-5..7) has nothing to do with freshness; it
> is write atomicity for the lesson store, in this document because it came from the same duel rather
> than the same domain. It should be a policy under DDD-0008, not a context of its own.

## The measurement that forced this ADR

Both duelists (Fable 5, GPT-5.6-Sol) returned **DO NOT SHIP** on 2026-07-24 — 49/100 and 60/100 —
and their two largest findings are the same defect wearing two costumes.

**Measured, live, on the owner's machine:**

1. `/api/capabilities` served a cache stamped **2026-07-22T04:52Z — two days old** — as present-tense
   state, reporting *"all 12 recorded lessons are still candidates … none of them can influence
   anything yet"* while the live store held **16 lessons, 13 ratified and in force**. `serveCached()`
   had **no age limit at all**: any cache file that existed was served forever, with a background
   refresh that only ever helped the *next* visitor. It also masked a correct detector fix for a full
   day — the CLI reported 10 on / 0 off / 1 unknown while the page insisted on 8 / 2 / 1.
2. Turning a lesson on required **two sequential POSTs** (`restore`, then `ratify`) composed *by the
   client*. A failure between them leaves disk half-changed with the UI describing neither state.
3. `updateLessons()` read the store **outside** the lock and, on lock-acquire exhaustion, **wrote
   anyway, unlocked** — a lost-update race, proven reproducible with a control that fails.

(1) is fixed for `serveCached` only; **the same lie still lives in `console-cache.json`,
`ACTIVITY_MACHINE_CACHE`, `TRUST_CACHE`, and the stack audit path.** (3) is fixed. (2) is not.

## The single defect underneath all three

This repo already has a bounded context for **document** currency (DDD-0008), whose stated failure
mode is *"a sentence that used to be true."* Every finding above is that exact failure mode in a
different medium: **a rendered claim that used to be true.**

The product's one differentiated asset is that **it never lies about the user's machine.** A stale
number is not a smaller version of a wrong number — it is a wrong number with a plausible alibi, and
it is *worse*, because the reader has no way to detect it. Fable's verdict is the right frame: one
caught false claim retroactively poisons every true one, including the dozens that were correct.

## Decision

**1 — MEASURED-AT IS PART OF THE VALUE, NOT METADATA.** Every cached read-model returns
`{ measuredAt, ageMs, stale }` alongside its data. A read-model that cannot say when it was measured
is not servable. This is the same invariant DDD-0008 applies to documents (`governs` + digest),
applied to runtime measurements.

**2 — A HARD CEILING, AND OVER IT WE DO NOT SPEAK.** Past the ceiling, a cache may not be served as
current. Recompute in-band even though it costs the user a slow page: *a slow honest page beats a
fast lying one.* An unparseable stamp counts as infinitely old. This applies to EVERY cache path, not
just the one that was caught — the defect was never specific to `serveCached`.

**3 — THE UI MUST RENDER THE AGE OR NOT RENDER THE CLAIM.** A payload carrying `measuredAt` that the
client silently drops is the same lie one layer up. Where a surface says "read live this session", it
must be true of that response.

**4 — A USER ACTION IS ONE SERVER-SIDE TRANSACTION.** The client may never compose two writes to
achieve one intent. `POST /api/set-lesson {id, enabled}` expresses the *desired state*; the server
acquires the lock, re-reads under it, applies whatever combination of `restore`/`ratify`/`demote`
that state requires, writes once, and returns the **complete fresh read-model**. The client replaces
the card from that response and derives nothing.

**5 — NO PARTIAL COMMIT IS EVER REPORTED AS SUCCESS.** If the transaction cannot complete, nothing is
written and the UI returns to the state on disk.

## What this explicitly does NOT do

It does not merge the console's 12 sections into 4. Both duelists said the merge is right *and* that
it is second — merging while the copy still lies produces four long sections that lie. Correctness
first, information architecture after; that ordering is the decision, not an omission.

## Verification (before Accepted)

1. A two-process race on the lesson store, **with a control that fails**: the pre-fix shape loses a
   write, the fixed shape keeps both. (Done — control loses 1 of 2, fix keeps 2 of 2.)
2. Every cache path enumerated and asserted to carry `measuredAt`; a test that **fails** if a new
   cached endpoint is added without it.
3. A forced-stale test: plant a cache older than the ceiling, assert the endpoint does NOT serve it
   as current.
4. Toggle a lesson with the second write forced to fail; assert disk is unchanged and the UI matches
   disk.
5. Fable 5 × GPT-5.6-Sol duel on this ADR **and** its DDD, recorded in `docs/reviews/0046-*.md`.

## Consequences

Slower cold reads on any surface whose cache has expired — accepted, and the reason is stated in the
decision itself. The `{measuredAt}` envelope touches every read-model, which is a wide but shallow
change. The atomic `enabled` endpoint makes `ratify`/`demote`/`restore` internal verbs rather than
API surface, which is a simplification: three ways to express one intent was itself the bug.
