---
id: ADR-051
title: Codex host wiring — register the MCP server at install time, and let the doctor probe it
status: Implemented
date: 2026-07-24
updated: 2026-07-26
authors: [Stuart Kerr, Claude Code]
tags: [codex, mcp, install, doctor, honesty, portability]
supersedes: []
relates: [ADR-023]
governs:
  - bin/install.mjs
  - .codex/config.toml
  - .codex/hooks.json
  - .codex/skills/
---

# ADR-051: Codex host wiring

**Status**: Implemented
**Date**: 2026-07-24
**Related**: ADR-023

## Context

Issue #42 (Henrik Pettersen, observed on 3.9.68-dev / plugin 3.9.70-dev, `npx ruvnet-brain` on
Linux) reported that on a Codex host the brain is **entirely unavailable** — no `search_ruvnet`, no
skills, no commands — while every artifact needed was already shipping. The gap was not a missing
capability; it was a missing *registration*:

- `plugin/mcp/server.mjs` ships and works. `plugin/.mcp.json` declares it — for Claude Code only,
  and cannot be reused verbatim because it depends on `${CLAUDE_PLUGIN_ROOT}`, which Codex does not
  expand.
- `.codex/config.toml` ships with `[shell_environment_policy]` and **no `[mcp_servers.*]` at all**.
- `bin/install.mjs` had 21 `codex` references and every one of them *read* `~/.codex/auth.json` to
  classify the user's subscription for cost-routing. Nothing ever wrote `~/.codex/config.toml`.

The failure was invisible, which is the worse half of it: `--doctor`'s health predicate is
`repos > 0 && reader && mcp`, all three Claude-Code-side facts, so a machine where Codex could reach
nothing still printed "Healthy … Grounding PROVEN" and then "It works in EVERY project".

The same directory carried a second, separate defect: `.codex/hooks.json` shipped
`"/bin/bash \"/Users/<maintainer>/Code/ruvnet-brain/plugin/scripts/version-bump-gate.sh\""` — a
maintainer's absolute path that exists on no other machine, invoking an interpreter that is not a
valid path on native Windows. That is the same failure class as ruvnet/ruflo#2132 and #2721, where a
hardcoded `/bin/bash` in `hooks.json` made every tool call report `hook (failed) exit code 1`.

**Grounding.** The Codex manifest shape below is not invented: it follows rUv's own convention, read
from the local brain corpus at `metaharness/.codex/skills/repo-genome/skill.toml` (the `mcp_tool`
variant) and `metaharness/.codex/skills/example-harness/skill.toml` (the `shell` variant). Across the
corpus those are the only two dispatch types that exist — 24 `mcp_tool`, 2 `shell`.

## Decision

### 1. Install-time registration, not documentation

When a Codex host is present (`~/.codex` exists — the same detection surface the installer's existing
`codexAuth` probe already reads), `wireCodexHost()` registers `[mcp_servers.ruvnet-brain]` in
`~/.codex/config.toml` with `command = "node"` and a single resolved absolute path argument. It runs
in the main install flow next to `wirePlugin()`, wrapped in the same non-fatal `try` every other
wiring step uses: a second host we cannot reach must never break the one we can. A machine with no
`~/.codex` is not a warning — nothing is said and nothing is changed.

### 2. Merge, never clobber

`~/.codex/config.toml` is the *user's* file and already carries their settings (ours ships
`[shell_environment_policy]` plus a `RUFLO_HARNESS_LOOP` var). There is no TOML dependency in this
package and adding one to write six lines is not worth it, so our lines live inside a
comment-delimited managed block:

```toml
# --- ruvnet-brain (managed block, installer-rewritten) ---
[mcp_servers.ruvnet-brain]
command = "node"
args = ["/absolute/path/to/server.mjs"]
# --- end ruvnet-brain ---
```

Three outcomes, and the third is the one that matters:

| Found | Action |
|---|---|
| our markers | rewrite exactly those bytes in place |
| nothing | append the block |
| `[mcp_servers.ruvnet-brain]` **outside** our markers | change nothing, and say so |

