---
id: ADR-004
status: Implemented
date: 2026-06-27
updated: 2026-07-28
updated_source: incremental-nightly-single-store
---
# ADR-0004: Effectiveness first — size is a later optimization

**Status**: Implemented (2026-07-28)
**Date**: 2026-06-27

**Owner directive** (supersedes the v0.2 SQ8 default)

## Context
Every prior optimization for size bled effectiveness below the threshold where the tool works at all. The
owner's directive: "every time we try to be efficient, we give up massive chunks of effectiveness... maximize
for effectiveness."

## Decision
**Effectiveness is the only first-class metric.** For v1: use the **sharpest retrieval regardless of size** —
a strong code-aware embedder and/or a larger prose model, with **multiple vectors per chunk** (prose + code,
kind-routed) if it raises answer quality, in **f32** (no quantization that costs any measurable quality).
Quantization (SQ8/RaBitQ) is a **later efficiency pass**, gated on answer-quality delta. The Full bundle is
honestly ~1–1.5 GB; we ship it anyway. SKUs (Core/T0-only) exist for *convenience*, never to shrink an
in-scope answer.

The shipping implementation uses **one canonical computer-class store per repository**:
`Xenova/bge-base-en-v1.5`, 768 dimensions, CLS pooling, in `<repo>.big.rvf`. The former duplicate
MiniLM-384 store is retired from the Brain build; Cognitum Seed compatibility is a separate product
concern and does not make the Brain compute or ship the corpus twice. BGE-768 remains subject to a
controlled quality-per-byte bake-off against code-aware candidates; a replacement is promoted only
when frozen retrieval metrics improve without unacceptable footprint or runtime.

## Consequences
- v1 is large; accepted. A "lite" quantized build comes only after effectiveness is proven.
- The dimensionality decision is made by measured effectiveness on implementation-lookups, not by size.
- Non-duplication, installed footprint, and unobtrusive background operation are hard constraints
  after the effectiveness floor is met.

## Alternatives rejected
- *768-SQ8 default (v0.2)* — a size optimization; demoted to a later pass.
- *384-dim MiniLM* — smaller but weaker on code lookups; rejected for the shipping build.
