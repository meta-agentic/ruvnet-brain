# ruvnet — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What it is & who it's for**  

ruvnet is an open-source AI infrastructure collective building systems for agent orchestration, adaptive memory, and privacy-preserving spatial intelligence. The project maintains **173 original public repositories** (`data/metrics.json`) and **751+ published artifacts** across npm, crates.io, and Hugging Face (`data/metrics.json`), with core systems including:  

- **Ruflo**: Multi-agent orchestration with self-learning workflows (`data/projects.json`)  
- **RuView**: Privacy-first WiFi spatial sensing for pose/vitals detection (`data/projects.json`, `README.md`)  
- **MetaHarness**: Deterministic agent-harness generation across 9 host targets (`docs/ruvnet-prior-art.md`)  
- **RuVector**: Git-style versioned vector memory with snapshot/merge ops (`docs/ruvnet-prior-art.md`)  

### Key capabilities (all implemented)  
- **Agent infrastructure**: Ruflo’s swarm routing (`github.com/ruvnet/ruflo`) and RVM’s execution runtime (`github.com/ruvnet/rvm`) enable portable agent systems.  
- **Sensor fusion**: RuField’s multimodal schema (`github.com/ruvnet/rufield`) and RuView’s 21-crate WiFi pipeline (`README.md`) process real-time environmental data.  
- **Provenance tracking**: Signed lineage and replayable receipts for harness evolution (`docs/ruvnet-prior-art.md`).  

### Audience  
1. **AI engineers** needing modular, auditable components (e.g., `ruv-neural`’s 11 Rust crates for edge inference, `README.md`).  
2. **Researchers** in privacy-sensitive domains (WiFi-DensePose models on Hugging Face, `README.md`).  
3. **Infrastructure builders** leveraging RuVector’s memory system or MetaHarness’s reproducible agent scaffolding (`docs/ruvnet-prior-art.md`).  

**Metrics**: 51.7M npm downloads/year (`data/registry-stats.json`) and 300k+ weekly clones for RuView/ruflo (`docs/ruvnet-packages.md`) attest to production-scale use. Unimplemented roadmap items (e.g., PhotonLayer hardware) are explicitly marked (`data/projects.json`).  

For verification: All claims cite source files (`data/claims.json`’s evidence model) and registry IDs (`docs/ruvnet-packages.md`).

## Capabilities (what it can do)

# Capabilities (what it can do)

1. **Agent Orchestration**:  
   ruvnet provides multi-agent orchestration, swarms, routing, and self-learning workflows through its Ruflo system.  
   *Implemented in*: `data/projects.json` (Ruflo project entry) and `llms.txt` (primary systems list)

2. **Privacy-First Spatial Intelligence**:  
   The RuView system enables WiFi-based presence, pose, vitals, and environmental sensing with privacy protections.  
   *Implemented in*: `data/projects.json` (RuView project entry) and `llms.txt` (primary systems list)

3. **Adaptive Memory Infrastructure**:  
   RuVector provides real-time vector, graph, temporal, and adaptive memory capabilities.  
   *Implemented in*: `data/projects.json` (RuVector project entry) and `llms.txt` (primary systems list)

4. **Portable Agent Harness Generation**:  
   MetaHarness generates verifiable, portable agent harnesses that evolve across multiple hosts.  
   *Implemented in*: `data/projects.json` (MetaHarness project entry) and `docs/ruvnet-packages.md` (verifiable generator description)

5. **Registry Package Management**:  
   Maintains 751+ published artifacts across npm (361), crates.io (360), PyPI (8), and HuggingFace (22).  
   *Implemented in*: `data/metrics.json` (artifact counts) and `.github/workflows/refresh-registry-metrics.yml` (automated tracking)

6. **Technical Provenance Tracking**:  
   Documents feature presence through commit graphs, release artifacts, and adoption metrics.  
   *Implemented in*: `data/claims.json` (evidence model) and `docs/ruvnet-prior-art.md` (lineage tracking)

7. **Open-System Reverse Engineering**:  
   Rebuilds and maintains open implementations like Claude Code CLI (447 stars).  
   *Implemented in*: `docs/ruvnet-packages.md` (open-claude-code entry) and `README.md` (starred projects)

8. **Automated Metrics Reconciliation**:  
   Weekly cron job updates registry counts and verifies download statistics.  
   *Implemented in*: `.github/workflows/refresh-registry-metrics.yml` (scheduled workflow) and `data/metrics.json` (current_windows data)

