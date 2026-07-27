# Scheduled jobs in OTHER projects — audited 2026-07-13, PARKED at Stuart's direction

Updated: 2026-07-12

Stuart: "I don't give a shit about the cognitive traitor right now or the New York Times crossword.
None of that shit matters. I asked you about RuvNet-Brain." — so these are RECORDED, not acted on.
Audited by two Sonnet subagents against live plists, scripts, logs, and git history.

## Genuinely broken (someone should fix, some day)
- **cognitum-trader.dashboard** — DEAD. Its target `sports_dashboard_server.py` was DELETED in commit
  d182813 (2026-05-13). It has crash-looped every 30 seconds ever since: **34MB / 155,390 identical
  "No such file or directory" errors.**
- **cognitum-trader.scanner** — alive but every Foresight/Lightning Rod call has failed with
  **HTTP 402 "Insufficient credit balance" since ~2026-06-27**. This is the ROOT CAUSE behind every
  ALARM the trader's health-watchdog has been raising. Fix = top up billing.
- **cognitum-trader.daily-learning / strategic-review** — both fail `bash -n` (unquoted-heredoc
  apostrophe bug). They have run every day since 2026-05-26 and **never once succeeded**.
- **cognitum-trader.sidecar** — running, but `RVF rebuild failed: FsyncFailed (0x0303)` at startup.
- **cognitum-trader.health-watchdog** — exit 1 is **BY-DESIGN**: it is a WORKING alarm correctly
  reporting the scanner's degradation. Nobody was listening. (Same disease as ask-ruvnet's
  pipeline-health: a correct alarm screaming into a void.)
- **all-in-expert.weekly** — reports `OK` while its last SIX real rebuilds died at the OpenAI
  embedding step (missing `OPEN_AI_KEY`). **The job that looks greenest in launchctl is the one that
  is actually degraded** — the inverse of the ruvnet-brain failure mode, and just as dangerous.
- **powerplatepulse.cognitum-update-check** — deliberately `launchctl disable`d after a failed
  2026-04-08 aarch64 build. Inert, not accidental.

## Healthy, proven running (leave alone)
all-in-expert.watchdog · chrisdavidsalon.weekly-engine · cds.gbp-autorun ·
stuart.powerplate.submodule-update · cognitum-trader.daily-digest · daily-test-report

## The transferable lesson
Several of these write their real logs to a file the plist does NOT declare, so the log a human checks
first (`StandardOutPath`) is permanently 0 bytes — it reads as "never ran" while the job runs daily.
The mirror image of ruvnet-brain's bug. Both are cured the same way: a receipt the job cannot forget
to write (`scripts/job-heartbeat.sh`) plus a registry that says what SHOULD be running.