The third case is a user's hand-written entry. Their config outranks our convenience, so we report it
and tell them how to hand it over rather than overwriting it. Every byte outside the markers is
preserved, and re-running over our own output reproduces it byte for byte — the merge is a pure
function (`mergeCodexConfig`) precisely so that idempotency is testable without going near a real
`~/.codex`.

### 3. The registered path must outlive the install

`args` gets a **resolved absolute path**, and it may not be the npx checkout: that directory is
ephemeral, and registering it would rot the moment it vanished. The installer already solved this
twice — the spend watchdog and the router tools are copied under `~/.claude` for exactly this reason
("stable path — the npx dir vanishes"). `plugin/mcp/server.mjs` is self-contained (node builtins
only), so it is copied to `~/.claude/ruvnet-brain/mcp/server.mjs` and *that* path is registered. This
also means the wiring does not depend on Claude Code being installed, which matters because the whole
point is Codex-only hosts.

### 4. The doctor probes; it does not assert

`--doctor` gains one line derived entirely from disk, never from the fact that an install once ran:

- **`Codex: wired`** — our entry is in `config.toml` **and** the `server.mjs` it names exists. Both
  halves are required: a registration pointing at a deleted file is worse than no registration,
  because Codex fails at spawn time with nothing to read.
- **`Codex: host detected but NOT wired`** — with which half is missing, and the one command that
  fixes it.
- **`Codex: no host detected`** — dim, informational, no call to action.

And the banner is scoped honestly: when a Codex host is detected but unwired, "It works in EVERY
project" becomes "It works in EVERY project in Claude Code … Codex is NOT wired yet". The original
sentence is a true claim about Claude Code that would be read as a claim about every editor, which is
precisely the invisible gap #42 reported.

### 5. Ship only the manifests that can actually fire

`.codex/skills/<name>/skill.toml` manifests ship for two skills, both with a dispatch verified to
exist:

| Skill | Dispatch | Backend, and how it was verified |
|---|---|---|
| `search-ruvnet` | `mcp_tool` → `ruvnet-brain` / `search_ruvnet` | live `tools/list` round trip against `plugin/mcp/server.mjs`: it serves exactly one tool |
| `savings` | `shell` | `~/.claude/model-router/bin/metaharness-receipts.mjs`, which the installer copies there; `$HOME`-relative, so no developer path is baked in |

`brain-score`, `brain-build` and `brain-prompt` are **deliberately not manifested**. They are agent
prose contracts — a scorecard rubric, a phase-gated build contract, a metaprompting method. They have
no MCP tool (the server serves `search_ruvnet` and nothing else) and no single CLI entrypoint: the
scripts they mention are steps *inside* the contract, not the thing that runs it. Dispatching
`brain-build` at `route-cheap.mjs` would print a routing decision and run no build. Since the grounded
shape offers only `mcp_tool` and `shell`, neither can honestly carry a prose contract, and a manifest
advertising a dispatch that cannot fire is worse than an absent one — it is the product lying about
its own capability. The reasoning ships next to them in `.codex/skills/README.md` so the absence reads
as a decision rather than an oversight.

### 6. The leaked path is removed, not rewritten

`.codex/hooks.json` has **no consumer anywhere in this repo** (every `hooks.json` consumer resolves
`plugin/hooks/hooks.json`), and `version-bump-gate.sh` is a maintainer-only dev convenience for this
repo, documented as such in SECURITY.md. So the entry is removed rather than guessed at, and the file
keeps a `_note` — the same `_note` idiom `plugin/hooks/hooks.json` already uses — recording what was
there, why it could never have run, and the rule for anything added later: resolve the path at install
time, and never name an interpreter by absolute path. Shipping no hook is honest; shipping a hook that
cannot run is not.

## Consequences

**Good.** `search_ruvnet` becomes reachable in Codex, which the reporter correctly identified as the
substantive capability. The doctor can no longer print an unqualified clean bill of health on a
machine where a detected host reaches nothing. The leak class is dead: a repo-wide test walks every
shipped file under `.codex/` and `plugin/` and fails on any `/Users/<account>/` path, so it fails on
reintroduction rather than on a reporter noticing — and it is proven against the exact line that
shipped in 3.9.70-dev, not merely against a clean tree.

