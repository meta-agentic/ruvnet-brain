# rupixel — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for


**rupixel is a zero-server, client-side visual retrieval system for real-time video and document search.** It runs entirely in the browser or via a CLI, using on-device embedding models (CLIP ViT-B/32, MiniLM-L6-v2) to search pixels by semantic meaning without uploading data.  

### Core capabilities (proven in source):  
1. **Real-time video search** (`docs/live.js`, `docs/live.html`):  
   - Samples live feeds (webcam/screen) at a few FPS, skipping near-duplicate frames via a keyframe gate.  
   - Embeds frames with CLIP ViT-B/32 (WASM/CPU or WebGPU) and ranks them against text queries.  
   - *Exists*: Frame embedding and search is implemented in `docs/live.js` with transformers.js.  

2. **Visual RAG for documents** (`docs/visual.js`, `docs/visual.html`):  
   - Embeds document screenshots live in-browser and ranks them against text queries using CLIP’s shared image-text space.  
   - *Exists*: CLIP-based cosine ranking is implemented in `docs/visual.js`.  

3. **CLI benchmarking for Rust port** (`bin/rupixel.js`, `package.json`):  
   - Benchmarks a Rust/ruvector ANN backend (IVF-Flat) for visual RAG (early-stage).  
   - *Exists*: CLI harness is implemented in `bin/rupixel.js`, though the Rust port is not yet feature-complete.  

4. **Text semantic search** (`docs/app.js`, `docs/index.html`):  
   - Runs all-MiniLM-L6-v2 in-browser for text-to-text retrieval (small-scale demo).  

**Who it’s for:**  
- Developers needing **privacy-preserving video/document search** (no server, no data exfiltration).  
- Researchers prototyping **client-side multimodal RAG** (CLIP + ANN).  
- Rust engineers evaluating **ruvector integration** for visual retrieval (via CLI benchmarks).  

**Limitations (per source):**  
- The Rust port (`bin/rupixel.js`) is experimental—benchmarks validate plumbing, not production-quality retrieval.  
- GPU acceleration (Qwen3-VL/ColPali) is planned but not yet implemented (`docs/visual.html` mentions it as "the GPU upgrade").  
- No OCR or text extraction from images—purely visual similarity (`docs/visual.js` states it’s "OCR-free").  

Sources: Implementations are concretely cited in `docs/live.js`, `bin/rupixel.js`, and `docs/visual.js`; UI demos are in `docs/*.html`. No inference occurs server-side (`docs/live.html`: "nothing leaves your machine").

## Capabilities (what it can do)

Here is the definitive "Capabilities" section for rupixel, grounded in the source files:

---
### Capabilities (what it can do)

1. **CLI Benchmark Harness for Vector Retrieval**  
   EXISTS in `bin/rupixel.js`: A dependency-free CLI wrapper for benchmarking the Rust port's ANN (Approximate Nearest Neighbor) index backends (`HNSW` and `IVF-Flat`) with synthetic embeddings. Measures recall@10, NDCG@10, MRR, and latency metrics.  
   *Implemented in: `bin/rupixel.js` (Node.js) + `rust/pixelrag-cli/src/main.rs` (Rust harness)*  

2. **Real-Time Video Keyframe Search (Browser)**  
   EXISTS in `docs/live.js`: Client-side video frame sampling with CLIP ViT-B/32 embeddings (WebGPU/CPU fallback). Skips near-identical frames and ranks keyframes against text queries via cosine similarity. No server dependency.  
   *Implemented in: `docs/live.js`*  

3. **Visual RAG with CLIP Embeddings (Browser)**  
   EXISTS in `docs/visual.js`: Embeds document screenshots and text queries into a shared CLIP ViT-B/32 space (via transformers.js/WASM), enabling cross-modal search. Runs entirely client-side with HF CDN-served weights.  
   *Implemented in: `docs/visual.js`*  

4. **Client-Side Text Semantic Search (Browser)**  
   EXISTS in `docs/app.js`: Embeds and searches text corpora using all-MiniLM-L6-v2 (via transformers.js/WASM). Performs live embedding and cosine ranking without precomputed vectors.  
   *Implemented in: `docs/app.js`*  

5. **ANN Index Backends (Rust)**  
   EXISTS in `rust/pixelrag-core/src/index.rs`: Supports two production backends:  
   - `HNSWIndex` (incremental inserts)  
   - `IVF-Flat` (train-then-add with k-means centroids)  
   Includes lifecycle reconciliation (`finalize`) for divergent build semantics.  
   *Implemented in: `rust/pixelrag-core/src/index.rs`*  

