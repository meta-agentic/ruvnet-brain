# RuvNet-Brain 4.0 line — what's new (the major-release highlights)

Updated: 2026-07-25

> **Source of truth** for the `/whats-new` command and the first-run upgrade message. Curated, honest,
> major-only — not the point-release churn. If a claim here isn't true of the shipping build, it does not
> belong here. The self-measurement claims are deliberately hedged: they are *new and filling*, not
> *proven*.
>
> **⚠️ VERSION STATUS (ADR-042, owner decision 2026-07-25):** these enhancements are shipping **now, in
> the `3.9.x` line** — the version is NOT `4.0.0` yet, and deliberately so. Per Accepted ADR-042, the
> number stays `3.9.x-dev` until the work is field-verified (real advocacy outcomes at n≥29 + an
> independent re-grade). So this file describes **the 4.0-line enhancements you already have**, with the
> `4.0.0` *stamp* pending verification — never "you are on 4.0." A cross-model duel (GPT-5.6, 2026-07-25,
> `docs/reviews/0042-gpt56-4.0-go-no-go.md`) reached HOLD on a premature stamp; this framing is the
> honest result.

**One line:** the 4.0 line is where the brain got **honest, legible, fast, and self-measuring** — and
it's landing now.

## The big things

### 1. The Console is the front door
Type `/rvbc` and your whole RuvNet stack is on one live local page: what's installed, what the AI has
actually learned from *your* projects (real memories + distilled lessons, drill-down to the verbatim
cards), which subscription pays for what, and one-click **reversible** fixes for anything stale. New in
4.0:
- a plain-English **explainer on every card** (no more guessing what "trust & provenance" means),
- every suggestion carries its **blast radius** — *just this project* vs *every project · this machine*,
- **safe on/off checkboxes** that appear *only* where the undo is proven,
- a **terminal-first install** — the granular "here's exactly what I'll do, uncheck any of it" flow runs
  in your terminal, where an `npx` user expects it.

### 2. It will not lie about your machine
Every number is measured live from your setup. **"We couldn't check" never renders as "off."** One
project's state can never leak into another project's view (a real bug 4.0 fixed in the console itself).
Empty-first, honest-always.

### 3. Fast — and it tells you when it's ready
The console and tips page paint in **well under a second** (measured, with a QE suite that runs every
time). On a first scan it shows a **countdown** and then says *"it's live — take a look at your page,"*
so you're never staring at a blank screen wondering if it hung.

### 4. It measures itself now
The brain records when it offered help and whether you acted on it — so over time it can **prove** it's
improving instead of asserting it. **Honest caveat:** this instrumentation is *new* and has only just
started collecting. 4.0 is not a claim of "proven better in the field" — it is the release that makes
that proof *possible*, and the evidence accrues as you use it.

### 5. It learns across your projects
A lesson proven in one project can be **promoted to your global brain** and applied everywhere — and it
now **survives an update** (tested against the real updater, not argued).

### 6. Runs on your account, cheapest capable model
The QE suite and model routing use **your Claude account, not an API key**, at the least-powerful model
that does the job. Nothing bills silently.

## What 4.0 deliberately does NOT claim
Stated up front because overclaiming is the one thing this product cannot do:
- **Not** "proven X% better" — the outcome ledger is still filling (see #4).
- **Not** "fully proactive / anticipatory" — the brain still mostly speaks when you open the console or
  ask; the in-session, unprompted surface is the next frontier, not a shipped 4.0 guarantee.
- **Not** independently graded ≥95 — the last independent grade was in the low 70s, honestly recorded in
  `docs/4.0-READINESS.md`. 4.0 earns its number on *substance and honesty*, not a score.

## For upgraders
Most people will meet 4.0 by waking up to it — the auto-update lands and the version reads `4.0`. You did
not have to visit a web page to find out what changed: the brain tells you itself on the first session
after the upgrade, and offers to open the Console so you can *see* it. That's the point of this release —
the brain manages the relationship, honestly.