Writing that guard turned up something worth recording: a naive `includes('/Users/')` also flagged
`plugin/scripts/session-start.sh` and `plugin/scripts/learn-capture.sh`. Both are comments — one
*explaining this very bug class*, one illustrating the learner with `cd /Users/me/ClientProject`.
Neither is a leak, and a guard that forbids documenting a defect is a guard that gets deleted. So the
rule flags a concrete home directory and allows a short, explicit placeholder list (`me`, `<maintainer>`,
`<user>`, …); `stuartkerr` is not on it.

**Costs, honestly.** `server.mjs` now exists at two paths, so the registered copy can drift from the
plugin's. The drift is bounded by design — the shell is a supervisor whose only job is to proxy to
`~/.cache/ruvnet-brain/kb/forge-mcp-all.mjs`, and its tool schema is the frozen contract (ADR-023),
so the self-updating half is the brain, not the copy. Each reinstall refreshes it. `~/.codex` existing
is treated as "a Codex host", which is a heuristic: a leftover directory would get an entry it never
asked for, inside a clearly marked and removable block.

**Not tested.** No Codex host actually consumed the generated `config.toml` or either manifest —
these were verified as correct TOML with a real, existing dispatch target, not as accepted by Codex
itself. The `savings` shell dispatch was verified only in that its script exists at the stable path on
the development machine.

## Follow-ups

- **A CI guard for the leaked-path class.** The unit test added here (`codex-wiring.test.mjs`) walks
  `.codex/` and `plugin/` for `/Users/<account>/`, which catches it on any run of the suite. Promoting
  it to a dedicated pre-push/CI gate — extended to every shipped surface rather than those two trees,
  and to the other developer-path shapes (`/home/<account>/`, `C:\Users\`) — is the remaining work.
  The placeholder allowlist is the part to watch: it is the one place where a real leak could hide by
  choosing a permitted name.
- Re-verify against a real Codex host and record the round trip, replacing the "not tested" note above
  with a measurement.
- Revisit `brain-score` / `brain-build` / `brain-prompt` if a dispatchable entrypoint ever exists.

## Addendum (2026-07-26) — issue #43: the wiring was dead on every npm install

Henrik Pettersen proved the registration this ADR shipped could never fire on its primary path: the
npm tarball's `files` whitelist excluded `plugin/mcp/server.mjs`, the exact package-relative path
`wireCodexHost()` resolves, so every `npx ruvnet-brain` from the registry hit the `no-source` branch.
It worked only from a repo/marketplace checkout — and every test in `codex-wiring.test.mjs` ran
against the source checkout, the one place the file always exists.

Fixed in 3.9.77-dev, three parts, matching #43's acceptance verbatim:

- `package.json` `files` now ships exactly `plugin/mcp/server.mjs` (plus `!plugin/README.md`, which
  npm's always-include README rule would otherwise drag in). The rest of `plugin/` stays excluded.
- Both writes in `wireCodexHost()` are now atomic (write-beside + `rename()` via `atomicReplace`):
  an interrupted copy can no longer leave a torn `server.mjs` at a path an existing config already
  names, and a failed config write leaves the previous bytes intact. Because `rename()` swaps
  inodes, the helper also resolves symlinks (a dotfiles-managed `config.toml` stays a symlink and
  the bytes land in the dotfiles repo) and re-applies the target's mode (a chmod-600 config never
  comes back 644) — both found by the independent review of this fix, and both now pinned in
  `codex-wiring.test.mjs`. Scope is process interruption, the #43 scenario; power-loss fsync
  durability is deliberately out of scope for a config write.
- `tests/unit/npm-tarball-codex.test.mjs` runs `npm pack`, unpacks the real tarball, and exercises
  the installer FROM THE ARTIFACT with default source resolution — plus an MCP
  `initialize`/`tools/list` round trip against the installed server and two write-failure
  injections that demonstrably fail on the pre-fix code. The gate can no longer borrow files from
  the checkout.