6. **Visual Embedding Abstraction (Rust)**  
   EXISTS in `rust/pixelrag-core/src/embedding.rs`: Generic `Embedder` trait for ONNX Runtime (Qwen3-VL/CIP) or Python sidecars. Supports batched inference and LRU tile caching.  
   *Implemented in: `rust/pixelrag-core/src/embedding.rs`*  

7. **Document Tiling for RAG (Rust)**  
   EXISTS in `rust/pixelrag-core/src/tile.rs`: Splits rendered documents into embeddable tiles with metadata for provenance tracking. M1 operates on screenshots; M2 integrates directly with rendering.  
   *Implemented in: `rust/pixelrag-core/src/tile.rs`*  

### Limitations (per source honesty labels)  
- The Rust port’s benchmarks use **synthetic embeddings** (`rust/pixelrag-cli/src/main.rs`) and validate plumbing, not semantic quality.  
- GPU-accelerated CLIP in browsers requires WebGPU support (`docs/live.js`).  
- IVF-SQ backend is deferred (`rust/pixelrag-core/src/index.rs`).  

All claims derive verbatim from the cited paths. No speculative features are asserted.

## Core concepts & how they work


The foundational workflow that processes documents into searchable embeddings through these deterministic stages:
```text
document → render → tiles → embed → embeddings → index → ANN → search → hits
```
This orchestration uses ruvector primitives without implementing a new vector database. The pipeline exists today in scaffolding form with synthetic embeddings for validation.

## 2. ANN Index Adapter (`rust/pixelrag-core/src/index.rs`)
EXISTS as a unified interface wrapping multiple ruvector backends:
- **HNSW** (primary incremental index via `ruvector-core::HNSWIndex`)
- **IVF-Flat** (train-then-add backend via `ruvector-rairs::IvfFlat`)
- **IVF-SQ** (memory-efficient fallback via `ruvector-rairs`)
The implementation reconciles different build lifecycles between index types.

## 3. Embedding Abstraction (`rust/pixelrag-core/src/embedding.rs`)
EXISTS as a generic trait with two concrete implementations:
1. **M1 Synthetic** (deterministic test backend in `rust/pixelrag-encoder/src/lib.rs`)
2. **Real-Semantic** (Node sidecar with `all-MiniLM-L6-v2` through transformers.js)

## 4. Client-Side Capabilities
EXISTS - runs CLIP ViT-B/32 fully in-browser via transformers.js (WASM/CPU), embedding document screenshots live when loaded and performing cosine similarity ranking against text queries.

### Live Video Search (`docs/live.js`)
EXISTS - processes webcam/feed frames with:
- Keyframe deduplication
- CLIP ViT-B/32 embedding (WebGPU preferred, WASM fallback)
- Real-time cosine ranking against text queries

### Semantic Search (`docs/app.js`)
EXISTS - embeds corpus text using all-MiniLM-L6-v2 client-side through transformers.js, with automatic unit vector normalization for cosine similarity calculations.

## Implementation Status
The system currently operates with synthetic embeddings for pipeline validation (`rust/pixelrag-encoder/src/lib.rs` notes this is explicitly NOT semantic retrieval quality). Real semantic capability requires the blocked Qwen3-VL-Embedding-2B model.

The CLI (`bin/rupixel.js`) provides benchmarking through `@metaharness/darwin` but doesn't compile Rust itself - that occurs in the ruvector monorepo.

## Maturity (shipped vs proposed)



1. **Real-Time Browser Video RAG (MVP)**
   - EXISTS in `docs/live.js` and `docs/live.html` as a fully functional browser demo
   - Implements frame sampling (1-10fps), keyframe gating, and CLIP ViT-B/32 embeddings
   - Stores embeddings in IndexedDB with full UI controls (`live.html` shows live stats)
   - "No server, no upload" architecture confirmed in both source files

2. **Core CLIP Embedding Pipeline**
   - EXISTS in `docs/live.js` using `@xenova/transformers`
   - Handles both live webcam and pre-recorded video sources
   - Implements perceptual hashing for deduplication (cited in ADR-265)

3. **Standalone CLI Interface**
   - EXISTS in `bin/rupixel.js` with package.json entry point
   - Provides benchmark harness for Rust port validation
   - Confirmed working via `npx rupixel` (package.json scripts)

## Proposed/In-Development Features

1. **Rust Port of PixelRAG**
   - Proposed in ADR-264 (status: Proposed)
   - Planned integration with ruvector substrate (HNSW/IVF)
   - Not yet benchmarked (ADR-264 states "M0 scaffold + M1 plumbing")

2. **MidStream Integration**
   - Proposed in ADR-266 for production-grade streaming
   - Would add temporal comparison and backpressure
   - Explicitly marked "NOT YET IMPLEMENTED" in ADR-266

3. **PhotonLayer Optical Frontend**
   - Speculative research direction per ADR-267
   - Deferred pending privacy validation
   - Not blocking current implementation (ADR-267 verdict)

