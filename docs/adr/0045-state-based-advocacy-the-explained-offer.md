---
id: ADR-045
title: State-based advocacy — the explained offer, not the goal-matched guess
status: Rejected
date: 2026-07-24
updated: 2026-07-24
authors: [Stuart Kerr, Claude Code]
tags: [proactive, advocacy, L3, explanation, consent, 4.0]
supersedes: []
relates: [ADR-027, ADR-028, ADR-040]
---

**Status**: Rejected (2026-07-24)

REJECTED BY BOTH DUELISTS — Fable 5 and GPT-5.6-Sol independently, the first double-REJECT in this project.
The product idea survives; this design does not. Full duel + the spec the rewrite must satisfy:
`docs/reviews/0045-duel-state-based-advocacy.md`. Do not implement this document.

Governed DDD: `docs/ddd/0004-advocacy-context.md` (extends the Advocacy bounded context).

## The measurement that forced this ADR

Measured live on the owner's machine, 2026-07-24 (not recalled):

- `scripts/capability-registry.mjs --json` returns **11 capabilities: 8 on, 2 OFF, 1 unknown.** The two
  off are `cross-project-lessons` ("a rule you have taught in three separate projects gets applied
  everywhere, instead of being re-taught project by project") and `nightly-refresh`. Each row already
  carries `label`, **`whatItBuysYou`** in plain English, `turnOn`, `state`, and `evidence`.
- `anticipate.sh`, fed the goal-shaped prompt *"I want my agent to remember things between sessions and
  get smarter over time"*, emitted **ZERO bytes** — on the live 3.9.18 spine **and** on the 4.0 branch.
- `goal-match.mjs` returned **`[]`** for that same prompt.

**So the brain knows two genuinely useful things are switched off, knows what each buys you, knows how to
turn each on — and has never said so.** That is ADR-028's 21-day latency failure, alive, today.

## The design error

Advocacy is currently gated behind **goal-matching**: it speaks only if the user's prompt matches a known
goal (the L4 "name the better path before you hit the wall" rung). But the owner's stated product is
**state-triggered**, not goal-triggered:

> *"I noticed you have agentdb turned on, but none of your self-learning is turned on… Would you like me
> to selectively turn them on and explain what they do and how they will help you?"*

That requires no prompt-matching at all. **The harder rung (infer intent) was made the gate for the
simpler, more valuable one (tell them what is off).** That is backwards, and it is the direct cause of the
silence measured above.

## The owner's definition, which corrects the ADR-028 framing

ADR-028 optimised for *when* it speaks (in-session, at the moment of relevance, without nagging). The
owner's 2026-07-24 statement adds the load-bearing half — **what it says when it does**:

> *"It's about instilling confidence in somebody that's nervous because they don't know the underlying
> pieces of rUv's architecture… lots and lots of people use 15% [of it]… being proactive is about helping
> without forcing… explain precisely what you're going to turn on, paragraph by paragraph."*

**The explanation IS the product.** A correct recommendation delivered without teaching is a dashboard
row. The recommendation must say, in plain language: what this is, what it buys you, what changes if you
say yes, and how to undo it — then offer.

## Decision

1. **State-based advocacy becomes the primary path.** When a capability is genuinely dormant AND carries a
   `whatItBuysYou` and a `turnOn`, it is eligible to be offered in-session — with no goal-match required.
2. **Goal-matching is demoted to an enhancer**, not a gate: a matched goal raises priority and sharpens the
   opening line ("since you're working on memory…"), but its absence never silences a real finding.
3. **The offer is an explanation, not a line item.** Delivered copy must carry, per capability: what it is ·
   what it buys you (the registry's own plain-English string) · exactly what turning it on changes ·
   how to reverse it. Paragraph form, the user's vocabulary, no internal tool names.
4. **Hooks explain themselves.** Anything that changes the user's own workflow — above all the
   continuation gate — must be *offered with its mechanics stated* before it is installed, never silently
   enabled. ("A hook that, when I reach the end of a turn with work still open, tells me to keep going —
   so you don't come back to a half-finished job. Here is exactly what it does. Want it on?")
5. **Helping without forcing, bounded:** at most ONE offer per session; a given capability is never
   re-offered while dismissed; one action silences it permanently; nothing is ever applied without an
   explicit yes. ADR-028's anti-goals remain binding — this ADR increases *what* is said, never the
   frequency ceiling.

## What this does NOT change

The delivery seam (ADR-040's chokepoint) still owns the bytes and the per-channel consent policy. This ADR
changes only **which candidates are eligible to be emitted**, never who writes them.

## Verification (before Accepted)

1. On a machine with a genuinely dormant capability, a real session produces an offer naming it, carrying
   its `whatItBuysYou` and its undo — proven end-to-end, not in a mock.
2. On a machine with nothing dormant, ZERO offers (ADR-028's non-negotiable false-alarm target).
3. A dismissed capability is never re-offered; one action silences permanently — each proven by a test
   that fails when the guard is removed.
4. Never more than one offer per session, proven under a multi-prompt session.
5. Fable 5 × GPT-5.6-Sol duel recorded in `docs/reviews/0045-*.md` — with GPT-5.6-Sol asked to RUN it,
   which is what caught three REJECT-level defects in ADR-040/043 that design-only review missed.

## Duel outcome (2026-07-24) — GPT-5.6-Sol: REJECT. Detection is a PRECONDITION, not a parallel track.

GPT-5.6-Sol was asked to RUN the code, and rejected this ADR. One of its claims was wrong and is recorded
as such: it reported live state as 8 on / 1 off / 2 unknown; re-measured directly, the actual counts are
**8 on / 2 off / 1 unknown** — the ADR's original numbers were right. Everything below survived verification.

**FINDING 1 — both "off" rows are FALSE POSITIVES. This ADR's motivating example was itself a false alarm.**
- `cross-project-lessons` reads OFF while the promoted block **is present** in `~/.claude/CLAUDE.md`
  (promoted 2026-07-24). Its evidence — *"7 processes … still trapped at project level"* — shows the probe
  measures **promotable candidates remaining**, never **whether promotion is in effect**. It therefore reads
  OFF permanently, however many times the user promotes.
- `nightly-refresh` reads OFF on evidence *"2 nightly refresh jobs loaded, and 1 last exited non-zero."* The
  jobs are installed and scheduled; the non-zero exit is the publish guard **correctly** refusing to release
  from a non-main branch. A working guard is being reported as a dormant capability.
- **Fix (blocking):** the dormancy predicate must measure EFFECT-IN-FORCE, not remaining candidates, and must
  distinguish "failed" from "correctly declined." Nothing may be offered on an `unknown` state.

**FINDING 2 — the teaching paragraph cannot be built from the current data.** `turnOn` is `null` for
`nightly-refresh` and `learning-hooks`, and a structured `{human, cmd}` object (not a string) for the rest —
direct rendering yields `[object Object]`. The registry has no `whatChanges` and no `undo` field at all, so
the four-part explanation this ADR *requires* is underivable. **Fix:** an explicit, validated offer schema
(`whatIs`, `whatItBuysYou`, `whatChanges`, `turnOn`, `undo`); a row failing validation is never offered.

**FINDING 3 — the ceiling and the permanence guarantee do not exist.** The effective ceiling is 2, not 1.
`anticipate-state.json` uses unlocked read-modify-rename, so two subprocesses can read the same empty session
and both emit (atomic rename prevents torn files, not duplicate claims). `--dismiss` omits `scope:"forever"`,
so "dismissed" is not permanent. **Fix:** a transactional claim unique on `(session_id, offer_slot)`;
one-action dismissal that actually writes `forever`; and RETAIN goal-match's subject/intent veto as a
relevance filter even after it stops being the gate — without it, a false row can interrupt any unrelated turn.

**The inversion this forces, and the reason the REJECT is correct:** this ADR assumed *detection works,
delivery is broken*. Both are broken, and the silence is the only thing that has prevented the user being
told something false about their own machine. **Detection accuracy is now a blocking precondition of
delivery.** Shipping the delivery half first would have made a confident, wrong offer the user's first
experience of "proactive" — the exact trust cost ADR-028 fixes at zero.

## Consequences

This is the change that makes the Proactive pillar real rather than latent: the detector's findings stop
being console-only. It is also the highest-risk change in the pillar — an offer that fires wrongly costs
more trust than ten correct ones earn — which is why the frequency ceiling is tightened in the same work,
and why the duel is not optional.
