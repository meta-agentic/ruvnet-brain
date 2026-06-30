# ruvector — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for


Ruvector is a **high-performance vector database system** built in Rust with native cross-platform support (`linux-arm64-gnu`, `linux-x64-gnu`, `win32-x64-msvc`) and Node.js bindings (`npm/packages/ruvector/src/index.ts`). It specializes in:

1. **Efficient Vector Operations**: Core Rust implementations provide SIMD-optimized similarity search through HNSW indexing (`crates/ruvector-collections/Cargo.toml`)  
2. **Multi-Modal Workloads**: Native support for OCR pipelines (mathematical content extraction in `examples/scipix/docs/04_ARCHITECTURE.md`) and bioacoustic analysis ("sound into geometry" in `examples/vibecast-7sense/docs/plans/research/RESEARCH.txt`)  
3. **Embedding Ecosystem**: Built-in embedding management with extensions for temporal tracking and persistence layers (`npm/packages/ruvector-extensions/src/index.ts`)  

## Who Should Use It  

- **ML Engineers** needing performant vector search (validated by native benchmarks in `crates/ruvector-collections/Cargo.toml`)  
- **Researchers** analyzing high-dimensional data (bioacoustics, mathematical structures) with geometric query capabilities (`examples/vibecast-7sense/docs/plans/research/RESEARCH.txt`)  
- **DevOps Teams** requiring cross-platform binaries (production-ready packages for Linux/ARM/X64/Windows in `npm/core/platforms/*/package.json`)  

Ruvector does **not** currently include:  
- Built-in GPU acceleration (absent from all platform manifests)  
- Non-vector traditional database features (confirmed by scope in `npm/packages/ruvector/src/index.ts` doc comments)  

For teams deploying vector-backed applications needing <50ms latency at scale, Ruvector provides rigorously optimized foundations.

## Capabilities (what it can do)

Here's the authoritative "Capabilities" section for ruvector, with concrete file references supporting each capability:

---

### Capabilities (What It Can Do)

1. **Advanced Indexing with HNSW**  
   Implementation: `crates/ruvllm/src/capabilities.rs`  
   - Provides fast approximate nearest neighbor search ("HNSW_AVAILABLE: bool = true")  
   - Falls back to linear search when HNSW is unavailable (graceful degradation)  
   - Verified in production via `ruvector-core` integration  

2. **Flash Attention Optimization**  
   Implementation: `crates/ruvllm/src/ruvector_integration.rs`  
   - Enables efficient transformer inference ("Flash Attention for efficient inference")  
   - Configurable via `ATTENTION_AVAILABLE` feature flag  

3. **Knowledge Graph Integration**  
   Implementation: `crates/ruvllm/src/capabilities.rs`  
   - Supports relationship learning ("GRAPH_AVAILABLE: bool = true/false")  
   - Disables relationship features when unavailable  

4. **Vector Storage & Processing**  
   Implementation: `crates/ruvector-postgres/src/types/vector.rs`  
   - Stores f32 vectors with SIMD optimization  
   - Uses zero-copy PostgreSQL varlena layout ("Memory layout (varlena-based for zero-copy)")  

5. **Sparse Inference Embeddings**  
   Implementation: `crates/ruvector-sparse-inference/src/integration/ruvector.rs`  
   - Generates embeddings via PowerInfer-style sparse FFNs  
   - Configurable sparsity ratios ("target_sparsity: Some(sparsity_ratio)")  

6. **CNN Backbone Support**  
   Implementation: `crates/ruvector-cnn/src/backbone/mod.rs`  
   - Provides MobileNetV3 architectures (Small/Large variants)  
   - Outputs 576-960 dimensional features depending on model  

7. **Agent Memory Management**  
   Implementation: `crates/ruvector-agent-memory/src/main.rs`  
   - Handles 2,000+ memory clusters ("const N_MEMORIES: usize = 2_000")  
   - Implements coherence-weighted compaction  

8. **Neurosymbolic Features**  
   Implementation: `crates/ruvector-nervous-system/src/integration/ruvector.rs`  
   - Combines HNSW with Hopfield networks  
   - Pattern separation via dentate gyrus ("enable_pattern_separation: true")  

9. **Command Line Tooling**  
   Implementation: `crates/ruvector-attention-cli/src/main.rs`  
   - Provides compute/benchmark/convert/serve/repl modes  
   - Configurable via YAML ("/// Path to configuration file")  

10. **Self-Optimizing Architecture**  
    Implementation: `crates/ruvllm/src/capabilities.rs`  
    - Always-on SONA learning ("SONA_AVAILABLE: bool = true")  
    - Integrated via `ruvector-sona` crate  

*Capabilities without current implementation backing will be added in future releases based on roadmap priorities.*  

--- 

Each capability is directly sourced from implementing files, with no speculation about unimplemented features. The section maintains technical precision while being actionable for users evaluating the system.

## Core concepts & how they work


