---
id: ADR-053
title: Experience-level QA — test the journey a user actually has, on every host, OS, and install path
status: Accepted
date: 2026-07-26
updated: 2026-07-26
authors: [Stuart Kerr, Claude Code]
tags: [qa, testing, experience, cross-platform, codex, agentic-qe, ci]
supersedes: []
relates: [ADR-028, ADR-050, ADR-051]
governs:
  - tests/experience/
  - .github/workflows/ci.yml
  - scripts/qe/
---

# ADR-053: Experience-level QA

**Status**: Accepted (adversarially duel-verified 2026-07-26 — record below)
**Date**: 2026-07-26
**Related**: ADR-028 (test classes), ADR-050 (issue pipeline), ADR-051 (Codex wiring)

## Context — the owner's mandate, verbatim in spirit

Issues #42 and #43 (Henrik Pettersen) were both the same failure at different layers: everything
worked **on the machine that built it** and was dead on the surface a real user touched. #42: the
server shipped, the Codex registration didn't. #43: the registration code shipped, the npm tarball
didn't carry its file. Both passed 1,700 unit tests, because every test exercised the source
checkout. Separately, CI ran red for five days (2026-07-21 → 26) on Windows-only and
fresh-checkout-only failures — meaning the suite was structurally blind to two of the three OSes
and to every machine that is not the author's Mac.

The owner's standing instruction (2026-07-26): *don't just fix the issue — zoom out. The test
surface must be larger, more mature, and aimed at the **experience**: Claude Code and Codex, Mac
and Linux and Windows, every install path a real user takes. Hundreds of people use this; one bad
experience and they delete it.*

This ADR is that zoom-out. ADR-028's five test classes (low/medium/high/numeric/qualitative)
remain the grammar of individual tests; this ADR adds the missing **dimension**: whose machine,
which host, which artifact, which journey.

## Decision

### 1. A checked-in scenario LIST is the unit of coverage — never a Cartesian matrix

v1 proposed a host × OS × artifact × journey matrix. Both duel reviewers killed it independently:
the axes are falsely orthogonal (a marketplace clone is a Claude-only artifact; `--update` is a
transition, not an artifact), so the product manufactures ~100 incoherent cells whose bulk-labeling
as `manual` makes the report permanently green — the matrix Goodharts itself in one move. Instead:
`tests/experience/scenarios.json` is an explicit, hand-written list of the ~20 coherent scenarios,
each one record: {host, os, artifact, stage, user-state, classification, evidence, owner}. The
report fails on any coherent scenario left unclassified AND on `manual` exceeding 20% of the list.
`manual` requires a named owner and sits OUTSIDE the coverage denominator; wherever a machine can
reach the surface, the classification is `scheduled-live-probe`, not `manual`.

Two axes v1 lacked, now required on every scenario:
- **user-state**: fresh home · POPULATED home (the user's own config.toml with comments/CRLF/their
  own `mcp_servers`; foreign hooks in settings.json; prior-release on-disk state) · hostile paths
  (spaces, unicode, read-only cache, near-full disk). Hermetic must never mean sterile — the
  clobbered-stranger's-config class only exists in populated homes.
- **recurring use**: "prompt N on day 9" is a stage. The product's highest-frequency touchpoint is
  a hook firing mid-session, and v1's one-time journey stages structurally could not see it.

### 2. The hooks-as-shipped battery — tier one, funded by the cuts below

The single highest user-pain surface. A required CI job (ubuntu + windows) and a release gate:

