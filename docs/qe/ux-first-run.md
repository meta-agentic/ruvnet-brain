# UX QE suite — measured baseline and hard release budgets

Updated: 2026-07-28

Run 2026-07-24 on the dev Mac (Darwin arm64, M3 Max), `npm run qe:ux`. Every number below was MEASURED
on a real run — Playwright chromium 1228 driving the real console server, and a real cold launch parsed
for terminal timing. Nothing here is asserted from memory. The suite is **model-free**: it drives a
browser and a local HTTP server, calls no LLM, uses no API key, and touches no account.

## Measured (across several runs — timing varies, reported honestly as a range)

| Signal | Measured | Darwin HARD budget | Basis |
|---|---|---|---|
| server-ready (GET / → 200) | 1199–1234 ms | 2500 ms | cold node boot + listen |
| console time-to-visible (`#card-capabilities` painted) | 279–336 ms | 2500 ms | warm cache; first paint is cheap |
| tips time-to-visible (`.hero-scene`) | 237–269 ms | 2000 ms | static page |
| tips first-section (`#inventory`) | 202–208 ms | 2000 ms | static page |
| command→explanation (first explanatory line) | 840–1256 ms | 1500 ms | dominated by node boot; "near-instant" for a CLI |
| command→"it's live" (completion signal) | 3444–5218 ms | reported, not gated | varies with the cold scan; the point is it ARRIVES |
| max dead-air gap | 2030 ms (after countdown ticks) | 3000 ms | see note below |
| completion signal present | YES | must be present | the `announceWhenLive` line |

The suite now hard-fails every render, explanation, and dead-air budget. Linux and Windows run as
separate required workflow jobs with bounded hosted-runner startup headroom:

| Platform | Server-ready | Console paint | Tips paint | Explanation | Dead air |
|---|---:|---:|---:|---:|---:|
| macOS | 2500 ms | 2500 ms | 2000 ms | 1500 ms | 3000 ms |
| Linux | 4000 ms | 3000 ms | 2500 ms | 2500 ms | 3000 ms |
| Windows | 6000 ms | 4000 ms | 3500 ms | 3000 ms | 3000 ms |

These are release budgets, not claims about runner speed. Each CI job uploads its actual measurements
as `ux-qe-<os>.json`; a missing browser, missing receipt, missing measurement, or budget breach is red.

## Two real product changes this run drove out (measurement → fix, not measurement → number)

1. **The completion signal did not exist.** Before this session the console launcher printed
   "scanning ~15s" and then nothing — the page just filled in silently, so a user never got the
   "okay, it's live, take a look at your page" the owner asked for. Added `announceWhenLive()` in
   `scripts/onboarding-console.mjs`: it watches the state cache the page paints first and prints one
   honest "it's live" line when it actually lands (an observed fact, not a fixed timer). The suite's
   3a assertion now passes because the feature exists — it was built, not asserted.

2. **Dead-air exceeded 3s on a slow cold scan.** With only a start line and an end line, the gap
   between them measured 3008–3375 ms — over the owner's "≤3s, show a countdown" bar. `announceWhenLive`
   now emits a `…scanning (Ns)` tick every ~2s (500 ms poll), which brought the measured max gap to
   **2030 ms**. This is the owner's "a countdown or something" made real, and the QE number is what
   proved it was needed and then proved it was fixed.

## What is NOT covered by this first run (stated, never faked as "passed")

- **Linux / Windows from this document's local run**: not run locally. They execute independently in
  `.github/workflows/ux-qe.yml`; do not treat the Mac numbers above as evidence for those jobs.
- **Codex host**: the command→explanation path under Codex needs a Codex runner present. Status:
  **not run** — CI-gated on Codex availability, never faked from the Mac/Claude path.
- **aqe orchestration**: the run registers an `aqe task submit quality-assessment` (grounded flags,
  fire-and-forget, no model billed) for visibility in `aqe status`. The MEASUREMENT itself is a plain
  deterministic probe — we do NOT invent an aqe "domain" (verified live: `aqe domain` is list/health
  only, not create), which would be fiction.

## Re-freezing

Do not loosen `PLATFORM_BUDGETS` from one noisy run. Use the uploaded per-platform receipts to show a
repeatable distribution, document the user impact of the proposed change, then update the hard budget.