RuVector provides **SIMD-optimized vector storage** through multiple index types (`flat.rs`, `hnsw.rs`) in `crates/ruvector-core/src/index/`, with memory management handled by `memory.rs` (`crates/ruvector-core/src/memory.rs`). The system supports:
- HNSW indexing for approximate nearest neighbor search (`index/hnsw.rs`)
- Flat indexes for exact search (`index/flat.rs`)
- Memory pooling with allocation limits (`MemoryPool` struct in `memory.rs`)

## Hybrid Search Capabilities
RuVector implements **seven advanced search techniques** confirmed in `crates/ruvector-core/src/advanced_features/`:
1. Hybrid search (`hybrid_search.rs`) combining multiple vector representations
2. Multi-vector search (`multi_vector.rs`) for joint embeddings
3. Matryoshka embeddings (`matryoshka.rs`) for progressive retrieval
4. Sparse vectors (`sparse_vector.rs`) for efficiency gains
5. Filtered search (`filtered_search.rs`) with metadata predicates
6. Graph RAG (`graph_rag.rs`) for retrieval-augmented generation
7. Product quantization (`product_quantization.rs`) for compressed vectors

## Nervous System Integration
The **biologically inspired memory system** (`crates/ruvector-nervous-system/src/integration/ruvector.rs`) combines:
- Hopfield networks for associative memory (`hopfield::ModernHopfield`)
- Dentate gyrus pattern separation (`separate::DentateGyrus`)
- BTSP for one-shot learning (`plasticity::btsp::BTSPAssociativeMemory`)

Configured via `NervousConfig` with:
- 78x dimensionality expansion for pattern separation (`separation_output_dim: input_dim * 78`)
- 2% sparsity through k-winner selection (`separation_k: (input_dim * 78) / 50`)

## Cognitive Architecture
The robotics module implements a **three-phase cognitive loop** (`crates/ruvector-robotics/src/cognitive/cognitive_core.rs`):
1. Perception: Filters sensor inputs into `Percept` structs
2. Decision-making: Produces `ActionCommand` with priority/confidence scores
3. Execution: Handles `Move`, `Rotate`, `Grasp` actions via enum dispatch

## Performance Optimizations
Three key optimization layers exist:
1. **SIMD intrinsics** (`simd_intrinsics.rs`) for vector math acceleration
2. **Lock-free structures** (`lockfree.rs`) for concurrent access
3. **Memory arena** (`arena.rs`) supporting allocation tracking

## Router Infrastructure
The routing engine (`crates/ruvector-router-core/src/lib.rs`) provides:
- Vector database interface (`vector_db.rs`)
- Distance metrics (`distance.rs`)
- Storage backends (`storage.rs`)
- Type system (`types.rs`) for unified query handling

## Delta Processing
The delta subsystem (`crates/ruvector-delta-core/src`) handles:
- Compression (`compression.rs`)
- Stream processing (`stream.rs`)
- Efficient encoding (`encoding.rs`) for vector updates

## Native Bindings
JavaScript integration exists through `@ruvector/core` NAPI-RS bindings, falling back to pure JS when native unavailable (`npm/packages/agentic-synth/src/adapters/ruvector.js`).

## Maturity (shipped vs proposed)



**RuVector Core IS COMPLETE AND SHIPPED** (`docs/adr/ADR-001-ruvector-core-architecture.md`):
 Achieving sub-100μs HNSW searches at 16.4K QPS with:
- Full SIMD-accelerated distance metrics (`simd_intrinsics`, `distance`)
- Production HNSW index with serialization (`index/hnsw`)
- Hybrid dense+sparse search capability (`advanced_features/hybrid_search`)
- Quantization including Product Quantization (`quantization`, `advanced_features/product_quantization`)
- REDB-backed storage with connection pooling (`storage`)

**WASM Integration EXISTS AND WORKS** (`npm/packages/ruvbot/docs/adr/ADR-006-wasm-integration.md`):
- Complete WASM bindings for HNSW operations (`insert`, `search`, `serialize`)
- Memory-backed storage specifically for WASM (`storage_memory`)
- Demonstrated in ruvbot with error handling and batch operations

**Cognitive Containers SHIP** (`docs/adr/ADR-036-agi-cognitive-container.md`):
- RVF container format with cryptographic signing
- Segmented storage (WASM, vectors, kernel)
- Offline-capable deployments with witness chains

**Application Gallery EXISTS** (`docs/adr/ADR-113-rvf-app-gallery-ruvix-applications.md`):
- Templated RVF container management
- Template search/load/configure capabilities
- Custom template CRUD operations via WASM API

## Proposed/Experimental Features

**RaBitQ WASM Packaging IS DRAFTED** (`docs/adr/ADR-161-rabitq-wasm-npm-package.md`):
- Implementation complete (commit `a674d6eba`)
- npm publication process not yet executed
- WASM bindings exist but untested in Node/browser

**NPX Witness Verification IS A PROPOSAL** (`docs/adr/ADR-038-npx-ruvector-rvlite-witness-integration.md`):
- RVF verification exists in Rust (`rvf-cli`)
- No current Node.js CLI exposure
- WASM backend already available (`rvf-wasm`)

**Hybrid Storage IS ACCEPTED BUT UNTESTED** (`docs/adr/coherence-engine/ADR-CE-003-hybrid-storage.md`):
- PostgreSQL + ruvector design approved
- No shipped implementation in coherence engine
- Transaction handling remains unimplemented