*Not covered*: Optical hardware fabrication (PhotonLayer roadmap work explicitly excluded per `data/projects.json`).

## Core concepts & how they work

# Core concepts & how they work

## 1. Agent Orchestration (Ruflo)
EXISTS in `https://github.com/ruvnet/ruflo`  
Ruflo provides multi-agent coordination with:
- Swarm intelligence for distributed problem solving
- Self-learning workflow adaptation (`data/projects.json` shows "Multi-agent orchestration, swarms, routing, and self-learning workflows")
- Model routing infrastructure (RuvLTRA system achieves 100% routing accuracy per `docs/ruvnet-packages.md`)

## 2. Adaptive Memory (RuVector)
EXISTS in `https://github.com/ruvnet/RuVector`  
RuVector's real-time memory system features:
- Continuous HNSW topology reshaping from live retrieval feedback (`docs/ruvnet-prior-art.md` confirms this as a novel implementation)
- Hybrid vector/graph/temporal storage
- WASM-optimized embeddings (`ruvector-onnx-embeddings-wasm` crate in `docs/ruvnet-packages.md`)

## 3. Spatial Intelligence (RuView)
EXISTS in `https://github.com/ruvnet/RuView`  
Privacy-preserving spatial analysis via:
- WiFi signal processing pipeline (21-crate "WiFi-DensePose" system per `README.md`)
- Environmental and biometric sensing
- Per-room calibration capabilities

## 4. Portable Agent Infrastructure (MetaHarness)
EXISTS in `https://github.com/ruvnet/metaharness`  
Provides:
- Cross-host agent deployment verification
- Harness generation for diverse execution environments
- Evolution tracking for agent capabilities

## 5. Execution Runtime (RVM)
EXISTS in `https://github.com/ruvnet/rvm`  
Core features include:
- Agent lifecycle management
- Resource isolation guarantees
- Integration with RuVector's memory system

## Verification & Metrics
EXISTS in multiple systems:
- Automated registry tracking via `/.github/workflows/refresh-registry-metrics.yml`
- Evidence-based claims framework in `data/claims.json`
- 751+ published artifacts tracked in `data/metrics.json`

## Novel Capabilities
Per prior-art documentation (`docs/ruvnet-prior-art.md`):
1. First open-source vector store with continuous HNSW reshaping (RuVector)
2. First WASM-packaged sublinear-time solvers
3. First agent-native vector store treating optimization trials as first-class events (agentdb)

All core systems are implemented and verifiable via the cited repositories and package registries. The architecture emphasizes privacy, real-time adaptation, and evidence-based operation at each layer.

## Maturity (shipped vs proposed)

# Maturity (shipped vs proposed)

## Shipped Features (Verified Implementations)

1. **Core Infrastructure**  
   - RuVector self-learning vector DB (99 Rust crates, 141 npm packages) EXISTS (`docs/ruvnet-packages.md`)  
   - Ruflo/Claude-Flow harness (41 npm packages) EXISTS (`docs/ruvnet-packages.md`)  
   - 751+ published registry artifacts across Rust, npm, PyPI, and HuggingFace EXISTS (`data/metrics.json`)

2. **Provenance Tracking**  
   - Commit-anchored lineage verification system EXISTS (`docs/ruvnet-prior-art.md`)  
   - Evidence model for technical claims (schema v1.0) EXISTS (`data/claims.json`)  
   - Repository-level and artifact-level tracking EXISTS (`data/metrics.json`)

3. **Deployment Surface**  
   - 197 public repositories (173 non-fork) with active maintenance EXISTS (`data/metrics.json`)  
   - 34M+ npm downloads in rolling 12-month window EXISTS (`data/metrics.json`)  
   - 98 npm packages updated in June-July 2026 EXISTS (`data/metrics.json`)

## Proposed/Developing Features

1. **Novelty Claims**  
   - Scoped candidate predicates are documented but require additional feature-level evidence (`docs/ruvnet-prior-art.md`)  
   - Novelty assessments are explicitly marked as technical (non-legal) claims (`docs/ruvnet-prior-art.md`)

2. **Security Processes**  
   - Per-project reporting mechanisms are specified but not uniformly implemented (`SECURITY.md`)  
   - No centralized vulnerability database exists yet (`SECURITY.md`)

## Versioning and Evidence

