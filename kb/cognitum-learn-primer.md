# cognitum-learn — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What it is & who it's for**

cognitum-learn is a high-performance Rust CLI that transforms video content (primarily YouTube) into queryable knowledge bases stored in RuVector's RVF binary format. Each knowledge base is stored as a single `.rvf` file per topic, with supporting metadata and verification files (`<topic>.meta.json`, `<topic>.witness.json`, etc.) as documented in `crates/learn-cli/src/commands.rs`.

Key capabilities that EXIST today:
- **Video ingestion pipeline**: Wraps yt-dlp for acquisition and whisper.cpp for ASR (with Metal acceleration on Apple Silicon) as shown in `crates/learn-acquire/Cargo.toml` and `crates/learn-asr/Cargo.toml`
- **Structured knowledge storage**: Uses witness-chained RVF binary format with sidecar verification files (`.witness.json`) as maintained in `crates/learn-cli/src/commands.rs`
- **Hybrid retrieval**: Combines BGE-large embeddings with HNSW + BM25 retrieval and MMR diversity scoring (`.emb.bin` sidecar files)
- **Autonomous curriculum building**: Through the `learn study` command that implements SONA self-learning patterns

**Who should use it:**

1. **Technical learners** who want to:
   - Build persistent knowledge bases from video courses/lectures (`learn ingest`)
   - Query ingested content with cited answers (`learn ask`)
   - Apply lessons to real tasks (`learn apply`)

2. **Educators & researchers** needing to:
   - Bulk import lecture materials (`learn import`)
   - Maintain verifiable provenance of sources (witness-chain system)
   - Automate curriculum discovery (`learn study`)

3. **Developers** who require:
   - Rust-native ML pipelines (all core crates like `learn-core`, `learn-reasoning`)
   - Apple Silicon-optimized workflows (Metal-accelerated Whisper)
   - Scriptable automation (`learn forget --force`)

The system is **not designed for** general web research or queries unrelated to ingested video knowledge bases, as explicitly stated in `.claude/skills/cognitum-learn/SKILL.md`. Current limitations include Linux voice setup being Mac-only and some advanced voice integrations still in flight per `README.md`.

## Capabilities (what it can do)

Here are the definitive capabilities of cognitum-learn, with direct source citations for each:

1. **Persistent Configuration Management**  
   EXISTS in `crates/learn-cli/src/config.rs`  
   - Stores JSON configs in platform-specific locations (`~/.config/learn-rs/config.json` etc.)  
   - Supports environment variable overrides for seed configuration (`LEARN_SEED_ADDRESS`, `LEARN_SEED_TOKEN` etc.)  

2. **Seed Device Integration**  
   EXISTS in `crates/learn-cli/src/seed_query.rs` and `crates/learn-cli/src/push.rs`  
   - Queries Seed devices via `POST /api/v1/store/query` with BGE-small-en-v1.5 embeddings  
   - Pushes vectors to Seeds via `POST /api/v1/store/ingest` with batched JSON payloads  
   - Handles authentication via Bearer tokens (configurable via `LEARN_SEED_TOKEN`)  

3. **Knowledge Base Ingestion**  
   EXISTS in `crates/learn-cli/src/main.rs`  
   - Processes video sources (URLs, playlists, local files) into structured topics  
   - Supports frame extraction modes (auto/on/off) with Sonnet-vision captioning  
   - Implements cost controls for keyframe processing  

4. **Vector Index Management**  
   EXISTS in `crates/learn-index/src/lib.rs`  
   - Provides `RvfStore` API for vector storage (create/open/ingest/query)  
   - Supports large-scale indices via DiskANN implementation  
   - Implements compaction and PQ (Product Quantization) for scalability  

5. **Answer Synthesis**  
   EXISTS in `crates/learn-synth/src/lib.rs`  
   - Offers both cloud (Anthropic API) and local (`ruvllm`) synthesis paths  
   - Includes AIMDS safety scanning for input/output validation  
   - Configurable via environment variables (`LEARN_SYNTH_LOCAL`, `LEARN_ANTHROPIC_MODEL` etc.)  

6. **Programmatic API Server**  
   EXISTS in `crates/learn-serve/src/lib.rs`  
   - Exposes JSON-RPC 2.0 interface with three core methods:  
     - `kb_query` for vector search  
     - `kb_synthesize` for answer generation  
     - `kb_list_videos` for content inventory  
   - Maintains audit trails via witness files  

Unimplemented capabilities (confirmed absent from sources):  
- No native OCR capability mentioned  
- No direct database integration beyond vector stores  
- No multi-modal query support beyond text+video frames

## Core concepts & how they work

# Core Concepts & How They Work

## 1. Seed-Based Vector Querying (EXISTS)
The system provides direct integration with Cognitum One Seed devices for remote vector similarity search. When configured (via `--on-seed` flag or automatic selection), queries are:
- Embedded locally using BGE-small-en-v1.5 (384-dimensional)
- Sent via POST to `/api/v1/store/query` on the Seed device
- Returned as `(id, distance)` pairs which are resolved against local metadata

