Updated: 2026-07-28 13:00 EDT | Version 1.0.0
Created: 2026-07-28 13:00 EDT

# Nightly refresh and publish

There are two different jobs called “nightly.” They must not be confused:

| Job | Who it serves | Scheduler | Time | What it does |
|---|---|---|---|---|
| Author publish | The canonical GitHub/npm/RVF release | macOS LaunchAgent `com.ruvnet.brain-nightly` on the maintainer Mac | 03:15 local | Checks upstream commits, incrementally refreshes changed RVFs, runs gates, and publishes one synchronized Brain version when warranted |
| End-user Evergreen update | One installed copy of the Brain | Optional macOS LaunchAgent `com.ruvnet.brain-update` | 03:47 local | Downloads and verifies the newest already-published signed bundle; it never builds or publishes |

The author job is **launchd, not cron**. Its installed definition is
`~/Library/LaunchAgents/com.ruvnet.brain-nightly.plist`; the checked-in template is
`deploy/com.ruvnet.brain-nightly.plist`. It runs:

```text
scripts/job-heartbeat.sh com.ruvnet.brain-nightly -- scripts/nightly-wrapper.sh
```

The wrapper has a single-instance lock, records a heartbeat, distills and backs up project memory,
runs the memory/learning/retrieval/key canaries, and then invokes:

```bash
node scripts/self-update.mjs --apply --publish --fresh-window 60
```

If that attempt fails, the wrapper waits three minutes and retries once. A second failure writes
`.ruvnet-brain/nightly-failure.json`, logs the exact failure, and sends the configured urgent
notification. A clean no-op is success and stays quiet.

## What “incremental” means

The job does not rebuild the full corpus every night:

1. Fetch each upstream repository and compare its commit SHA with the last promoted generation.
2. Skip repository stores whose upstream SHA and build fingerprint are unchanged.
3. For a changed repository, walk its current files and compare stable content-addressed chunk IDs
   with the previous corpus ledger.
4. Keep unchanged chunks and vectors, delete departed chunks, and locally embed only new or changed
   chunks with the one canonical BGE-768 model.
5. Build a staged RVF candidate, run structural/retrieval/release gates, and promote only a passing
   candidate.
6. If anything changed, stamp the RVFs, plugin, npm package, and GitHub release with the same
   3.9.x Brain version and advance `releases/latest`.

“Complete Brain” and “RuVector Only” are install profiles over the same release. The canonical
publisher still builds the complete public release once. An installed RuVector-only copy retains
only the RuVector RVF family; fresh installs and Evergreen updates reapply that selection after
verified extraction, so unselected stores do not accumulate again.

Switching back to Complete Brain restores from a local full release when one is available; otherwise
the console invokes the installed signed updater with `--restore-complete`, forcing one verified
release download even when the RuVector store itself is already current.

## Inspect and test it

These are read-only checks:

```bash
plutil -p ~/Library/LaunchAgents/com.ruvnet.brain-nightly.plist
launchctl print "gui/$(id -u)/com.ruvnet.brain-nightly"
tail -100 logs/nightly.log
cat .ruvnet-brain/job-heartbeats/com.ruvnet.brain-nightly.json
```

The exact launch chain has a dry-run mode. It exercises launchd → heartbeat → wrapper → Node →
upstream scan → log without building or publishing:

```bash
NIGHTLY_SMOKE=1 /bin/sh scripts/job-heartbeat.sh \
  com.ruvnet.brain-nightly -- scripts/nightly-wrapper.sh
```

## Why it is local, and the recommended next step

For now, keeping the author publisher as a trusted macOS LaunchAgent is the right choice. It needs
the maintainer’s publishing credentials, the global Ruflo installation, a warmed local embedding
model, and a large mutable RVF workspace. GitHub Actions remains the independent validation plane:
CI, stranger-install matrices, release-surface checks, and stale-artifact alarms.

Moving the canonical build into a normal GitHub-hosted scheduled workflow would trade local
availability for two new failure modes: scheduled workflows can be delayed or dropped during
high-load periods, and a GitHub-hosted job has a six-hour execution limit. A persistent self-hosted
runner on a daily-use Mac is not the answer for a public repository either; GitHub warns that
self-hosted runners for public repositories can be compromised by untrusted pull-request code.

The local job’s real limitation is availability: if the Mac is asleep, off, disconnected, or the
user session is unavailable, the 03:15 author run cannot complete. If that becomes operationally
unacceptable, move this same wrapper to a **dedicated trusted build Mac or VM** with a restricted
service account, encrypted publishing credentials, off-machine logs/alerts, and no untrusted PR
execution. Keep GitHub Actions as the verifier, not the holder of the only canonical mutable RVF
workspace.

Authoritative platform references:

- [GitHub scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub Actions usage limits](https://docs.github.com/en/actions/reference/limits)
- [GitHub security guidance for self-hosted runners](https://docs.github.com/en/actions/reference/security/secure-use#hardening-for-self-hosted-runners)
- [GitHub self-hosted runner responsibilities](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners)

## End-user Evergreen scheduling

Evergreen is off until the user explicitly enables it:

```bash
npx ruvnet-brain --enable-nightly
npx ruvnet-brain --disable-nightly
```

On macOS this manages `~/Library/LaunchAgents/com.ruvnet.brain-update.plist` and runs the signed,
non-publishing updater at 03:47. On Linux, the equivalent cron entry is:

```cron
47 3 * * * cd "$HOME/.cache/ruvnet-brain/kb" && node forge-update.mjs --apply >> update.log 2>&1
```

Windows users should schedule the same `node forge-update.mjs --apply` command with Task Scheduler;
the installer does not silently create a system schedule there.
