# Duel record — ADR-045 (state-based advocacy)

Date: 2026-07-24 · Governs: `docs/adr/0045-state-based-advocacy-the-explained-offer.md`
Duelists: **Fable 5** (stance: this will annoy users and destroy trust) · **GPT-5.6-Sol** (stance: empirical,
told to RUN the code). Both reviewed independently.

## Result: REJECT × 2. The ADR is dead as written.

This is the first ADR in the project to be rejected by **both** duelists, and they converge on the same
three failures while each finding something the other missed. The product idea survives; this design does not.

## Where they converge (the load-bearing failures)

**1. Both "off" findings — the ADR's entire empirical case — are FALSE POSITIVES.**
- `cross-project-lessons` reads OFF while the promoted block **is present** in `~/.claude/CLAUDE.md`
  (promoted the same day). Its evidence — *"7 processes … still trapped at project level (from 744 lessons
  across 41 projects)"* — proves the probe counts **backlog remaining**, never **effect in force**.
- `nightly-refresh` reads OFF on *"2 nightly refresh jobs loaded, and 1 last exited non-zero."* The jobs are
  installed and scheduled; the non-zero exit is the publish guard **correctly declining** to release from a
  non-main branch. Fable's framing: this is a **category error** — the capability is installed, enabled, and
  *broken*, which is an alarm, not a dormancy offer.
- Fable additionally: `nightly-refresh` has `turnOn: null`, so under **ADR-045's own Decision-1 eligibility
  rule** it could never be offered anyway. *"The sample size of clean examples motivating this ADR is zero."*

**2. The frequency ceiling does not exist, and "one action silences forever" is false against shipped code.**
- GPT-5.6-Sol: the effective ceiling is **2, not 1** — `anticipate-state.json` uses unlocked
  read-modify-rename, so two subprocesses can read the same empty session and both emit. `--dismiss` omits
  `scope:"forever"`.
- Fable: *sessions are the wrong denominator* — the **user** controls session count; six `/clear`s a day is
  six interruptions about the same finding, because the `said` set re-arms on every new `session_id`.
- Fable, decisive: `DISMISSAL_BUDGET = { normal: 1, high: 3 }` plus a state-change reprieve means a
  high-severity offer **comes back to argue after a no** — anticipate.sh's own copy admits *"a single click
  cannot bury a high-severity finding."* ADR-045 restates ADR-028's "silenceable in one action, permanently"
  while standing on machinery that breaks it.

**3. The mandated teaching paragraph cannot be built from the data.**
- Both: `turnOn` is `null` for two rows and a structured `{human, cmd}` object for the rest (renders as
  `[object Object]`); the registry has **no `whatChanges` and no `undo` field at all**.
- Fable: the undo requirement therefore gets hand-written or silently dropped — *"this repo's own remedy
  registry exists precisely because a recommendation once promised an undo that had no branch behind it."*

## What Fable found that GPT-5.6-Sol did not (each verified against a cited path)

- **The reprieve is a perpetual-nag engine.** `stateHashOf()` (`scripts/advocacy-outcomes.mjs:174`) hashes the
  **evidence prose, which contains live counters**. Every tick of "744 lessons" mints a fresh state hash — the
  exact token the reprieve treats as *"the world changed, you may speak again."* Dismissal can never stick.
- **The anti-nag path is gated behind the pull surface it exists to replace.** Ignore-weight accrual needs
  IGNORED records, written by `reconcileIgnored()`, whose caller is the **console's** `/api/capabilities`
  handler. *A user who never opens the console never accrues ignores* — ADR-028's own named structural
  failure, reproduced inside the fix for it.
- **It self-classifies as nagging in a week, by the project's own metric.** One capability re-offered daily
  and ignored for seven days = 7 offered / 0 applied → precision 0.0 against ADR-028's ≥0.60 floor.
- **Relevance was never an enhancer — it was the consent.** `goal-match.mjs`'s header already contains the
  pre-written bad offer (*"our nightly build failed" → CI, not the KB refresh*). ADR-028 defines L3 as *"a
  dormant capability **relevant to the current task** surfaces in-session"*; ADR-045 claims to implement L3
  while deleting the relevance clause that defines it. Worst case: production is down, the user asks about a
  failing deploy, and the assistant opens by offering a command that mutates their **global, every-project**
  memory store — because a backlog counter is nonzero.
- **The copy is console copy, and unprompted it reads as an upsell.** All eleven `whatItBuysYou` strings use
  benefit + loss-framing. The worst, verbatim (`scripts/capability-registry.mjs:474`): *"The rules your AI
  works by get tested against each other, and the version that measurably does better becomes the new
  default."* Read by the nervous developer this ADR claims to serve, unprompted, mid-task: the tool just
  announced it wants to rewrite its own operating rules. That is not confidence-building.
- **Self-installing hooks are a measured data-loss risk.** `advocacy-outcomes.mjs:197` records that
  read-modify-write on a settings JSON with four concurrent writers **lost a setting in 19 of 20 trials, every
  writer returning ok:true**. A "yes" in session A can silently destroy hooks configured in session B. Plus
  orphaned hook entries surviving `--uninstall` (the registry **already refuses** `turnOn` for
  `session-capture` / `write-gates` / `nightly-refresh` for exactly this reason) — so ADR-045 Decision 4
  orders the product to do what its own detector's documentation forbids.

## Correction to the record

GPT-5.6-Sol reported live state as 8 on / 1 off / 2 unknown. Re-measured directly: **8 on / 2 off / 1
unknown** — the ADR's original counts were right. Recorded so the duel's own errors are not laundered.

## The design both reviews point at (what the rewrite must satisfy)

1. **Define dormancy strictly: installed, usable, NEVER USED** — mechanically distinct from *failing* (that is
   an alarm) and from *backlog pending* (that is a treadmill). Neither current OFF qualifies.
2. **Keep goal-match as the GATE for the in-session voice.** Route genuinely state-triggered findings to
   session-start or the alarm channel, where a broken cron job belongs.
3. **Ceiling = once per (capability, STABLE state) ever, across sessions** — ADR-027's original "once per
   state change." Hash a stable identity (capability key + config generation), **never counter-bearing prose**.
4. **Accrue IGNORED in-session at SessionEnd**, so silence suppresses without requiring the console.
5. **One explicit no is final at every severity** for advocacy; the escalation budget belongs to alarms only.
6. **No verified undo ⇒ not offerable.** Add `turnOff` under the same `--help`-verified-or-null discipline as
   `turnOn`, and an explicit validated offer schema (`whatIs`, `whatItBuysYou`, `whatChanges`, `turnOn`, `undo`).
7. **Rewrite in-session copy for the interruption context** — evidence-first, neutral, no loss-framing.
8. **Hook installation** through one lock-guarded installer with a durable consent record and an uninstall
   manifest, exercised by an install→update→uninstall→clean test; never triggered by a parsed chat token alone.

## What both said NOT to change

The diagnosis (the silence is a real defect); **"the explanation IS the product"** and requiring the undo in
the copy; the Decision-1 eligibility precondition (correct, just needs `turnOff` added); ADR-040's chokepoint
as sole byte-writer with candidates-not-prose; and the discipline of making GPT-5.6-Sol **run** it.
