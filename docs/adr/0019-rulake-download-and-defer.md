---
id: ADR-019
title: RuLake — downloaded and kept current, integration deferred (format mismatch + no current payoff)
status: Accepted
date: 2026-07-17
authors: [Stuart Kerr, Claude Code]
tags: [rulake, ruvector, rvf, recall, architecture, decision]
supersedes: []
relates: []
updated: 2026-07-27
updated_source: derived-from-git
---

**Status**: Accepted (download done; integration deferred with explicit re-open triggers)

## Context

Stuart asked whether RuLake is loaded and whether we're using it correctly, then delegated the call.
Grounded in rUv's source (`concepts/rulake`, `rulake/docs/adrs/ADR-001`) and verified live:

- **What RuLake is:** a standalone product **extracted from RuVector** (rulake ADR-001, 2026-04-25) — a
  self-optimizing, witness-anchored vector **cache + decision layer** that sits *in front of* a vector
  store. RuVector is the store (`.rvf`); RuLake is the RaBitQ-compressed read-cache with sub-ms recall,
  cross-host witness trust, and hit-ratio that improves with use.
- **Loaded?** The `rulake` MCP is wired globally (`~/.claude.json` → hosted `rulake-mcp.ruv.io`) and its
  tools work — but `rulake_list_backends` returns `["demo"]` only: it fronts the shared demo, **not our
  data**. And there is **no local clone** — `~/Code/RuLake` was an empty stub. **Fixed:** cloned
  `ruvnet/RuLake` to `~/Code/RuLake`, `main` @ `8f2c408` (GitHub latest, 2026-06-08). Submodule
  `vendor/ruvector` left uninitialized (needed only to compile).

## Decision — download + keep current, but DO NOT integrate now

Verified 100%, not asserted:

1. **Format mismatch (proven by bytes).** RuLake's only local-file adapter, `FsBackend`
   (`rulake/crates/core/src/fs_backend.rs`), reads a deliberately-minimal `ruvec1` format (magic
   `b"ruvec1\0\0"`; flat header + raw `id:u64, f32×dim` records — "the M2 on-ramp, without dragging in
   arrow/parquet"). The brain's KBs are `.rvf` (magic **`SFVR`**). **0 of 111** KB files are `ruvec1`.
   There is **no `rvf-backend`** in RuLake as of 2026-06-08 — the "missing piece" the May architecture
   doc named is still missing. RuLake cannot read our KBs without a conversion pipeline (extract vectors
   from every `.rvf` → `ruvec1`), re-run on every nightly rebuild.
2. **It would only replace the ANN step, not recall.** RuLake returns `(id, score)`; the brain's recall
   returns passage **text**, which lives in the `.rvf`. So the `.rvf` + an id→text map stay regardless —
   RuLake sits *alongside*, it does not replace the recall path.
3. **No bottleneck to fix.** The brain is single-user, local, HNSW-indexed, and already fast; it is not
   query-volume-bound and not multi-host. RuLake's wins (cache-for-repeated-queries, cross-host witness
   trust) do not apply to today's use.
4. **Real build + maintenance cost** (compile the Rust crate + submodule, run a local MCP, write and
   sync the `.rvf`→`ruvec1` export, benchmark) for a benefit that only materializes at scale/multi-host.

Building it now would add complexity for zero present payoff — the wrong call. Keep RuLake **downloaded
and current** (it is), and revisit when a trigger below fires.

## Re-open triggers (when RuLake earns its keep here)

- The brain gets **hosted / served to many users** (repeated-query volume + shared cache + witness trust
  across machines all become real).
- We measure a **recall bottleneck** in the current RVF-direct path (we do not have one today).
- rUv ships a **native `rvf-backend`** (RuLake reads `.rvf` directly) — removes reason #1 entirely; watch
  `ruvnet/RuLake` for it.

When triggered: init the submodule, `cargo build`, stand up a local `rulake-mcp` with an `FsBackend` (or
`rvf-backend` if it lands) over exported KB vectors, re-point the MCP off the demo, and **benchmark
before/after vs RVF-direct** — switch on only if it wins.

## Consequences

- We hold the current RuLake source (auditable, ready) without running an unneeded service.
- The analysis is captured so this is a deliberate "not yet," not a forgotten TODO.
- Keep RuLake current with `git -C ~/Code/RuLake pull`.
