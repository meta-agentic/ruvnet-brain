---
id: ADR-026
title: Meta LLM Proxy passthrough trial — make MetaHarness genuinely automatic, per-session and reversible
status: Proposed
date: 2026-07-19
updated: 2026-07-19
authors: [Stuart Kerr, Claude Code]
tags: [metaharness, meta-proxy, ruflo, routing, cost, trial]
supersedes: []
relates: [ADR-0024]
---

**Status**: Proposed (trial on branch `feat/meta-proxy-passthrough`)

## Context

"Is MetaHarness on?" had been answered "generally on," which was wrong. Measured live on
2026-07-19 before any change:

```
ruflo proxy status --json  ->  { "installed": false, "running": false }
port 11435                 ->  nothing listening
ANTHROPIC_BASE_URL         ->  UNSET (0 occurrences in ~/.claude/settings.json)
```

Zero turns had ever been intercepted. The scoring tools (`metaharness_score`, `oia_audit`, …)
were installed and working, but they are **on-demand**: they grade an artifact you point them
at and never observe a turn. The automatic layer — rUv's Meta LLM Proxy (ADR-304/307/313) —
was simply absent.

**Two things share the name "MetaHarness" and conflating them is what produced the wrong
answer.** Kept separate here permanently:

| | What it is | Automatic? |
|---|---|---|
| Scoring/audit MCP tools | grade an artifact on request | No — invoked by hand |
| Meta LLM Proxy | local binary intercepting every request | Yes — this ADR |

## Decision

Trial the proxy on the **Passthrough plane only**, wired **per session**, with a tested revert.

1. **Passthrough plane only.** The proxy reads `~/.claude/.credentials.json` (read-only) and
   forwards to real `api.anthropic.com` with the actual OAuth token. Stuart's subscription
   still pays and still answers; capability is unchanged. The cheap-routing planes
   (`cloud`, `sponsored`) stay dark — see Constraints.
2. **Per-session wiring, never global.** `ANTHROPIC_BASE_URL` is exported by
   `scripts/proxy/claude-proxied.sh` for one process. Nothing is written to
   `~/.claude/settings.json`, so every other Claude Code window is unaffected. This is
   asserted as a check, not a promise (`proxy-verify.mjs` check 3).
3. **Verification delegates to rUv's shipped doctor.** `ruflo doctor --component proxy`
   already checks binary signature, version, process liveness via `/status`, and bind
   address (ADR-307). `proxy-verify.mjs` shells out to it and adds only what it does not do:
   a real completion through `/v1/messages` checked against the passthrough oracle, plus the
   trial-safety check above.
4. **Revert is a first-class deliverable**, tested before the happy path is trusted.

### The passthrough oracle

ADR-313's addendum establishes that a genuine Anthropic response carries `service_tier` and
`cache_creation` in `usage`; Cognitum's gateway never returns them. So their presence is
positive proof the request reached real Anthropic rather than being silently served by a
cheap-tier substitute. A silent plane flip is the worst failure mode available here, so it is
detected rather than trusted — and `claude-proxied.sh` refuses to launch if the plane is not
passthrough.

## Upstream bug found (macOS): `ruflo proxy install` is broken for every macOS user

`ruflo proxy install` failed on 3.32.8 (current; not a staleness issue) with:

```
extracted binary path failed validation: Path is outside allowed directories
```

Root cause, read from source and then proven by experiment — `@claude-flow/security`'s
`PathValidator` is inconsistent about symlinks:

| `path-validator.ts` | behaviour | result on macOS |
|---|---|---|
| 177–178 | allowed prefixes → `path.resolve()` only | `/var/folders/…/extracted` |
| 229, 234 | candidate → `path.resolve()` **then `fs.realpath()`** | `/private/var/folders/…/meta-proxy` |
| 262 | `resolvedPath.startsWith(prefix + sep)` | **false, always** |

`os.tmpdir()` on macOS is `/var/folders/…`, a symlink to `/private/var/folders/…`. The
candidate is canonicalized through it; the prefix is not. The check can never pass.

**Workaround (in `proxy-up.sh`)**: hand the installer an already-canonical `TMPDIR`, making
the validator's own assumption true. Nothing about the download or its verification changes —
Ed25519 signature and sha256 checks run exactly as before. Confirmed: install then succeeded
and reported `signature-verified at install`.

**Upstream fix is one line**: realpath the prefixes too. To be reported to rUv.

## Constraints (why this trial does NOT yet deliver cost savings)

Stated plainly so the trial is not oversold:

- **Cheap routing needs a key that cannot yet be provisioned.** ADR-313's own addendum: *"there
  is no automated way for `ruflo proxy sponsor-enable` to provision a real, per-user, scoped
  `cognitum_api_key` — the field must be populated manually today."*
- **Quota detection is self-reported, not measured.** ADR-312/314 establish by direct inspection
  that Anthropic's rate-limit headers are not exposed to any third-party CLI extension. ruflo
  cannot read "you are at 20%"; a human flips a flag.
- **MetaHarness does not score turns automatically, and this ADR does not make it.** ADR-304
  lists harness-evolution integration as a **future** surface. Building it would be our own
  code, and would be labelled as such — not presented as rUv's shipped behaviour.
- **No reboot survival.** `start --service` is a detached process + PID file; ADR-307
  deliberately defers OS-service registration.
- **It is in the hot path.** If the proxy misbehaves, the proxied session misbehaves. This is
  the reason for per-session wiring rather than global.

## Consequences

- New: `scripts/proxy/{proxy-up.sh, proxy-verify.mjs, proxy-revert.sh, claude-proxied.sh}`.
- The machine gains an installed binary and a running local process. **A git branch does not
  sandbox this** — `git checkout main` does not uninstall it. Reverting is
  `./scripts/proxy/proxy-revert.sh`, which proves removal rather than asserting it.
- Promotion to `main` requires: the trial session demonstrably routing real turns, the revert
  proven, and the upstream macOS bug either fixed upstream or documented in the README.

## Verification (2026-07-19, measured)

- `ruflo doctor --component proxy` → 4 passed: binary v0.4.0 signature-verified, process
  running v0.4.0, `data plane: passthrough:anthropic`, bind loopback-only.
- Live `/v1/messages` round-trip returned `PROXY_OK` with `service_tier=standard` and
  `cache_creation` present → real Anthropic, real subscription.
- Revert cycle exercised end-to-end (see the trial log in the PR description).
