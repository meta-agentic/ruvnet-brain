---
id: ADR-038
title: Corporate-safe posture — verification cannot be downgraded, and captured data cannot carry secrets
status: Accepted
date: 2026-07-22
authors: [Stuart Kerr, Claude Code]
tags: [security, supply-chain, edr, dlp, signing, secrets, corporate]
supersedes: []
relates: [ADR-010, ADR-020, ADR-024]
updated: 2026-07-22
---

**Status**: Accepted (four of five fixes applied and each proven by breaking the guard it protects; the base64 verifier chain is scoped out below and still open)

## Context

RuvNet Brain runs on other people's machines — increasingly on managed corporate laptops with EDR
(CrowdStrike, SentinelOne, Defender) and DLP agents watching. A five-lane audit (network egress,
filesystem mutation, hook data flow, secrets/supply chain, EDR posture) was run on 2026-07-22 against
the shipped surface of both delivery channels: the npm tarball and the plugin-marketplace clone.

The audit's central question was whether the tool leaks user information. **It does not**, and that
part held up under adversarial reading: every hook that sees prompt text uses it only as `grep -q`
input, which produces no output; no prompt fragment is interpolated into a file, a URL, or a log;
telemetry is hard opt-in behind a consent file that must literally contain `yes`, with a payload of
`{event, version, count}`.

But five findings were real, and three of them were security defects rather than cosmetics. Two
shared a specific shape worth naming, because it is the same shape as ADR-024's concern: **a control
that reports success without being able to observe failure.**

## Decision

### 1. Bundle signature verification fails closed (was: downgradeable)

`SIGNING_REQUIRED` was `false` — transitional, for releases that predated signing. That transition
ended: every release from v2.0.0 on carries a valid detached Ed25519 `.sig`, including the pinned
offline fallback. Leaving the flag false left a live downgrade path: strip or 404 the small `.sig`
file and the missing-signature branch printed a warning and extracted 840 MB of executable `.mjs`
anyway. No alarm fired, because no signature was ever obtained — the failure was indistinguishable
from the ordinary "this release isn't signed yet" case the branch was written for.

Compounding it, the `.sig` fetch swallowed its error (`catch { /* no published sig yet */ }`), so
"genuinely unsigned" and "someone removed the signature" collapsed into the same silent state.

**Now:** `SIGNING_REQUIRED = true`; a missing signature dies exactly as an invalid one does; the
fetch error is captured and reported. `--no-verify` remains the single explicit, user-chosen
override.

**Coupling created, stated on purpose:** installs now depend on every published release carrying a
`.sig`. A release that ships unsigned will hard-fail new installs. That is the correct trade — but
it makes release signing load-bearing, not best-effort.

### 2. Captured workflow data carries verbs, never arguments

`learn-capture.sh` recorded the first 120 characters of every Bash command to disk and fed it to the
global learner. Its own comment claimed "verb, not facts". That was false, and provably so: the
truncation stopped at the first embedded *quote*, which protects quoted commands and does nothing
for unquoted inline secrets. Verified by execution — `export AWS_SECRET_ACCESS_KEY=… && psql
postgres://admin:…@db.internal/prod` landed verbatim in `session-*.jsonl`, mode `0644`.

On a corporate laptop the internal hostnames alone are a DLP finding; the credentials are worse.

**Now:** at most the first two tokens, stopping at the first token that carries data rather than
intent (contains `=`, `/`, `@`, `:`, is a flag, or is improbably long). Queue is `0600` inside a
`0700` directory. `export FOO=secret` records `export`; `cd /…/ClientProject` records `cd`;
`git push` survives intact. The learner only ever needed the verb.

### 3. The pre-push secret gate scans the push range, not the index

The gate scanned `git diff --cached HEAD` — the staged index. A push ships *commits*, and at push
time the index is normally clean, so the scan read nothing. Proven both directions in a scratch
repo: a key **committed** then pushed sailed through; the same key merely **staged** was blocked.

The gate could only catch the case that never happens. This is the same defect class that `7e715bb`
fixed in the *test* — a check that cannot fail in the situation it was written for — which survived
here in the *scan*.

**Now:** reads the actual push range from the hook's stdin, with the staged index retained as an
additional scope. Re-proven both directions: committed key blocked, clean commit pushes.

### 4. Nothing personal ships, and no claim overstates or understates the posture

- An hourly background job read `~/Code/<another project>/.env` as a config fallback. It bought
  nothing on any machine but the author's, and "hourly job reads another project's `.env` and POSTs
  to an anonymous relay" is a sentence no security review survives. Removed.
- The npm `files[]` shipped `config/` wholesale, carrying a personal 15-job scheduling registry
  (including an npm-token-renewal job) to every user. Narrowed to `config/model-router/`.
- A hook hardcoded the maintainer's absolute home path. Now resolved relatively.
- The session-start message told users the bundle "isn't cryptographically signed yet" when signing
  had shipped and verifies fail-closed. Understating your own security is the same category of false
  statement as overstating it, and it withheld a real safety property from the user's mental model.
  Corrected.

## Consequences

### Positive
- The strongest security property (verify-before-extract) can no longer be turned off by an attacker
  who controls one small file.
- At-rest DLP surface on the user's disk is reduced to command verbs.
- The secret gate can now fail on the input it exists to catch — provable by breaking it.
- The shipped package no longer discloses the maintainer's infrastructure or directory layout.

### Negative
- Release signing is now load-bearing: an unsigned release breaks new installs.
- Verb-only capture loses argument-level signal the learner previously had. Accepted — that signal
  was never worth a credential.

### Neutral
- Every fix was proven by breaking the guard it protects, not by observing a passing suite.

## Not fixed here (tracked, deliberately out of scope)

- `bin/install.mjs` still base64-decodes an embedded verifier, writes it, and dynamically imports it
  — the canonical staged-payload signature to an EDR, though entirely benign. `scripts/embed-verifier.mjs`
  documents a real reason for it, and the decoded blob is byte-identical to `kb/verify-citation.mjs`.
  Shipping it as a file and copying it is viable and removes the decode step; it touches a drift test.
- `hooks.json` wraps `lesson-hooks.sh` in `|| true`, swallowing its `exit 2`. Fails toward allow, so
  it is safe — but an opted-in blocking lesson silently never blocks.
- `SECURITY.md` documents 8 of the 11 registered hooks.
- Both LaunchAgent plists invoke `/bin/sh -c`; launchd can run the binary directly.
- The 6-hour version check has no jitter, which reads as beacon-shaped.
- The plugin marketplace channel clones the whole repo (~63 MB), far more than the plugin needs.

## Out of the repo's control, but material

The maintainer's shell exports ~50 credentials globally (`set -a; source secrets.env; set +a`), so
every child process — including unpinned `npx -y` invocations — inherits all of them. The file itself
is correctly `0600`, and the Claude Code shell snapshots carry no values. The exposure is inheritance,
not file permissions. Per-project secret loading would shrink the blast radius of every supply-chain
risk listed above.