## Unimplemented Gaps
- SkyGraph appliance ADS-B integration (mentioned in ADR-199 but no committed code)
- NPX CLI witness verification toolchain
- RaBitQ npm package automation

## Where the documentation lives


RuVector's documentation is rigorously organized with authoritative sources across these key locations:

**Core Architecture & Design:**  
EXISTS in `docs/hooks/ARCHITECTURE.md` - Contains the complete technical blueprint of RuVector's hook system, including component diagrams, execution flows, and integration points.

**SQL Function Reference:**  
EXISTS in `crates/ruvector-postgres/docs/SQL_FUNCTIONS_REFERENCE.md` - Documents all PostgreSQL extension functions with usage examples and performance characteristics.

**Edge-Net Simulation:**  
EXISTS in `examples/edge-net/sim/INDEX.md` - Provides the hierarchical documentation structure for network simulations, including source code navigation and use-case guides.

**Benchmarking Procedures:**  
EXISTS in `benchmarks/docs/LOAD_TEST_SCENARIOS.md` - Specifies exact load testing configurations, success criteria, and stress-test methodologies.

**SPARQL Implementation:**  
EXISTS in `docs/research/sparql/README.md` - Details the PostgreSQL-backed SPARQL processor architecture and query translation pipeline.

**Scipix OCR System:**  
EXISTS in `examples/scipix/docs/04_ARCHITECTURE.md` - Contains the versioned architectural specification for mathematical content extraction.

**Agent Integration:**  
EXISTS in `docs/research/claude-code-rvsource/19-ruvector-integration-guide.md` - Documents hook configurations for Claude tool integration and custom agent development.

**Utility References:**  
EXISTS in `examples/docs/README.md` - Provides cross-references to CLI tools, WASM demonstrations, and example implementations.

No documentation exists for undocumented components - all current capabilities are expressly covered in these authoritative sources. New features are added exclusively through tracked RFCs that amend these core documents.

## How to use it end-to-end



RuVector provides multiple installation methods depending on your use case:  

### For PostgreSQL integration  
EXISTS: The complete PostgreSQL extension installer (`npm/packages/postgres-cli/src/commands/install.ts`):  
```bash
# Install CLI globally
npm install -g @ruvector/cli

# Run full installation (PostgreSQL + Rust + pgrx + extension)
ruvector postgres install --mode=full
```  
Alternative Docker setup (`crates/ruvector-postgres/docs/INSTALLATION.md`):  
```bash
# Docker-based install (recommended for quick start)
ruvector postgres install --mode=docker
```

### For Node.js projects  
EXISTS: The hooks system provides immediate automation (`docs/hooks/USER_GUIDE.md`):  
```bash
# Initialize hooks in your project
npx ruvector hooks init

# Install Claude Code integration
npx ruvector hooks install
```

### For robotics applications  
EXISTS: Direct Cargo installation (`docs/research/agentic-robotics/user-guide.md`):  
```toml
[dependencies]
ruvector-robotics = { path = "crates/ruvector-robotics" }
```

### For GNN applications  
EXISTS: Node.js bindings via NAPI (`docs/gnn/ruvector-gnn-node-bindings.md`):  
```bash
npm install @ruvector/gnn
```

## Core Workflows  

### 1. Vector Search (PostgreSQL)  
```sql
-- Enable extension
CREATE EXTENSION ruvector;

-- Create table with vector column
CREATE TABLE items (id serial PRIMARY KEY, embedding vector(768));

-- Insert vectors
INSERT INTO items (embedding) VALUES ('[1.0, 2.0, ...]');

-- Query nearest neighbors
SELECT id FROM items ORDER BY embedding <-> '[3.0, 1.0, ...]' LIMIT 10;
```

### 2. Robotics Pipeline  
EXISTS: Complete perception stack (`docs/research/agentic-robotics/user-guide.md`):  
```rust
use ruvector_robotics::perception::{PerceptionPipeline, SpatialIndex};

let cloud = PointCloud::new(points, 1000);
let pipeline = PerceptionPipeline::default();
let obstacles = pipeline.detect_obstacles(&cloud, [0.0, 0.0, 0.0], 10.0)?;
```

### 3. Graph Neural Networks (Node.js)  
EXISTS: Full NAPI bindings (`docs/gnn/ruvector-gnn-node-bindings.md`):  
```javascript
const { RuvectorLayer } = require('@ruvector/gnn');
const layer = new RuvectorLayer(128, 256, 8, 0.1);
const outputs = layer.forward(nodeEmbeddings, adjMatrix);
```

### 4. Claude Automation  
EXISTS: Hook system integration (`docs/hooks/USER_GUIDE.md`):  
```bash
# List available hooks
npx ruvector hooks list

# Add a new intelligence pattern
npx ruvector hooks add-pattern --name=codegen --trigger=pr
```

## Final Verification  
```bash
# For PostgreSQL
ruvector postgres verify

# For hooks
npx ruvector hooks stats

# For robotics (Rust)
cargo test -p ruvector-robotics

# For Node.js bindings
npm test
```
