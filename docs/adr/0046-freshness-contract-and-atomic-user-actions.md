---
id: ADR-046
title: Every rendered claim carries its as-of, and every user action is one transaction
status: Proposed
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

**Status**: Proposed (2026-07-24). Governed DDD: `docs/ddd/0011-freshness-context.md`.

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