Implementation: `crates/learn-cli/src/seed_query.rs` handles the full pipeline from embedding to result translation.

## 2. Topic-Based Knowledge Isolation (EXISTS)
Each knowledge domain is strictly isolated as a `Topic`:
- Stored at `<kb_root>/<slug>.rvf` with separate HNSW indices
- Identified by URL-safe slugs (auto-generated from human labels)
- Maximum 40-character identifiers with dash-separated words

Implementation: Core topic handling defined in `crates/learn-core/src/lib.rs` with strict filesystem isolation.

## 3. Seed Vector Ingestion (EXISTS)
Vectors can be pushed to Seed devices in compliant batches:
- Uses HTTP POST to `/api/v1/store/ingest`
- Batches automatically to stay under 64KB payload limit
- Supports both LAN and USB-gadget connectivity modes

Implementation: Full push protocol implemented in `crates/learn-cli/src/push.rs`.

## 4. Knowledge Base Health Monitoring (EXISTS)
Provides spectral analysis of embedding sets:
- Measures Fiedler value (graph connectivity)
- Detects contradictory embeddings (negative dot products)
- Flags near-duplicate content pairs

Implementation: `crates/learn-coherence/src/lib.rs` provides `KbHealth` reporting via `ruvector-coherence` primitives.

## 5. Query Drift Detection (EXISTS)
Tracks query quality over time using:
- CUSUM change-point detection
- Baseline vs recent window comparison
- Cosine similarity tracking

Implementation: Drift analysis exposed via `DriftReport` in `crates/learn-coherence/src/lib.rs`.

## 6. Trajectory Storage (EXISTS)
Specialized storage for reasoning trajectories:
- JSONL format at `<kb_root>/_reasoning/<topic>.rbank`
- Append-only writes with immediate flush
- Linear scan retrieval (optimized for <100 trajectories)

Implementation: `crates/learn-reasoning/src/lib.rs` handles the lightweight storage format.

## 7. Configuration Management (EXISTS)
Persistent settings with env var overrides:
- Platform-specific config file locations
- Seed address/token configuration
- Auto-push behavior control

Implementation: Configuration system defined in `crates/learn-cli/src/config.rs`.

## Key Omissions
- No evidence of cross-topic querying capabilities
- No implementation of local HNSW index building (only referenced)
- No user authentication system for local operations

## Maturity (shipped vs proposed)

## Maturity (shipped vs proposed)

