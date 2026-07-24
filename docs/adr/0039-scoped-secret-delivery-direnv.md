---
id: ADR-039
title: Scoped secret delivery — keep the SOPS single source, stop exporting 66 credentials into every process
status: Accepted
date: 2026-07-23
authors: [Stuart Kerr, Claude Code]
tags: [security, secrets, direnv, sops, blast-radius, machine-config]
supersedes: []
relates: [ADR-038]
updated: 2026-07-24
---

**Status**: Implemented (2026-07-23)

**Phases 1 AND 2 DONE and verified 2026-07-23.** Phase 1: direnv 2.37.1 installed, `use_secrets` helper in `~/.config/direnv/direnvrc`, hook added to `~/.zshrc`. Phase 2: `~/Code/.envrc` safety net created + allowed (sources the master, holds NO secret values), and the global `set -a` export in `~/.zshrc` commented out. Verified empirically (values never printed): keys ARE delivered anywhere under `~/Code` (net loads), a project under `~/Code` (ruvnet-brain) still inherits them (nothing breaks), and a shell OUTSIDE `~/Code` now inherits NONE (the blast-radius reduction). `zsh -n` clean; direnv output quieted via `DIRENV_LOG_FORMAT`. Fully reversible: restore `~/.zshrc.bak-20260723-migration` + `brew uninstall direnv` + `rm ~/Code/.envrc ~/.config/direnv/direnvrc`. **Behavior change (intended):** a shell opened outside `~/Code` (e.g. in `~`) has no credentials until you `cd` into a project; that is the point. Per-project tightening (a project's own scoped `.envrc` overriding the `~/Code` net) remains optional future polish — nothing breaks without it.

## Context

`~/.zshrc:106-109` runs `set -a; source ~/Code/openclaw-stack/secrets.env; set +a`, which exports all
**66** credentials into every interactive shell and therefore every child process — including every
`npx`/`node` invocation. This is the single largest blast-radius finding adjacent to the ADR-038 audit:
any third-party tool the owner runs on their own machine inherits all 66 keys and could read them.

Two things are NOT the problem and were verified, so we do not touch them:
- **The single source of truth is good.** `secrets.env.enc` (SOPS/age) decrypts to one `secrets.env`;
  rotate once, everyone sees it. That is the evergreen design the owner wanted. Keep it.
- **This is not an outbound leak.** Env vars never leave the machine; the owner's published packages ship
  zero secrets (verified). The exposure is local inheritance only.

The 99 project `.env` files across `~/Code` are **independent** of this global export — each app loads its
own `.env` through its own framework (dotenv/vite). So changing the delivery mechanism cannot break them,
and `direnv`'s file is `.envrc`, a *different name* from `.env`, so nothing is ever overwritten.

## Decision

Deliver secrets **scoped per directory** with `direnv`, keeping SOPS as the source of truth. Each project
declares the master keys it actually needs; direnv loads only those, only while you are in that directory,
and unloads them on exit. A random `npx` outside a project dir inherits nothing.

Mechanism:
- `~/.config/direnv/direnvrc` defines `use_secrets KEY1 KEY2 …` — a thin glue function (standard direnvrc
  usage, not a reinvention of any tool) that extracts exactly the named keys from the master `secrets.env`
  and exports only those. Missing keys are logged, never fatal.
- A project's `.envrc`: `dotenv_if_exists` (load its own `.env` unchanged) + `use_secrets …` (its master
  subset). `direnv allow` is required per file, so nothing runs without explicit opt-in.
- The master stays the one `secrets.env`; `use_secrets` reads it. (A later enhancement can decrypt
  on-demand via `sops exec-env` to drop the standing plaintext file — deferred to keep Phase 1 faithful.)

Why direnv over alternatives (researched, ADR-038 §recommendation): `sops exec-env` alone (Option B) is
higher-friction per-command and doesn't populate interactive shells; 1Password `op run` (Option C) is the
strongest ceiling but needs a vault migration and `op` is not even signed in. direnv is the least-disruptive
change that achieves scoped delivery while preserving the existing SOPS chain.

## Phased, reversible rollout (non-destructive by construction)

1. **Phase 1 (now):** `cp ~/.zshrc ~/.zshrc.bak-<date>`; install direnv; add its hook; create the
   `use_secrets` helper; prove it loads a scoped subset in a clean (`env -i`) shell. **The global export
   stays in place** — so every shell still gets all 66 during transition; zero risk of a project losing a
   key. No `.env` file is touched at any step.
2. **Phase 2 (after the owner confirms nothing broke):** add per-project `.envrc`s, then narrow the global
   `set -a` block to a tiny always-needed core (or remove it). Only here does the blast radius actually drop.

Every step reverts by restoring the `.zshrc` backup and `brew uninstall direnv`.

## Consequences

### Positive
- A tool run outside a project directory inherits no credentials.
- Single source of truth preserved; no new copies, nothing goes stale.
- Fully reversible; Phase 1 cannot break a project because the global export is retained.

### Negative
- A small `.envrc` per project that needs master keys (one-time, one or two lines each).
- direnv becomes a dependency of the shell environment.

### Neutral
- DDD was intentionally skipped: a shell-config change has no domain model. Validation is empirical
  (does the shell still work; do CLI tools still see their keys), not a pass count.

## Not in scope
- The 99 duplicated project `.env` files (the real "stale copies" sprawl) — a separate, larger effort;
  those apps work today via their own `.env`, so it is not urgent.
- Migrating secrets into 1Password (Option C) — a future option if audit-log/vault-rotation is wanted.
