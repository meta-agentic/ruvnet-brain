# DDD-0003 — The Updating bounded context

Updated: 2026-07-18 11:25:00 EDT | Version 1.0.0
Created: 2026-07-18 11:25:00 EDT
Governs: ADR-023 (Intelligent Updating — Stable Spine) · Mechanism doc: `docs/INTELLIGENT-UPDATING.md`

## Why a bounded context at all

Updating was smeared across five places with five vocabularies (installer "fresh install", KB
"forge-update", plugin "marketplace update", session-start "staged download + nag", nightly
"launchd job") — and their disagreements produced real failures: the restart-nag loop, the
empty-dir `--update` that became a surprise 512MB install, users stranded on stale versions. One
context, one language, one writer.

## Ubiquitous language

| Term | Meaning (exactly one) |
|---|---|
| **Shell** | The boot-frozen minimum CC loads: hooks.json declarations, hook-shim.mjs, the stable MCP server, skills/commands markdown. Changes here are rare and honestly flagged `requiresRestart`. |
| **Body** | Everything with behavior: hook script bodies, query engine, CLI, console, scripts. Updates hot. |
| **Generation** | A monotonically increasing integer naming one immutable, gated code payload under `versions/`. |
| **Spine / active.json** | The single atomically-rewritten pointer naming the active generation. The ONLY mutable control-plane state. |
| **Flip** | The atomic temp-file+rename rewrite of `active.json`. The flip IS the update. |
| **Gate** | A check a candidate must pass BEFORE it can be promoted (interpreter-true syntax, representative-stdin hook execution, MCP initialize/list/call). |
| **Lease** | A liveness marker a consumer (the MCP server) holds on the generation it is serving; GC never collects a leased generation. |
| **Transaction record** | `update-txn.json`; makes crash recovery deterministic (old world or new world, never half). |
| **KB track** | KB data's separate update lifecycle (private-store fence). The Updating context NEVER writes into `kb/`. |

## Aggregates & invariants

**Aggregate root: the Spine** (`active.json` + `versions/` + `update-txn.json`)
- INV-1: `active.json` only ever points at a fully-gated, immutable generation under `versions/` (or a `dev.json`-declared checkout).
- INV-2: All writes to the aggregate happen under the `.update.lock/` mkdir-lock, through the ONE engine (`scripts/update-apply.mjs`). The installer, `--update`, session-triggered and nightly updates are *callers* of the engine, never writers themselves.
- INV-3: A generation is immutable after promote. Fixes ship as a new generation.
- INV-4: `previous` is always retained until a newer generation is verified healthy; rollback is a flip, not a restore.
- INV-5: Unattended applies REQUIRE a valid Ed25519 signature; interactive applies may degrade to SHA-256 + loud warning.
- INV-6: The aggregate never touches `kb/` (the KB track owns it, with the private-store fence).

**Consumers (read-only)**: hook-shim.mjs and the stable MCP server. They read `active.json` once
per invocation/call, validate containment, and lease what they serve. They NEVER write the aggregate.

## Domain events (append-only, `update-receipts.jsonl`)

`UpdateChecked` · `CandidateStaged` · `CandidateGated{passed}` · `GenerationPromoted` ·
`SpineFlipped{from,to}` · `RollbackFlipped{reason}` · `FallbackServed{consumer,frozenVersion}` ·
`RestartRequired{reason}` — every event carries version, digest, and wall-time. The receipts file
is the audit trail `--doctor` and the console read; silence is never health.

## Anti-corruption layer

- **Toward Claude Code**: CC's versioned plugin cache and `installed_plugins.json` are treated as
  an external system we do not fight — the shim makes their staleness irrelevant.
- **Toward the KB track**: `forge-update.mjs` keeps its contract; the Updating context calls it,
  never reimplements it (no-silent-substitution rule).
- **Toward the legacy paths**: `bin/install.mjs --update` and session-start become thin callers of
  the engine; their old in-place mutation paths are retired, not wrapped.

## Context relationships

Updating ← upstream of → every other context (Console, Grounding, Learning): they consume the
generation it activates. Downstream conformist: they never negotiate update semantics.
