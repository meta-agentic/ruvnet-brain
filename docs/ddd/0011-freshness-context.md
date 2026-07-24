# DDD-0011 — The Freshness bounded context

Updated: 2026-07-24 | Version 1.0.0
Created: 2026-07-24

Governs **ADR-046** (every rendered claim carries its as-of; every user action is one transaction).

**Status**: Proposed (2026-07-24)

---

## Why this context exists separately

DDD-0008 (Currency) reasons about **our own claims about the world in writing** — do the ADRs still
describe the code? Its stated single failure mode is *"a sentence that used to be true."*

Freshness is its **runtime sibling**. Same failure mode, different medium: not a sentence in a
document that has gone stale, but a sentence **rendered to the user right now** that was true when it
was measured and is not true when it is read. Currency's entities are documents and its clock is the
git history; Freshness's entities are *measurements* and its clock is wall time.

Keeping them apart matters because their remedies differ. A stale document is fixed by editing it. A
stale measurement cannot be fixed by editing anything — it can only be **re-measured or withheld**.
That asymmetry is the whole design: this context has no "update the text" move, only "measure again"
and "say nothing."

It is emphatically **not** part of the Capability context (DDD-0006). Capability answers *"is this
on?"* Freshness answers *"how long ago did we establish that, and are we still entitled to say it?"*
— a question that can fail while every capability detector is perfectly correct. That is exactly what
happened on 2026-07-24: the detectors were right and the page was wrong for two days.

---

## Ubiquitous language

| Term | Precise meaning | Explicitly NOT |
|---|---|---|
| **Measurement** | A value obtained by observing the machine at a specific instant | a config value, a constant, or anything derived from other measurements |
| **measuredAt** | The instant the observation was made — **not** the instant it was cached, served, or rendered | a cache-write timestamp; a request timestamp |
| **Age** | `now − measuredAt`, computed server-side and sent as `ageMs` | something the client derives by parsing a date string |
| **Ceiling** | The maximum age at which a measurement may be presented as current | a cache TTL for performance; this is a *truth* limit, not an eviction policy |
| **Stale** | Age > ceiling. A stale measurement is **unservable as a claim** | "a bit old"; "probably still fine" |
| **Withheld** | Not shown, and the absence explained | shown greyed out; shown with a warning; shown at all |
| **Desired state** | What the user wants to be true (`enabled: true`) | the sequence of writes required to get there |
| **Transaction** | Lock → re-read → apply → write → return fresh read-model, indivisible | a request; a POST; two POSTs that usually both succeed |

**The word we refuse: "cache."** A cache is a performance concept and it smuggles in permission to
serve whatever it holds. Every entity here is a *measurement with an age*, and the age is load-bearing.

---

## Aggregate root: the Read-Model

A Read-Model is the unit of consistency. Its invariants:

- **INV-1 — No measurement without a stamp.** A read-model that cannot produce `measuredAt` cannot be
  constructed. There is no "unknown age" state, because unknown age is operationally identical to
  infinitely old and must be treated as such (an unparseable stamp ⇒ ancient).
- **INV-2 — The stamp travels with the value, to the last consumer.** A payload carrying `measuredAt`
  that the renderer drops is the same lie one layer up. The context boundary is the *pixel*, not the
  HTTP response.
- **INV-3 — Over the ceiling, we do not speak.** Serving stale data as current is forbidden even when
  re-measuring is expensive. A slow honest page beats a fast lying one.
- **INV-4 — Withholding is a legitimate outcome.** "We could not establish this" is a first-class
  answer, never rounded to "fine" and never rounded to "broken."

## Aggregate root: the Intent

- **INV-5 — One intent, one transaction.** The client expresses *what it wants to be true*. The
  server owns the sequence of writes. A client that composes two writes has taken on a
  responsibility it cannot discharge, because it cannot hold the lock between them.
- **INV-6 — Partial commits are impossible or reported.** Either the transaction completes, or
  nothing is written. There is no third outcome that renders as success.
- **INV-7 — The response IS the new truth.** A mutation returns the complete fresh read-model, and
  the client replaces from it rather than patching what it already had. Patching is a second
  implementation of the server's derivation logic, free to drift from it.

---

## Anti-corruption layer

The console consumes measurements from many producers — `capability-registry`, `gates`, the memory
fleet scan, the stack audit, the trust/release check. **Not one of them was designed to report its
own age.** The ACL is the wrapper that refuses to publish any of their output without a stamp, and it
sits at the *serving* boundary rather than inside each producer, so a new producer cannot forget.

The temptation is to let each producer manage its own freshness. That is precisely how this bug
survived: `serveCached` acquired a ceiling while `console-cache.json`, `ACTIVITY_MACHINE_CACHE`,
`TRUST_CACHE` and the stack path each kept their own private, ceiling-free behaviour. **Four
freshness policies is zero freshness policies.**

---

## Domain events

| Event | Meaning | Consumer |
|---|---|---|
| `MeasurementTaken` | a producer observed the machine; carries `measuredAt` | the read-model store |
| `MeasurementExpired` | age crossed the ceiling; the value is no longer a claim | the serving layer — triggers re-measure or withhold |
| `MeasurementWithheld` | expired and re-measure failed; nothing is asserted | the renderer — must show the absence, not the last value |
| `IntentApplied` | a desired state was reached in one transaction | the client — replaces its view wholesale |
| `IntentRefused` | the transaction could not complete; disk unchanged | the client — reverts to disk state and says why |

---

## What is deliberately NOT in this context

- **The 12→4 console restructure.** Information architecture, not truth. Both duelists said it is
  right and second.
- **Copy altitude** (maintainer diary shipped to end users, first-person lesson koans). Real findings,
  but a separate concern: those sentences are *true* and badly pitched. This context is about
  sentences that are *false*.
- **Performance.** Any speedup here is incidental. If freshness makes the page slower, the page gets
  slower.