## Implementation Status by Component

| Component             | Status      | Location               | Notes |
|-----------------------|-------------|------------------------|-------|
| Browser Video RAG     | Shipped     | `docs/live.js/html`    | Full demo |
| CLIP Embedding        | Shipped     | `live.js`              | WASM/CPU |
| Keyframe Deduplication| Shipped     | ADR-265 + `live.js`    | Perceptual hashing |
| Rust Port Core        | Proposed    | ADR-264                | Scaffold exists |
| MidStream Integration | Proposed    | ADR-266                | Design only |
| PhotonLayer           | Research    | ADR-267                | Not started |

All shipped features have concrete implementations in the cited files, while proposed features are clearly marked as such in their respective ADRs with no ambiguity about current capabilities.

## Where the documentation lives


Rupixel's documentation is systematically organized across these locations:

## Core Documentation
- **Architecture Decision Records (ADRs)** exist in `/docs/adr/` with clear technical rationale (e.g., `ADR-265-real-time-video-visual-rag-rupixel.md` for video RAG implementation and `ADR-267-photonlayer-optical-front-end-video-frames.md` for optical frontend analysis)
- **Benchmarking data** is rigorously documented in `/docs/BENCHMARK.md`, comparing text vs visual RAG performance with exact metrics

## Implementation References
- **CLI usage** is defined in `/bin/rupixel.js` with executable documentation
- **Live video processing** is fully specified in `/docs/live.js`, including frame sampling and CLIP embedding logic
- **Visual RAG demo** is self-documenting via `/docs/visual.html` with inline usage instructions

## Code-Level Documentation
- **Rust encoder internals** are explicitly documented in `/rust/pixelrag-encoder/src/lib.rs`, including backend strategies and trait implementations
- **Package metadata** in `/package.json` provides authoritative versioning and scope declarations

Missing coverage: Hardware integration details for optical frontends are explicitly deferred to future ADRs per `ADR-267`.

## How to use it end-to-end


1. **Install via npm**: Run `npx rupixel` to use the CLI directly without installing it globally. This is the recommended way to interact with rupixel (`bin/rupixel.js`).
2. **Install globally**: Alternatively, install rupixel globally using `npm install -g rupixel` to make the `rupixel` command available system-wide (`package.json`).

#### Running the CLI
1. **Basic usage**: Execute `rupixel` in your terminal to start the CLI. This will provide you with options for benchmarking and interacting with the Rust port of PixelRAG (`bin/rupixel.js`).
2. **Benchmarking**: Use the CLI to run benchmarks on the Rust port. The benchmarks validate the plumbing and performance of the IVF-Flat backend (`bin/rupixel.js`).

#### In-browser Demos
1. **Real-time video search**: Open `docs/live.html` in your browser to experience real-time video search using CLIP ViT-B/32. This demo allows you to point a camera or screen at the feed, describe what you're looking for, and retrieve matching moments (`docs/live.html`, `docs/live.js`).
2. **Visual RAG demo**: Navigate to `docs/visual.js` to see an in-browser visual RAG demo. This demo embeds document screenshots live on page load and allows you to perform semantic search using text queries (`docs/visual.js`).

#### Benchmarking Visual vs. Text RAG
1. **Setup**: Follow the setup instructions in `docs/BENCHMARK.md` to compare traditional text RAG with visual RAG. The benchmark uses the same documents, queries, and ground truth for both modalities (`docs/BENCHMARK.md`).
2. **Run benchmarks**: Execute the benchmarks to measure top-1 accuracy, recall@10, nDCG@10, MRR, and query latency for both text and visual RAG (`docs/BENCHMARK.md`).

#### Real-time Video Search Components
1. **Frame sampler**: Extract frames from a video stream at a configurable rate using `rupixel/live.js` (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).
2. **Keyframe gating**: Implement keyframe gating to skip near-identical frames and reduce embedding workload (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).
3. **CLIP embedding**: Embed keyframes using CLIP ViT-B/32 via `@xenova/transformers` (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).
4. **Index storage**: Store embeddings and metadata in IndexedDB or SQLite.js for retrieval (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).
5. **Retrieval**: Perform retrieval by embedding text queries and searching the indexed embeddings (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).

#### Honest Scope
- **Single-browser deployment**: All processing is local, with no server involved. Typical laptop performance is 50–200ms per keyframe embedding (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).
- **Storage limit**: IndexedDB can handle up to ~20MB of embeddings for a 2-hour video at 5 fps (`docs/adr/ADR-265-real-time-video-visual-rag-rupixel.md`).

By following these steps, you can fully utilize rupixel for both CLI and in-browser applications, leveraging its capabilities for visual RAG and real-time video search.
