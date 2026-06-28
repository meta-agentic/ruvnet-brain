# RuvNet Brain — Domain Model (DDD)

`Updated: 2026-06-27 07:12 PDT | v0.1`

The RuvNet Brain is a *build-and-serve pipeline*. DDD here keeps each concern at its own level of
sophistication (the owner's "right level of the stack" requirement) and prevents cross-context leakage
(e.g., grading logic creeping into ingestion, or enforcement assuming knowledge it doesn't have).

## Ubiquitous language
- **Repo** — a RuvNet GitHub repository at a pinned commit SHA.
- **Chunk / Passage** — a ~4k-char span of real source/doc text; the unit of retrieval. FULL text always
  joined back (never embeddings-only).
- **Symbol** — a `pub fn`/`struct`/`trait`/exported binding → `repo:file:line` (the point-deeper target).
- **Segment** — one repo's HNSW store; the Brain is a set of segments, not one merged index.
- **Layer (L0–L4)** — human primer / AI gate / concept ("RuvNet way") / deep source / structure.
- **Grounded answer** — an answer whose load-bearing claims cite source the grader fetched and verified.
- **Drift** — an answer that dismisses or routes around RuvNet architecture (the failure to suppress).

## Bounded contexts (each its own aggregate + level)

1. **Ingestion** — walks a Repo, produces Passages + census. *Invariant:* chunks == passages == ids
   (reconcile-or-fail). Knows files, not vectors.
2. **Indexing** — embeds Passages (best/multi-vector), builds the Symbol index + repo Graph + ADR status.
   *Invariant:* every vector has a passage; symbols resolve to real lines.
3. **Synthesis (L2)** — generates "the RuvNet way" articles. *Invariant:* ≥2 citations to **Implemented**
   code, ADR-checked; un-citable → rejected. (Highest-risk context — most guarded.)
4. **Verification / Grading** — the gate of record. Fetches cited source, checks support, runs an
   independent deep-dive re-answer, multi-vendor panel. *Invariant:* citations must hold against real
   source; no same-family LLM is final.
5. **Enforcement** — the host-side grounding (retrieve-and-inject, PreToolUse hard-deny, Stop judge).
   *Invariant:* measured drift-rate ≤ SLO; never claims more than hooks can do.
6. **Distribution** — assembles the zip bundle (segments + passages + symbols + graph + primers + gate +
   signed manifest). *Invariant:* self-contained; one `.mcp.json` line wires it.
7. **Evergreen** — registry + triggers + SHA-pinned rebuild + watchdog. *Invariant:* a stale brain pages.

## Anti-corruption boundaries
- Ingestion ↔ Indexing: passages cross by id only; Indexing never re-reads the repo.
- Synthesis ↔ Verification: an L2 article is just another graded answer — no special pass.
- Enforcement ↔ everything: enforcement consumes the served bundle; it never assumes un-retrieved knowledge.

## Aggregate roots
`BrainVersion` (vMAJOR.MINOR.PATCH) is the root: it owns the set of `Segment`s (each owning its
`Passages`+`SymbolIndex`), the `Graph`, the `GradeReport` (per-tier), the `DriftReport`, and the signed
`Manifest`. A BrainVersion is publishable only when GradeReport (ground-truth) + DriftReport (≤SLO) +
Manifest (signed) are all green.
