---
id: ADR-0023
title: Intelligent Updating — the Stable Spine (auto-update every piece; restart only for declarations)
status: Accepted
date: 2026-07-18
authors: [Stuart Kerr, Claude Code]
tags: [updating, self-update, plugin, hot-reload, symlink, rollback, mcp, hooks]
relates: [ADR-0020, ADR-0021, ADR-0022]
references: [cognitum-v0-appliance ADR-248 (the house self-update pattern this mirrors)]
---

# ADR-0023 — Intelligent Updating: the Stable Spine

**Status**: Accepted 2026-07-18. Implementation in the same change-set (see `docs/INTELLIGENT-UPDATING.md` for the full mechanism doc, `docs/ddd/0003-update-context.md` for the bounded context).

## Context — the failure this kills

Users (starting with the maintainer, four separate times) are forced to **restart Claude Code to get ANY update** — and are nagged every session until they do. Root cause, verified live on 2026-07-18:

- Claude Code installs each plugin version into a **version-named directory**
  (`~/.claude/plugins/cache/ruvnet-brain/ruvnet-brain/<version>/`) and records that exact path in
  `installed_plugins.json`. The running CC process binds it at boot and never re-reads it.
- Every hook command in `plugin/hooks/hooks.json` uses `${CLAUDE_PLUGIN_ROOT}` — which resolves to
  that frozen dir. So **all behavioral code** (grounding, session-start, route-dispatch, design-wall,
  learn-capture…) is trapped at the boot-time version even though a newer one is fully downloaded
  and sitting on disk. Proof: this session ran 3.4.7-dev while `installed_plugins.json` already
  pointed at 3.4.11-dev.
- Meanwhile ruflo/RuVector *CLIs* update invisibly — because they are **invoked** (fresh exec per
  call), not **loaded** (bound at boot). The distinction between invoked and loaded is the entire
  architecture problem.

## Decision

Split the product into a **boot-frozen shell** (as small as possible, changes ~never) and a
**hot body** (everything else, updatable mid-session), joined by one stable path:

```
~/.cache/ruvnet-brain/
  current  ->  versions/<active-version>/       # THE SPINE: one symlink, atomically flipped
  versions/<v>/                                  # immutable per-version code payloads
  versions/<v-prev>/                             # retained: instant rollback target
  kb/                                            # KB DATA — separate track, never touched by code updates
```

1. **Hook shim (shell)** — `hooks.json` commands change once, forever, to run
   `hook-shim.sh <name>`: a ~15-line `exec` that runs
   `~/.cache/ruvnet-brain/current/plugin/scripts/<name>` when the spine exists, else falls back to
   the sibling in `${CLAUDE_PLUGIN_ROOT}` (first run, spine absent). `exec` preserves exit codes —
   `route-dispatch.sh`'s deliberate exit-2 block still works. From then on, **hook behavior updates
   the moment `current` flips — zero restart.**

2. **Hot-swap MCP proxy (shell)** — `plugin/mcp/server.mjs` is already a stdio proxy to the brain's
   `forge-mcp-all.mjs`. It gains: cache the client's `initialize` request; between requests, check a
   reload stamp (`~/.cache/ruvnet-brain/.reload-stamp`); on change, SIGTERM the child, respawn it on
   the new code/data, replay the handshake, swallow the duplicate response. **Claude Code's
   connection never drops; `search_ruvnet` serves the new brain mid-session.** (Never swap
   mid-request; queue and swap between requests.)

3. **Update engine (body)** — `scripts/update-apply.mjs`, mirroring cognitum-v0-appliance ADR-248's
   proven mechanic: fetch manifest → download → **SHA-256 verify** → unpack to `versions/<v>` →
   **health-gate** (bash -n every hook script, `node --check` every .mjs, one CLI smoke query) →
   **atomic flip** (`ln -s` to temp name + `rename(2)`) → keep previous for `--rollback` → write the
   reload stamp. A failed gate = no flip = users stay on the working version. A failed post-flip
   probe = auto-flip back.

4. **Honest restart contract** — the release manifest carries `requiresRestart: true` **only** when
   boot-frozen declarations changed (hooks.json matchers, skills/commands markdown, MCP tool name,
   the shim/proxy themselves). Everything else updates silently. The every-session restart nag is
   deleted; the only remaining nag is the rare, truthful one.

5. **Install-path agnostic** — npm, npx, git clone, and the CC marketplace all converge on the same
   spine: `bin/install.mjs` and session-start both drive `update-apply.mjs`; a git checkout can
   opt into dev mode (`current` → the checkout) so maintainers are live-on-save.

6. **KB data stays on its own track** — `versions/` holds CODE only. KB stores keep their existing
   update flow (`forge-update.mjs`) including the private-store fence: a code update can never
   strip a user's private stores (the maintainer's machine carries 3).

## Why this holds

- It converts our "loaded" surfaces into "invoked" surfaces wherever the process boundary allows,
  and makes the one truly-resident piece (the MCP child) swappable behind a stable proxy — the same
  reason ruflo's CLI updates live while its MCP needs a restart, solved instead of accepted.
- Every mechanic is the already-proven house pattern (ADR-248: manifest → verify → atomic swap →
  health-gate → retained-prev rollback), applied to a plugin instead of an appliance.
- Failure-safe by construction: verify-before-flip, gate-before-flip, flip is atomic, rollback is a
  symlink away, and a missing spine falls back to the plugin dir (the status quo, never worse).

## Consequences

- Users on any install path get every behavioral/knowledge update **without restarting, without
  knowing** — the "trapped on an old version" class of issue ends.
- `plugin/` (the shell) must now be treated as near-frozen ABI: changes there are rare, flagged
  `requiresRestart`, and get the one honest nag.
- The versioned CC plugin cache stops mattering: whatever stale version CC boots, the first hook
  fire executes `current`. CC's own updater becomes a no-op path for us (kept for marketplace
  hygiene only).
- New failure mode to watch: a broken `current` target. Mitigated by gate-before-flip + auto-
  rollback + shim fallback; `--doctor` reports spine state.

## What this does NOT claim

- Declarations (hooks.json matchers, skill/command markdown, MCP tool *names*) still require a CC
  restart — that is CC's loader, not ours. The manifest flag keeps that honest and rare.
- The MCP child swap serves the NEXT tool call on new code; a call already in flight completes on
  the old child.