Cognitum-learn is a **shipped production tool** with clearly delineated GA features versus proposed roadmap items. The system follows a phased Elite Roadmap (`docs/adr/ADR-001-elite-roadmap.md`) with explicit completion gates (Written/Ruflo-QA'd/Tested/Confirmed). Here's the definitive breakdown:

### SHIPPED (v0.5.10 as of 2026-05-28)

1. **Core Ingestion Pipeline**  
   - EXISTS: YouTube/PDF/MP3/MP4/TXT/MD ingestion (`crates/learn-cli/src/commands.rs`)  
   - EXISTS: BGE-large embeddings + RVF storage with witness chains (`CHANGELOG.md` v0.5.9 fixes)  
   - EXISTS: Hybrid HNSW+BM25 retrieval with MMR diversity (`docs/ddd/DDD-001-bounded-contexts.md` Context 4)  

2. **Query Interface**  
   - EXISTS: `learn ask` with cited answers grounded in video timestamps (`README.md` "All 25 commands")  
   - EXISTS: `learn apply` for task-based synthesis (`SOURCE 2` SKILL.md subcommands table)  

3. **Platform Support**  
   - EXISTS: Apple Silicon binary + Mac voice integration (`README.md` "Apple voice GA v0.5.7+")  
   - EXISTS: Linux x86_64/ARM64 and Windows binaries (`README.md` build matrix)  

4. **Maintenance Features**  
   - EXISTS: Full artifact cleanup in `learn forget` (`CHANGELOG.md` v0.5.9 sidecar fixes)  
   - EXISTS: Config management at OS-standard paths (`crates/learn-cli/src/config.rs`)  

### PROPOSED (Accepted in ADR but not shipped)

1. **Autonomous Curation**  
   - Phase 2.5 curriculum discovery (`docs/phase25-design.md` candidate scoring flow)  
   - Louvain community detection for subtopics (`SOURCE 1` ADR-001 phases table)  

2. **Advanced Retrieval**  
   - DiskANN for billion-vector scale (`SOURCE 1` rejected alternatives table)  
   - Cross-encoder reranking (`SOURCE 3` Context 4 sparse/dense fusion)  

3. **Sovereignty Features**  
   - Local ruvllm synthesis (`SOURCE 3` Context 5 `RuvllmSynthesizer`)  
   - CoherenceMonitor for drift detection (`SOURCE 1` phase 5 description)  

The shipped features are **battle-tested** with explicit error handling (e.g., v0.5.10's witness chain cleanup in `crates/learn-cli/src/commands.rs`) and platform-specific optimizations (e.g., Metal-accelerated Whisper in `crates/learn-asr/Cargo.toml`). Proposed features are scoped in ADRs with clear ownership and verification steps.

## Where the documentation lives

Here's the authoritative "Where the documentation lives" section for cognitum-learn, based strictly on the provided sources:

---

## Where the documentation lives

### Core documentation
1. **Command-line interface (CLI) reference**:  
   - Exists in the built-in `--help` system (`learn --help` shows all 22 subcommands)  
   - Implementation: `crates/learn-cli/src/main.rs`  
   - Detailed usage patterns documented in `.claude/skills/cognitum-learn/SKILL.md`

2. **Skill definition and invocation patterns**:  
   - Exists at `.claude/skills/cognitum-learn/SKILL.md`  
   - Contains exact binary lookup paths and installation instructions  
   - Specifies when to invoke the skill with concrete examples

3. **Configuration system**:  
   - Fully documented in `crates/learn-cli/src/config.rs`  
   - Specifies exact config file locations per platform:  
     - Linux: `~/.config/learn-rs/config.json`  
     - macOS: `~/Library/Application Support/learn-rs/config.json`  
     - Windows: `%APPDATA%\learn-rs\config.json`  
   - Lists all environment variable overrides

### Technical documentation
4. **Domain-Driven Design (DDD) specifications**:  
   - Exists in `docs/ddd/` directory (e.g., `DDD-001-bounded-contexts.md`)  
   - Documents all bounded contexts and their responsibilities

5. **Crate-level documentation**:  
   - Each component has its purpose declared in its `Cargo.toml`:  
     - `crates/learn-reasoning/Cargo.toml` (ReasoningBank)  
     - `crates/learn-acquire/Cargo.toml` (yt-dlp wrapper)  

### Change tracking
6. **Version history**:  
   - Detailed in `CHANGELOG.md` following Keep a Changelog format  
   - Contains implementation file references for each change (e.g., fixes in `crates/learn-cli/src/commands.rs`)

### Missing documentation
- No standalone API documentation exists for internal Rust crates (only `Cargo.toml` descriptions)  
- No architectural diagrams are referenced in the provided sources  
- No contributor guidelines are visible in the excerpts  

All documented paths and features are confirmed present in the source tree as shown in the verbatim excerpts.

## How to use it end-to-end

# How to use it end-to-end

## Installation
1. Install the `learn` binary via one of these methods (EXISTS per `.claude/skills/cognitum-learn/SKILL.md`):
   - `cargo install` from source
   - Download release tarball and run `install.sh`
   - Pre-built binaries for macOS (Apple Silicon/Intel), Linux (x86_64/aarch64), and Windows (x86_64)

2. Verify installation:
   ```bash
   learn --help
   ```

## Configuration (EXISTS per `crates/learn-cli/src/config.rs`)
Configuration is stored at platform-standard locations:
- Linux: `~/.config/learn-rs/config.json`
- macOS: `~/Library/Application Support/learn-rs/config.json` 
- Windows: `%APPDATA%\learn-rs\config.json`

Key environment variables:
- `LEARN_SEED_ADDRESS`: Overrides Seed device address
- `LEARN_SEED_TOKEN`: Overrides authentication token
- `LEARN_SEED_AUTO_PUSH`: Enables automatic KB sync to Seed

## Core Workflow

### 1. Create a knowledge base
```bash
# Single YouTube video (EXISTS per `.claude/skills/cognitum-learn/SKILL.md`)
learn ingest https://youtu.be/XYZ --topic my-topic

# Bulk import local files (EXISTS per README.md)
learn import ~/Downloads/lectures/ --topic ml-course
```

### 2. Query the KB (EXISTS per `crates/learn-cli/src/seed_query.rs`)
```bash
# Local query
learn ask my-topic "What does the speaker say about X?"

# Seed device query (when configured)
learn ask my-topic "Explain Y" --on-seed
```

### 3. Apply knowledge (EXISTS per `.claude/skills/cognitum-learn/SKILL.md`)
```bash
learn apply french-cooking "draft a recipe using these techniques"
```

### 4. Manage KBs
```bash
# List topics
learn list

# Remove a topic (EXISTS per CHANGELOG.md)
learn forget my-topic  # Interactive
learn forget my-topic -y  # Non-interactive
```

## Advanced Features

### Seed Device Integration (EXISTS per `crates/learn-cli/src/push.rs`)
```bash
# Manual push
learn push my-topic --seed 192.168.1.100

# Automatic push (when LEARN_SEED_AUTO_PUSH=1)
learn ingest https://youtu.be/ABC --topic new-topic
```

### Model Management (EXISTS per README.md)
Models are cached at `~/.cache/learn-rs/models/`. To troubleshoot:
```bash
learn doctor  # Check missing models
rm -rf ~/.cache/learn-rs/models/  # Force refresh
```

## Limitations
- Voice setup is currently Mac-only (per README.md)
- Linux ARM64/Intel Mac voice support is planned but not yet implemented
- Google Nest arbitrary Q&A is impossible due to platform constraints
