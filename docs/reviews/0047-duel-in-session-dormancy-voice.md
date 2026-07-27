# Duel record — ADR-047 / DDD-0012 (in-session dormancy voice)

Updated: 2026-07-24

Date: 2026-07-24 · Governs `docs/adr/0047-in-session-dormancy-voice.md`, `docs/ddd/0012-advocacy-delivery-context.md`
Duelists: **Fable 5** (stance: this will annoy users and destroy trust) · **GPT-5.6-Sol** (stance: empirical, told to RUN it)

## Result: ACCEPT WITH CHANGES (Fable, 52/100) · REJECT (Sol, 31/100)

Not a double-REJECT like ADR-045 — and the difference is worth stating, because it is the design
improving rather than the reviewers softening. Fable, unprompted: *"a real design engaging real code —
the opposite of ADR-045's shape."* Both duelists confirmed the ADR's citations largely survive
verification. The disagreement is about **whether the thing it delivers is worth the machinery**, and
on that Sol did the arithmetic Fable only gestured at.

## The finding that decides it

Sol computed the launch surface from the live registry rather than the document:

> *"Five `turnOn` commands and **zero verified matching inverses**. Once the unsound
> memory-distillation borrowing is removed, the honest launch surface is **zero**. Building a new
> SessionStart producer, SessionEnd hook, Offer constructor, and ledger policy around zero valid
> products is infrastructure-first development with no acceptance case."*

**And it got worse during the duel, in the good way.** Fixing the five unsound OFF branches both
duelists identified (below) took this machine to **10 on / 1 unknown / 0 off**. There is now *nothing
dormant on it to offer*. ADR-047's premise has no subject here.

That is not an argument that dormancy never happens — it is an argument that we were about to build a
delivery system whose only acceptance test could not be constructed. The correct move is Sol's:
**narrow to one capability, make it genuinely reversible end-to-end, build a real dormant fixture,
prove one safe offer.** Then decide whether the reusable infrastructure has earned existence.

## Where they converge (verified by both, then fixed)

**The OFF taxonomy was unsound in five places** — every one the same shape: *used-but-weak or
used-then-quiet, reported as never-used*. OFF means "we looked and it is not running" and points the
reader at `turnOn`; telling someone to switch on a thing already running is how a true finding becomes
a wasted afternoon.

| # | Branch | Was | Now | Found by |
|---|---|---|---|---|
| 1 | learner quiet 400 days (`case 'IDLE'`) | `OFF` | `IDLE` | Fable |
| 2 | distillation "barely run" (patterns > 0) | `OFF` | `ON`, ratio in evidence | Fable |
| 3 | harness-evolution "has run, none in force" | `OFF` | `IDLE` | Sol |
| 4 | write-gates wired but advisory-only | `OFF` | `ON`, mode in evidence | Sol |
| 5 | session-capture one boundary of two | `OFF` | `ON`, gap in evidence | Sol |

Row 1 is the sharpest self-indictment available: `STATE.IDLE` was added to this very file hours
earlier and wired into **one** detector, while a case *literally named* `'IDLE'`, whose own sentence
reads "ran before and has gone quiet", kept returning `OFF`. One bug, found once, fixed once, left
everywhere else — the phrase used in that morning's commit message.

Row 6 (`session-capture`, neither boundary registered) was checked and is **correctly** OFF. Not every
OFF was wrong, and saying so is part of the audit.

## Where Sol REFUTED Fable

Fable's findings 2 and 6 contradict each other and **6 wins empirically**. Fable argued `stateHash` is
"unreachable by construction" because §5 forces advocacy to `normal`; Sol ran it and showed
`shouldStillOffer()` computes `weightClass(severity ?? o.lastSeverity)` — passing `null`
**delegates to ledger history**, so the high branch stays reachable. The guarantee holds today only
because every existing record happens to carry `'normal'`.

A duel that launders a duelist's own error is worth nothing; recording the refutation is the point.

## What Sol found that Fable did not

- **No transactional offer claim.** Pending `OFFERED` rows are excluded from `outcomesFor().offered`,
  so `shouldStillOffer()` returned `true` with 1, 2, 5 and 20 pending offers — probed, not reasoned.
- **Ledger-write failure still speaks.** The runtime ignores `record()`'s `{ok:false}` and delivers
  anyway; Sol forced an impossible ledger path and the full envelope still emitted. Dedup and
  precision vanish exactly when storage fails.
- **`advocacy-reconcile` is unwired and unwirable as proposed** — `hook-shim.mjs` has a closed table
  without that id. Sol ran it: "unknown hook id", exit 0. And a real pending offer from 2026-07-23 is
  still sitting unresolved in the live ledger.
- **Project scoping is wrong for project-scoped rows.** Suppression deliberately ignores `project`, so
  an offer in project A suppresses project B, while B turning on can resolve A's offer as APPLIED.
- **`(key,state)` cannot distinguish `off → on → off`** — the final `(key,off)` is identical to the
  first. A monotonic state generation is required, not a hash of the pair.

## What both missed

Fable: session identity, the `important-only` dial delivering never-important findings, cross-channel
dedup, and that `OFFERED` is recorded at envelope emission whether or not the model relays it.
Sol: agreed on the dial and the emit-time recording; added that `mcp-servers`' `turnOn` is a
placeholder template that passes a presence check but is not paste-runnable — so the offer schema
needs a **runnability** rule, not a presence rule.

Neither document names SessionEnd non-delivery (killed terminal) as a failure mode, and the whole
anti-repeat mechanism rests on it firing.

## Disposition

**ADR-047 → Rejected.** Not because the diagnosis is wrong — `capability-audit.mjs` still has zero
callers and that is still the largest 4.0 gap — but because the delivery system it specifies has, on
measured evidence, nothing correct to deliver.

**The narrowed path both duelists point at, in order:**

1. Build ONE real Offer executor: a project-scoped distillation wrapper that takes a WAL-safe backup,
   writes a durable receipt **fail-closed**, verifies the pattern delta, and exposes a tested restore.
   (The current `turnOn` is raw `ruflo memory distill run`, which — verified by Sol against
   `--help` — has no backup option at all; the cited inverse belongs to a different executor.)
2. Fix the ledger contract BEFORE adding any hook: `offer_id`, `session_id`, scope + project identity,
   monotonic state generation, transactional claim with a uniqueness constraint.
3. Make the ceiling survive a killed terminal — a delivered claim must suppress duplicates without
   SessionEnd being the mechanism that makes it true.
4. Add real explanation fields (`whatIs`, `whyItMatters`, `whatChanges`, `execute`, `undo`) instead of
   deriving a teaching paragraph from counter-bearing evidence prose.
5. Only then re-open the question of whether the generic delivery infrastructure is worth building.

## What neither duelist verified

Sol: did not run two interactive sessions or kill a terminal (it exercised the ledger arithmetic and
forced the storage-failure path instead); did not execute distillation or restore against a real
database; could not run vitest (sandbox `EPERM`), so **no test result from that review is a pass or a
fail**. Fable: executed nothing — a documents-and-code read only.
