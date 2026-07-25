# UX-Experience QE Suite — spec (requested by owner 2026-07-24)

Status: **BUILT (local Mac probes) + PASSING 2026-07-24** — build order steps 1–2 done; steps 3–4 (CI
matrix, Codex host) open. The runnable suite is `npm run qe:ux` (`scripts/qe/ux-suite.mjs`,
`tests/ux/render-probe.mjs`, `tests/ux/command-probe.mjs`); real first-run numbers and the frozen
thresholds are in `docs/qe/ux-first-run.md`. Grounded live: `aqe`/`agentic-qe` are installed
(`~/.npm-global/bin/`); CI today is Linux + Windows guard-checks (`ci.yml`, `integration-linux.yml`),
no macOS, no UX-timing, no Codex host.

> **Build note (2026-07-24):** measuring scenario 3 drove out two real product changes, not just
> numbers — the "it's live" completion signal did not exist (added `announceWhenLive()` in
> `scripts/onboarding-console.mjs`), and dead-air exceeded the 3s bar on a cold scan (added a `…scanning
> (Ns)` countdown tick). Both were built and re-measured green. See `docs/qe/ux-first-run.md`.

## What the owner asked for (verbatim intent)

A **custom Agentic-QE test suite** covering the **end-user experience**, across
**Linux / Mac / Windows** and **Claude / Codex hosts**:

1. **Time-to-visible** — how long the **console** and the **tips page** take to show up on the
   computer after they're opened.
2. **Command→explanation latency** — after someone runs the console command (`/rvbc` / `/brain-console`
   / `npx ruvnet-brain --configure`), how long until they see, in the terminal, an explanation of
   *exactly what's about to happen*. This should be **near-instant**.
3. **Completion signal** — a countdown / progress that eventually says **"it's live — take a look at
   your page"**, so the user knows when to look and isn't staring at nothing.

## Measurements & thresholds (the assertions)

| # | Signal | Measure | Threshold (proposed) | How |
|---|---|---|---|---|
| 1a | Console time-to-visible | server-ready → key content painted | < 1500 ms after ready | Playwright: `page.goto` → wait for `#card-capabilities` first paint; record `performance.timing` |
| 1b | Tips time-to-visible | load → hero + first section visible | < 1200 ms | same, on `tips.html` |
| 2 | Command→explanation | command invoked → first terminal bytes explaining the plan | < 500 ms (near-instant) | PTY (`expect`) around the real command; timestamp first non-blank line |
| 3a | Completion signal EXISTS | a "live / open your page" message is emitted | must appear | scan terminal output for the signal |
| 3b | Completion signal TIMING | command → "it's live" | reported, not gated (varies with the ~736MB fetch) | PTY timestamps; assert the signal ARRIVES, measure how long |
| 3c | No dead air | between command and "it's live", progress is shown at least every N s | ≤ 3 s gap | PTY: assert no silent gap > 3 s |

Thresholds are proposals — tune against a first real run, then freeze (a QE threshold nobody
measured is a guess).

## Agentic-QE integration (the REAL tool, not a vitest suite wearing its name)

- Model each scenario as an **`aqe task`** in a QE domain (`aqe domain` for "onboarding-ux"), so
  the suite is genuinely orchestrated by aqe and shows in `aqe status`/`aqe routing`, not a
  hand-rolled runner. GROUND `aqe task --help` / `aqe domain --help` before wiring — do not assume
  the flags.
- The actual measurement probes (Playwright for render, `expect` PTY for terminal) are the task
  executors aqe drives. This keeps the timing logic real and the orchestration real.
- If a scenario genuinely doesn't fit aqe's model, say so out loud and run it as a plain integration
  test — never quietly relabel.

## Platform matrix (this is where "cross-platform" actually gets tested)

Extend `.github/workflows/` with a matrix job:

```
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
```

- **Mac**: buildable + runnable locally now (dev machine) AND in `macos-latest` — the one currently
  missing from CI.
- **Linux/Windows**: the timing probes run in CI runners. NOTE the installer's macOS-specific bits
  (LaunchAgents) — on Linux/Windows the "keep it current" step is the cron line / documented path,
  so scenario 2/3 assertions branch by platform (the explanation text differs; the *latency* bar is
  the same).
- Honest limit: a Mac cannot execute the Windows/Linux runs — they execute in CI. The suite is
  written to run everywhere the matrix has a runner.

## Host matrix (Claude vs Codex)

- The brain runs under both hosts (agentic-kit is dual-host, Claude + Codex). The console/tips render
  test is host-agnostic (it's a local web page). The **command→explanation** test differs: Claude
  invokes via the plugin slash command; Codex via its own surface.
- Scenario 2/3 get a host dimension: run the command path under each host's invocation and assert the
  same near-instant explanation + completion signal. Codex coverage needs a Codex host present to run
  against — flag it as CI-gated on Codex availability, never faked from Mac/Claude.

## Build order (so the first piece is real, not the whole thing shallow)

1. **Local Mac timing probes** (Playwright render + `expect` PTY) — real, runnable now. Freeze
   thresholds from a first run.
2. **Wire them as `aqe` tasks** in an `onboarding-ux` domain (after grounding aqe's task model).
3. **CI matrix** (add macos-latest + the timing job to Linux/Windows).
4. **Host dimension** (Claude path now; Codex when a Codex runner exists).

## The honesty rule for this suite (same as the product)

Every number is MEASURED on the run, never asserted from memory. A threshold that was never
measured is a guess and is labelled as such. A platform/host the suite could not actually execute on
is reported as "not run", never as "passed". Silence is not success.
