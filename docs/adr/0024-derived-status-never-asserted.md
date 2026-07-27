---
id: ADR-024
title: Derived status, never asserted — faking is structurally impossible, enforced by a self-proving gate
status: Accepted
date: 2026-07-18
authors: [Stuart Kerr, Claude Code]
tags: [honesty, jobs, receipts, anti-faking, gates, launchd, alerting]
supersedes: []
relates: [ADR-020, ADR-022]
updated: 2026-07-23
updated_source: derived-from-git
---

**Status**: Accepted (all fixes applied + run-confirmed; the gate is live in the unit suite)

## Context

Stuart's mandate, verbatim: *"I don't want that word [faking] associated with anything in our
architecture… code that allows it to fake results is toxic and needs to be blown out of the system —
definitively, once and for all."* The trigger was a wave of scheduled-job failures on top of a history
of one real fabrication (issue-fix.mjs once hardcoded `status:'completed'` with no artifact).

A three-model deep audit (Opus 4.8 exhaustive read → Fable 5 verification → GPT-5.6 Sol adversarial
cross-check) found **20 findings** across the job fleet — not one of them the old hardcoded-status sin
(that fix held), but a systemic sibling class: **terminal success reported without verifying the thing
that makes it true.** Highlights (file:line-verified, all fixed):

- **F5** issue-watch stamped `lastAlertAt` whether the SLA page delivered or not → a failed page was
  suppressed for the whole cooldown, forever repeating. **F1** the watchdog did the same for
  transition pages. **F10a** api-spend-watchdog stamped its cooldown *before* attempting delivery.
- **F4** self-update treated an unreachable GitHub as "up-to-date" → a network-dark nightly logged
  "CLEAN NO-OP". **F10b** the burst detector reported "healthy" with zero readable directories.
- **F6** nightly-gists' bare `wait` (always exit 0 under POSIX) made failed embed shards invisible.
- **F7** refresh-models' `--write` path returned 0 *and wrote a success heartbeat* regardless of its
  own `anyError` flag. **F9** issue-fix exited 0 even when every attempt failed (its state file was
  honest; its exit code wasn't). **F3** a lock-skip overwrote a live run's receipt with `ok/0s`.
- Plus: F13 a registry describing work a `--dry-run` plist never does; F14 a learning queue deleted
  after feeding nothing; F15 success prose printed over failed operations; F2 loaded-but-unregistered
  jobs; scheduling: issue-fix ran 13 min on a 10-min interval (SIGTERM overlap = the failure flood).

## The law (grounded in rUv's own architecture)

1. **A status must be RE-DERIVED from the verifiable artifact, never read from a self-asserted
   field.** (ruvector proof-gate #506: a structural scan cannot catch a structurally-valid forgery.)
2. **Pin verification to the trusted source, never the self-asserted one.** (ruflo signed-artifact:
   "an attacker controls that field; pinning to it is a no-op.")
3. **If you cannot verify, fail LOUD** — degraded exit codes, kept retry-state, never a quiet green.
4. **Delivery is part of success** for an alerter: a page that never left the building fails the run
   (Sol amendment). Broker-acceptance ≠ subscriber-receipt is a known residual; the mitigation is
   layered escalation (job → heartbeat → watchdog → session banner), not an ack protocol.

## The gate (self-proving, rides CI + release.mjs automatically)

- **Layer 1 — `scripts/status-honesty.mjs`:** lexical scanner over all automation scripts; flags any
  write of a terminal success literal (`status:'completed'`, `state:"ok"`, …) whose statement shows no
  derivation marker (captured exit code, comparison, `SUCCESS_OUTCOMES.has`, …). Deliberately scoped
  to receipt/status tokens — a gate that cries wolf gets disabled.
- **Layer 2 — `tests/unit/derived-status.test.mjs`:** behavioral fixtures that EXECUTE the real
  wrapper (`job-heartbeat.sh` around `exit 7` must record failed/7; a skip must restore, not
  overwrite) and run the scanner against a **known-bad fixture replicating the historical sin** —
  which must FAIL on every run. If the scanner ever goes toothless, the suite goes red. 8/8 proven.
- **Known residual (documented):** a lexical layer can in principle be gamed (computed keys, an
  always-true verifier). Layer 2's execution fixtures plus review of verifier-registry changes are
  the mitigation; Sol's stronger "centralized receipt writer" is the designated next hardening step
  if a bypass is ever found.

## Also decided

- Exit **75** is the reserved skip code fleet-wide: heartbeat restores the prior receipt, launchd sees
  success, the watchdog never counts a skip as proof of a real run.
- issue-fix runs every 30 min (was 10 — shorter than its own 13-min runtime).
- Sol's fail-closed-on-missing-profile recommendation for the gate hooks was **rejected with reason**:
  the profile is the opt-in marker for an optional discipline; fail-closed would block every Bash
  command for every non-opted-in public user. Loud disarm telemetry is the correct fix (F17, follow-up).