1. **Invocation fidelity**: every battery case derives from hooks.json ITSELF (an entry with no
   battery case fails the build), runs the literal registered command with `CLAUDE_PLUGIN_ROOT`
   substituted to the PACKED marketplace layout — never the module, never the body directly (the
   adjacent-door defect: today's battery spawns the .sh bodies and skips the shim layer that
   actually runs on strangers' machines).
2. **Four stdin regimes** per hook, under an external process-group watchdog: valid event JSON;
   empty EOF; 1MB garbage; and stdin HELD OPEN past budget — the canonical hang, and the one check
   that catches the /rvbc class pre-ship. In-process timers don't count: a frozen event loop or
   synchronous child defeats them.
3. **Latency budgets far below the timeout**: warm < 500ms, cold < 2s, p95 of 100 repeated firings
   < 500ms. A budget AT the timeout detects nothing until users already eat it per prompt.
4. **Broken-world sweep**: no cache dir · active.json → missing generation · truncated
   active.json · node_modules absent · read-only cache. Advisory hooks: exit 0, silent. Blocking
   hooks: only their documented exit codes — never a stack trace on a stranger's screen.
5. **Stream discipline**: stdout ≤ 4KB (it lands in the user's context window), stderr whitelisted.
6. **Static lint**: every entry carries an explicit timeout (three unprompted-speech entries
   shipped WITHOUT one — found live by this duel, fixed in the same commit); prompt-path events
   cap at 5s; the blocking set matches ADR-023's table exactly.
7. **Process-tree hygiene**: SIGTERM the parent at budget → zero surviving descendants.
8. **Coexistence**: run inside merged user+project+plugin registries carrying sentinel foreign
   hooks (slow, failing, garbage-printing, before AND after ours); against a no-plugin baseline,
   prove every sentinel still fires exactly once, unrelated config stays byte-equivalent, and our
   contribution stays inside its documented latency/output. Double-install never duplicates.
9. **Update-while-firing**: flip active.json mid-battery; every invocation still lands in budget —
   the ADR-023 stable-spine claim becomes a measurement instead of an assertion.

### 3. Artifact-first, extended to PUBLISHED bytes

`npm pack` on the checkout proved unable to represent registry reality (prepack/publish-env/
dist-tag/propagation). The ship flow becomes: publish to a **candidate dist-tag** → clean-container
install of that exact integrity on all three OSes → doctor + Codex wire + MCP round trip + one
grounded answer → only then promote the SAME integrity to `latest`. A scheduled live probe re-runs
the install nightly and files an issue on failure, so "walk every channel" has a machine, not a
memory.

### 4. Gate C++ v2 — exact SHA, every required workflow

v1's gate read the LATEST completed run of ci.yml only: it verified the parent commit, not the one
shipping, and was blind to integration-linux — re-opening the 5-day hole one release at a time.
v2: push the release commit, capture its SHA, WAIT for every required workflow on that exact SHA,
refuse on missing/skipped/cancelled/stale; authenticated API (rate-limit 403s otherwise train the
override into muscle memory); `--ci-override` reasons go into the release LOG and a required line
in the next release's notes — a printed-once diagnostic nobody reads is the ADR-050 failure shape.

### 5. agentic-qe: on-demand generator only — off the critical path

Both reviewers, independently: deterministic artifact/hook/update/exact-SHA gates come first, and
must demonstrate they fail on seeded defects before any fleet output is trusted. aqe drafts
scenarios on demand under the standing budget cap; the quarterly HTSM ritual is cut (this repo's
own record: unowned periodic ceremonies do not fire).

### 6. Cuts (funding the above)

DDD aggregates/domain events/anti-corruption ceremony → one sentence survives: journey tests speak
only through public faces (CLI, doctor output, MCP protocol, user-visible files). The universal
<90s CI budget → split: fast PR suite (cached) vs uncached release-qualification lane; the
first-grounded-answer scenario is honestly `scheduled-live-probe` until a cached-bundle CI lane
exists, and the gate watches whatever lane carries it.

## Rollout (converged ranked order — user-pain-avoided, both lists merged)

1. hooks.json lint: explicit timeout everywhere, 5s prompt-path cap (**shipped with this ADR**).
2. Hook battery v2, shim-level, four stdin regimes + watchdog (kills the every-prompt-hang class).
3. Gate C++ v2: exact-SHA, all required workflows.
4. Candidate-dist-tag publish flow + post-publish live probe.
5. Codex merge on POPULATED config.toml (foreign servers, comments, CRLF, unicode) — byte-diff.
6. MCP stdio round trip from the unpacked tarball on all three OSes.
7. Real-Windows checkout journey (`core.autocrlf=true` — the default CI currently disables).
8. Upgrade-from-real-prior-release (seed N−2 state, run --update, assert Codex server copy refreshes).
9. Update-while-firing concurrency probe.
10. Hostile-home journeys (spaces/unicode/read-only/ENOSPC) — degrade with one clear message, zero hook errors.

## Consequences

- Ship time: PR suite stays fast; release qualification gets its own uncached lane.
- Windows/ubuntu first-class; macOS gets a mechanical verdict via the release-qualification lane
  rather than trusting one developer laptop.
- Node floor: CI must pin the OLDEST engines-promised runtime (>=18) in at least one lane, or the
  engines field must be raised honestly.

## Adversarial duel record (2026-07-26, per the standing order)

Fable 5 (fresh context, no authorship bias) and GPT-5.6-Sol (codex exec, read-only) attacked v1
independently with identical briefs. **Convergent verdicts, reached separately:** (1) the matrix
cannot see the hook/recurring-use class — the product's worst live failure mode; (2) three shipped
hooks lacked timeouts at that moment (both found it; fixed same-commit); (3) gate C++ v1 verified
the wrong commit and the wrong workflow set; (4) locally-packed bytes ≠ published bytes; (5)
hermetic-turned-sterile — no populated-home/coexistence axis; (6) cut the DDD ceremony, the
quarterly fleet ritual, `manual`-as-coverage, and the Cartesian matrix. Notable singles: Fable —
CRLF (CI tests a Windows no user has), npx-cache eviction leaving a frozen Codex server copy,
GitHub rate-limit on the unauthenticated gate; GPT-5.6 — candidate-dist-tag promotion flow,
process-group watchdog over in-process timers, p95/p99 latency canary. Where they differed on
budgets (500ms vs 1s prompt-path), the stricter number won. v1's matrix section is superseded by
§1 above; everything else in v1 stands.
