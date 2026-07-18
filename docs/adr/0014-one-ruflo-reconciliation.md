---
id: ADR-014
title: The One-Ruflo Reconciliation — target architecture for the whole machine, and the phased plan to get there
status: Proposed (awaiting Stuart's approval; NOTHING in Phases 1–5 executes without an explicit per-phase go)
date: 2026-07-14
updated: 2026-07-18
authors: [Stuart Kerr, Claude Code]
related: [ADR-0012 (grounding gate), ADR-0013 (onboarding console), ruvnet/ruflo#2677 (doctor existence-only — acknowledged upstream in v3.30.0 release notes, same day)]
---

# ADR-014: The One-Ruflo Reconciliation

**Status**: Proposed
**Date**: 2026-07-14
**Updated**: 2026-07-18

> **2026-07-18 (ISSUE #22)** — A third install mechanism is now recognized: RuvNet tools installed
> via the **Claude Code plugin marketplace** (not `npm install -g`). `stack-sync.mjs` now also scans
> the plugin cache (authoritatively, via `~/.claude/plugins/installed_plugins.json`) so plugin-only
> users get a fully-counted "Your stack" card. See the new row below.

# Context — the 30,000-foot picture, measured, not recalled

One day of forensic work (2026-07-14) established, with receipts, that this machine's RuvNet stack
is not "broken" — it is **unreconciled**: multiple generations of well-intentioned setup, each
correct in its month, now fight each other. Every number below was measured today.

## What is actually on the machine

| Layer | Measured state |
|---|---|
| **Packages (npm global)** | ONE global install per package (ruvector 0.2.34 = latest; ruflo 3.28.0 vs registry **3.30.1** — rUv shipped 3× today). `stack-sync.mjs` built as the single auditor/updater (uncommitted). |
| **Plugins (Claude Code marketplace)** | A THIRD install mechanism (ISSUE #22): rUv tools installed through the plugin marketplace (`ruflo`, `ruview`, `ruvnet-brain`, `cognitum`), NOT `npm install -g`. These track **their marketplace's own update cadence, separate from npm semver** — there is no npm dist-tag to compare against, so stack-sync reports them present/CURRENT and never nags them as "behind". `stack-sync.mjs` now scans the plugin cache via `installed_plugins.json` (source-tagged `source:'plugin'`), so a plugin-only user is no longer reported with an undercounted stack. |
| **npx producers** | **FIVE families** across ~54 projects: `@claude-flow/cli@latest` hooks · `claude-flow@alpha` hooks (old name) · `npx ruvector` hooks · `npx ruflo` hooks · **12 live `.mcp.json` files launching a second MCP server via `npx -y ruflo@latest`**. Only family 1 was migrated (7 projects). |
| **Duplicate ruflo, proven** | Sessions in those 12 projects run **TWO full ruflo MCP servers at once** (ps receipt: `~/.npm-global/bin/ruflo mcp` AND `npm exec ruflo@latest mcp start`, same session). |
| **The planter** | `ruflo init --force` — rUv's own current tool — **writes the npx `.mcp.json` form** (XrAy-I rewritten today 15:05 by init itself). Hand-fixing the 12 files without an upstream fix regresses on the next init. |
| **Hooks** | 393 total (16 global + 377 project). Global verdicts from today's line-by-line audit: keep 9 · delete 2 (`cf-routing-directive` superseded by the brain, `ruflo-upgrade-awareness` carries the `!=` downgrade bug) · trim 1 (`architecture-reminder`) · move 2 (`kling-preflight` → Kling skill; `version-bump-gate` → this repo only) · rewrite 1 (`config-aware-hook`). `adr-qa-auto` stays global (self-scoping; live in 7 projects). |
| **Memory stores** | 84 (81 under ~/Code at depth ≤4 + 3 outside). Three populations: **A born-new/healthy** (all 10 most-recently-committed projects) · **B legacy, text intact in the old `value` column** (AI Retirement Analyzer 7,198 · Red Clover Inn 6,358 · SkillNet-GE 7,990 · ruvvectortest/vince 2,257) · **C migrated-by-us, text only in `memory.db.pre-agentdb-KEEP` backups** (8 projects incl. flighttest 19,060, AMBUILANCE 11,130). Nothing permanently lost. |
| **Learning layers** | Storage engine HEALTHY (native better-sqlite3+WAL everywhere; `isWasm=false` proven; the "sql.js" stats label is a hardcoded lie). Intelligence DISCONNECTED: 7,396 episodes · **0 critiques · 0 episode_embeddings · 0 skills · 0/60 stores can retrieve an episode** (ReflexionMemory's INNER JOIN on an empty table). Upstream issue #2677 filed; acknowledged in v3.30.0 notes. |
| **Data-loss mechanism, proven** | `cp` on a live WAL database silently drops the unflushed tail (4,000→3,967 rows, `integrity_check: ok`). Our fleet migration and backups used `cp` all day. rUv ships `ruflo memory backup` ("WAL-safe") — never used. |
| **Corruption cause** | **UNKNOWN.** Three theories (mixed engines, WAL-sidecar poison, concurrent writers) disproven by experiment today. Do not assert; monitor. |
| **Instrumentation** | `npx-witness` LIVE (launchd WatchPaths on `~/.npm/_npx`, heartbeat-proven). On its first firing it caught the MCP family no grep had found. `memory-doctor.mjs` + `npx-census.mjs` built (census has a known section-labeling bug; 36 files UNPARSEABLE — unknown, not clean). |
| **Old updaters** | Hourly downgrader disarmed (plist renamed). Two dormant orphan scripts on disk (`~/.update-tools.sh`, `~/.local/bin/ruv-nightly-update.sh`). Nightly `ruvnet-autoupdate.sh` still the active updater — to be replaced by stack-sync. |

## The discipline this plan is built on (learned the expensive way, today)

1. **Enumerate by MECHANISM, never by instance.** A check built from what you found only confirms what you found. (Five families; one grep.)
2. **Instrument the choke point instead of hunting callers.** You cannot enumerate the callers of a thing; you can always instrument the thing. (The witness caught family five in one firing.)
3. **Verify by EFFECT, after the producer's window — and break-test every check.** UNKNOWN is never PASS. A recurring problem is not "fixed" at T+0; it is fixed when the effect stays absent across the trigger's real cycle.
4. **Never delete what you haven't traced. Never `cp` a live database. One writer per concern.**

These live as AgentDB standing lessons (`lesson-verify-by-mechanism-not-instance`,
`lesson-never-cp-a-live-database`) surfaced at every session start, and in harness memory.

---

# The North Star — what "done" looks like (Stuart's spec, formalized)

> ONE global Ruflo. A project initializes ONCE, from the global instance, and that init stands up
> AgentDB with EVERYTHING on — all six layers — and nothing on the machine fights it.

| Layer | Target |
|---|---|
| **L0 Packages** | One global copy per package. Updated by ONE nightly job (`stack-sync`): single semver comparator, tag policy, never pins, never downgrades (structurally), verifies against disk, fails loud, lock-guarded. npx never used for rUv packages — and the witness proves it stays that way. |
| **L1 MCP** | Every scope launches ruflo MCP from the **global binary** (`~/.npm-global/bin/ruflo mcp`). Zero `npx`-launched MCP servers. **One** ruflo server per session, ever. |
| **L2 Hooks** | A hook lives in the narrowest scope where it is true. Project hooks = the local-helper form (no npx, no cold processes). Global = only the 9 universally-true hooks. Dead hooks deleted. |
| **L3 Memory** | One `.swarm/memory.db` per project. All writes via ruflo. Backups ONLY via WAL-safe tooling. Populations B and C restored to full text. 100% content, ≥95% embedded, distilled. |
| **L4 Learning — the six layers, all on** | (1) Content (2) Recall/embeddings (3) Distillation (ADR-174 running with real material) (4) **Lessons** — episodes written through `ReflexionMemory.storeEpisode()` with critique/reward/success (5) **Skills** — promotion from repeated success (6) **Continuity** — the next session provably surfaces checkpoint + lessons after compaction. |
| **L5 Verification** | The doctor tests FUNCTION, not existence (the #2677 eight checks), locally via `memory-doctor` until upstream ships it. Every check has a demonstrable red state. Witness + heartbeats always on; a quiet instrument is itself an alarm. |

---

# The phases — each gated on Stuart's explicit GO; each exits only on effect-verified evidence

## Phase 0 — Finish the research (READ-ONLY; no changes of any kind)
Remaining unknowns, each with the exact question:
- **P0.1** Does **v3.30.1** `init` still write the npx `.mcp.json`? (Read its dist template *before* upgrading; if fixed, Phase 2's MCP fix = "re-run init"; if not, file the upstream issue with today's XrAy-I evidence and overwrite locally with a guard note.)
- **P0.2** Did v3.30.x change `doctor --component memory` (the #2677 acknowledgment — fix or nod?).
- **P0.3** Fix the census section-labeling bug; re-run; resolve the **36 UNPARSEABLE** files by hand; confirm the worklist is complete against witness observations.
- **P0.4** Enumerate every `~/.claude.json` per-project `mcpServers` entry (all keys, not samples).
- **P0.5** The supported path to (re-)embed restored memories (B/C populations) — read the binary, not docs.
- **P0.6** Corruption watch: define the open-holder witness (log every process that opens a `.swarm/memory.db` for write) so the next corruption event carries its own evidence instead of a theory.
**Exit gate:** every question answered in writing in this ADR (Updated stamp), reviewed by Stuart.

## Phase 1 — Controlled upgrade + upstream filings (small, reversible)
- Upgrade ruflo/@claude-flow/cli 3.28.0 → 3.30.1 via **stack-sync only** (the one updater), after P0.1/P0.2.
- File upstream: (a) init-writes-npx-MCP (with the 15:05 XrAy-I receipt + dual-server ps proof), (b) the `#2448` regex gap, (c) the "sql.js" label lie — each with repro + proposed fix, in rUv's own code shapes.
**Exit gate:** doctor green post-upgrade; witness shows no new shadows from the upgrade itself.

## Phase 2 — Producer reconciliation, ONE pass, from the completed census
- All remaining npx hook families (2–5) + the 12 `.mcp.json` files + allowlist trims + the global-hook verdicts (delete 2 / trim 1 / move 2 / rewrite 1) + delete the two dormant updater scripts + retire `ruvnet-autoupdate.sh` in favor of stack-sync nightly.
- Method per project: backup → change → JSON-validate → auto-rollback guard (glob-normalized permission compare — the corrected one) → doctor.
**Exit gate (the recurrence rule):** witness log shows **zero rUv-family npx events across ≥72 hours of real sessions**, including session-start in every fixed project. Not "the files changed" — the effect.

## Phase 3 — Memory restoration (B, then C)
- B (text in place): `content = value` in place, per store, via WAL-safe snapshot first. C (text in backups): re-join from `pre-agentdb-KEEP` by key. **Never `cp` a live file.**
- Re-embed restored rows (per P0.5), then `memory distill run --since 0`.
**Exit gate:** memory-doctor per store: content ≥95% · embedded ≥95% · patterns in the ADR-174 band · **functional paraphrase recall passes** — and a break-test proving the doctor can fail.

## Phase 4 — Learning ON (the six layers)
- Wire episode writing **through** `ReflexionMemory.storeEpisode()` with real critique/reward/success (upstream if #2677 lands it; otherwise a thin, disclosed wrapper over the real controller — never a look-alike).
- Wire reading: session start consults `getCritiqueSummary()` for the task at hand; skills promote on repeated success; continuity check added to the doctor.
**Exit gate:** on a pilot project: a lesson written in session N is retrieved and *cited* in session N+1 after a real compaction; ≥1 skill promoted from real history; every new check break-tested red→green.

## Phase 5 — Bake-in and guardianship
- Commit everything with a version bump (the repo's own gate enforces it). Witness "eyes" line in session-start. Nightly = stack-sync + memory-doctor + backup (WAL-safe), all heartbeat-proven, all surfaced by the watchdog.
- ADR-0013's console then has real, honest data sources for every section.
**Exit gate:** one full week where every scheduled job proves it ran, the witness stays quiet on rUv npx, and the doctor stays green — the machine rowing in one direction, visibly.

---

# What will NOT happen, at any phase
- No deletion of anything whose producer isn't named in this document or the witness log.
- No "fixed" claim before the exit gate of the phase it belongs to.
- No new tooling where a verified rUv tool exists (checked against the installed binary, never a SKILL.md).
- No sudo, no keychain, no system mutation without an explicit ask.
- No `cp` of any live database, ever again.