- All shipped features are backed by:  
  a) Commit history (`docs/ruvnet-prior-art.md`)  
  b) Registry publication records (`docs/ruvnet-packages.md`)  
  c) Timestamped metrics (`data/metrics.json` verified 2026-07-13)  

- Proposed features lack either:  
  a) Implementation commits  
  b) Registry artifacts  
  c) Test coverage  
  (as noted in `CONTRIBUTING.md` contribution guidelines)

## Where the documentation lives

# Where the documentation lives

The ruvnet ecosystem maintains rigorous documentation across several authoritative locations:

## Core Documentation

1. **Project Index** (`/docs/ruvnet-packages.md`): The master list of all repositories and packages with installation counts and timestamps. This file tracks 173+ non-fork repositories and 751+ published artifacts.

2. **Technical Provenance** (`/docs/ruvnet-prior-art.md`): The canonical dossier for scoped technical claims, feature presence evidence, and prior art analysis. Each claim includes commit-level evidence and competitive positioning.

3. **Entity Glossary** (`/docs/ENTITY-GLOSSARY.md`): Defines key terms, architectural components, and system relationships across the ecosystem.

## Machine-Readable Data

1. **Metrics Registry** (`/data/metrics.json`): Contains verifiable counts of repositories (197 public), artifacts (751+), and adoption metrics (51.7M npm downloads). Updated weekly via automated workflow (`.github/workflows/refresh-registry-metrics.yml`).

2. **Evidence Model** (`/data/claims.json`): Documents the validation framework for lineage, feature presence, and novelty claims with preferred evidence types.

## Contribution Guidelines

- **CONTRIBUTING.md**: Specifies how to report stale metrics or broken links, with strict rules for maintaining distinction between repository creation, feature presence, and adoption evidence.

All documentation paths are absolute within the canonical repository (`https://github.com/ruvnet/ruvnet`) and updated through the same verification processes as code. The system does NOT maintain separate external wikis or unofficial documentation channels - all authoritative sources live in the main repository under `/docs` and `/data`.

## How to use it end-to-end

# How to use it end-to-end

## Installation and Setup

1. **Clone the core repositories** from `data/projects.json`:
   ```bash
   git clone https://github.com/ruvnet/RuView  # Spatial intelligence
   git clone https://github.com/ruvnet/ruflo   # Agent orchestration
   git clone https://github.com/ruvnet/RuVector # Adaptive memory
   ```

2. **Install published artifacts** (751+ available per `data/metrics.json`):
   ```bash
   # Rust crates (360+ available)
   cargo add ruv-neural-core wifi-densepose-core

   # NPM packages (361+ available)
   npm install @ruvnet/ruvllm @ruvnet/agentic-core
   ```

## Core Workflows

### Spatial Intelligence (RuView)
- Deploy WiFi-DensePose pipeline (21 crates listed in `README.md`):
  ```bash
  cargo install wifi-densepose-core  # Core processing
  cargo install wifi-densepose-vitals  # Health monitoring
  ```

### Agent Orchestration (Ruflo)
- Run Claude Flow multi-agent system (referenced in `data/projects.json`):
  ```bash
  git clone https://github.com/ruvnet/ruflo
  cd ruflo && npm install
  node cli.js --workflow=multi-agent-routing
  ```

### Adaptive Memory (RuVector)
- Integrate with RuvLLM (implementation in `README.md`):
  ```rust
  use ruvllm::Runtime;
  use ruvector::memory::TemporalGraph;
  ```

## Verification and Metrics

1. **Check registry metrics** (auto-updated via `.github/workflows/refresh-registry-metrics.yml`):
   ```bash
   curl https://api.npmjs.org/downloads/point/last-month/@ruvnet/ruvllm
   ```

2. **Validate project lineage** using `data/claims.json` evidence model:
   ```bash
   git log --reverse | head -1  # Verify root commits
   ```

## Advanced Usage

- **Harness generation**: Use MetaHarness (`docs/ruvnet-packages.md` lists 462 stars)
- **Quantum-resistant comms**: QuDAG package (189 stars in `docs/ruvnet-packages.md`)
- **Edge cognition**: Cognitum device (crate exists per `README.md`)

## Limitations

- Optical hardware (PhotonLayer) is roadmap-only per `data/projects.json`
- Python packages are limited (8 total in `data/metrics.json`)
- Some Hugging Face models require manual download (22 listed in `data/metrics.json`)
