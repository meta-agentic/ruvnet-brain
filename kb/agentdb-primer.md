# agentdb — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What AgentDB is & who it's for**

AgentDB is a cognitive database system for intelligent agents, combining vector search, graph relationships, and explainable memory with enterprise-grade security. It exists today as a validated production-ready system (`docs/VALIDATION-COMPLETE.md`) with core capabilities implemented across multiple plugins:

1. **Hybrid Vector/Graph Storage**  
   Stores both vector embeddings (`plugins/agentdb-core/commands/agentdb.md`) and n-ary hyperedges (`plugins/agentdb-graph/skills/agentdb-hyperedge/SKILL.md`), with Rust-optimized operations reaching 25K-50K ops/sec (`docs/VALIDATION-COMPLETE.md`).

2. **Explainable Search**  
   Returns feature attributions for matches (`plugins/agentdb-search/skills/agentdb-explainable-recall/SKILL.md`), showing which dimensions or keywords drove each result.

3. **CRUD Operations**  
   Provides insert/search/delete tools (`docs/guides/MIGRATION_v1.2.2.md`) with batched inserts 141x faster than sequential (`agentdb_insert_batch`).

4. **Management Interfaces**  
   Includes a browser-based IDE for SQL queries, vector management, and schema design (`ui/public/agentdb/examples/browser/management-ide/index copy.html`).

**Who it's for:**  
- **Agent developers** needing durable memory with semantic search  
- **Debugging teams** auditing recall quality (`agentdb-explainable-recall`)  
- **Systems requiring auditability** through feature attributions  
- **Mission-critical deployments** leveraging validated security fixes (`docs/legacy/SECURITY-SUMMARY.md`  

Capabilities *not* found in current sources:  
- Native time-series analytics  
- Automatic agent orchestration  
- Image/audio vectorization  

All cited features exist in the codebase today with paths provided. For implementation details, see the validation report (`38/41 tests passing`) or browse the IDE example UI.

## Capabilities (what it can do)

## Capabilities (what it can do)

AgentDB provides comprehensive agent memory and cognitive capabilities with these CORE features:

### 1. Multi-backend vector storage with automatic fallback  
EXISTS in `src/backends/index.ts`:  
- Supports RuVector (150x faster) and HNSWLib backends  
- Implements automatic detection and fallback logic  
- Exposes unified `VectorBackend` interface for all operations  

### 2. Relational + vector hybrid storage  
EXISTS in `src/core/AgentDB.ts`:  
- Combines SQLite (WASM/better-sqlite3) with vector search  
Prepares unified schemas via `initializeDatabase()` and `loadSchemas()`  

### 3. Controller-based cognitive modules  
EXISTS in `src/controllers/prerequisites.ts`:  
- Manages dependencies for:  
  - `ReflexionMemory`  
  - `SkillLibrary`  
  - `CausalMemoryGraph`   
  - `EmbeddingService`  
Documents safety levels (`pure`, `opens-resource`, etc.)  

### 4. Production MCP protocol server  
EXISTS in `src/mcp/agentdb-mcp-server.ts`:  
- Exposes vector operations via Model Context Protocol  
- Integrates with Claude Desktop using stdio transport  
- Runs schema initialization and core services  

### 5. Comprehensive benchmarking  
EXISTS in `src/benchmark/index.ts`:  
- Measures:  
  - Vector insert/search latency  
  - Memory usage  
  - Concurrency scaling  
- CLI/API reporting with Markdown/JSON formats  

### 6. Advanced pattern management  
EXISTS in `ui/public/agentdb/examples/browser/management-ide/pattern-enhancements.js`:  
- Bulk operations (select/delete/export)  
- Analytics (usage stats, clustering)  
- Visualization (graphs, embedding space)  
- Auto-tagging and recommendation engine  

Capabilities NOT currently shown in sources:  
- Native graph database integration  
- Distributed query execution  
- On-device training pipelines

## Core concepts & how they work

# Core Concepts & How They Work

AgentDB is built around several foundational concepts that work together to provide high-performance agent memory and reasoning capabilities. Here are the key components:

## 1. Unified Vector Database (`src/core/AgentDB.ts` / `src/backends/index.ts`)
AgentDB provides a unified interface for vector operations with:
- Automatic backend selection between RuVector and HNSWLib (`src/backends/factory.js`)
- Built-in SQLite storage with sql.js WASM or better-sqlite3 fallback (`src/core/AgentDB.ts`)
- Default 384-dimensional embedding support optimized for MiniLM (`src/core/AgentDB.ts` vectorDimension config)
- Production-ready performance (verified 150x faster than SQLite brute-force search in `simulation/reports/core-benchmarks.md`)

## 2. Causal Memory Graph (`src/mcp/agentdb-mcp-server.ts`)
The system maintains a causal relationship graph that:
- Tracks cause-effect relationships between memories (`src/mcp/agentdb-mcp-server.ts` CausalMemoryGraph)
- Supports A/B experiment recording and analysis (via CLI commands in `src/cli/agentdb-cli.ts`)
- Provides experimental causal discovery ("agentdb learner run" in CLI)

## 3. Vector Search Subsystem (`src/backends/index.ts`)
AgentDB implements high-performance similarity search with:
- Multiple backend options (RuVector/HNSWLib) (`src/backends/index.ts`)
- Verified throughput of 1,000+ searches/second (`simulation/reports/core-benchmarks.md`)
- Batch operations support (`src/mcp/agentdb-mcp-server.ts` BatchOperations)

## 4. Controller Architecture (`src/core/AgentDB.ts`)
The system coordinates multiple specialized controllers:
- ReflexionMemory for self-improvement capabilities (`src/core/AgentDB.ts`)
- SkillLibrary for learned behavior storage (`src/core/AgentDB.ts`)
- CausalMemoryGraph for relationship tracking (`src/core/AgentDB.ts`)
- EmbeddingService for vector operations (`src/core/AgentDB.ts`)

## 5. Production-Grade Features (`benchmarks/runner.ts` / `src/mcp/agentdb-mcp-server.ts`)
The system includes enterprise-ready capabilities:
- Multi-threaded ACID-compliant operations (`simulation/reports/core-benchmarks.md`)
- MCP protocol server for desktop integration (`src/mcp/agentdb-mcp-server.ts`)
- Comprehensive benchmarking utilities (`benchmarks/runner.ts`)

Note: Some initialization workflows currently require CLI usage before programmatic access (as noted in `examples/quickstart.js`), though this will be streamlined in future versions.

## Maturity (shipped vs proposed)

### Maturity (shipped vs proposed)

AgentDB demonstrates a high level of maturity, with many features already shipped and actively used in production. Below is a breakdown of the shipped vs proposed features, supported by concrete evidence from the source files.

#### Shipped Features (Production-Ready)

1. **Hyperbolic Geometry Operations**  
   - EXISTS: Fully implemented and documented.  
   - Features include exponential map, Poincaré distance, dual-space search, and hyperbolic centroid.  
   - Implementation: `/workspaces/agentic-flow/packages/agentdb/src/cli/commands/hyperbolic.ts` (`docs/CLI-ENHANCEMENTS-ADR-002.md`).

2. **Attention Mechanisms**  
   - EXISTS: Flash attention, hyperbolic attention, sparse attention, linear attention, and performer attention are fully integrated.  
   - Implementation: `/workspaces/agentic-flow/packages/agentdb/src/cli/commands/attention.ts` (`docs/CLI-ENHANCEMENTS-ADR-002.md`).

3. **Advanced Browser Features**  
   - EXISTS: Includes HNSW (Hierarchical Navigable Small World), Graph Neural Networks (GNN), Maximal Marginal Relevance (MMR), and Tensor Compression (SVD).  
   - Implementation: `AdvancedFeatures.ts` (`docs/reports/BROWSER_ADVANCED_FEATURES_COMPLETE.md`).

4. **RVF Backend Integration**  
   - EXISTS: Fully functional RVF backend with 20+ methods wired, including `embedKernel`, `extractKernel`, and `verifyWitness`.  
   - Implementation: `src/backends/rvf/RvfBackend.ts` (`docs/adrs/ADR-008-chat-ui-rvf-kernel-embedding.md`).

5. **AgentDB Status Skill**  
   - EXISTS: Provides live state reporting for AgentDB, including pattern count, hit rate, and learning gain.  
   - Implementation: `plugins/agentdb-core/skills/agentdb-status/SKILL.md`.

#### Proposed Features (Not Yet Shipped)

1. **RVF Native Format Integration**  
   - STATUS: Proposed.  
   - Aims to replace the current binary format with RVF for crash safety and progressive indexing.  
   - Source: `docs/adrs/ADR-003-rvf-native-format-integration.md`.

2. **RuVector WASM Advanced Training Components**  
   - STATUS: Partially implemented.  
   - Includes curriculum learning scheduler and hard negative mining, but not yet fully integrated.  
   - Source: `docs/adrs/ADR-002-ruvector-wasm-integration.md`.

3. **Self-Contained RVF Chat UI Package**  
   - STATUS: Proposed.  
   - Aims to embed a chat UI within a single `.rvf` file using existing RVF backend capabilities.  
   - Source: `docs/adrs/ADR-008-chat-ui-rvf-kernel-embedding.md`.

#### Summary
AgentDB is a mature system with a robust set of shipped features, particularly in hyperbolic geometry, attention mechanisms, and advanced browser capabilities. Proposed features, such as RVF native format integration and advanced WASM training components, are well-documented and grounded in existing codebase audits but remain in the planning or partial implementation stages.

## Where the documentation lives

# Where the documentation lives

AgentDB's documentation is systematically organized across multiple directories with clear versioning and purpose. Here's the authoritative breakdown:

## Core Documentation (`docs/`)
The primary documentation hub exists in `/docs/` with these verified categories:

1. **Guides**
   - Migration guides (`/docs/guides/MIGRATION_v1.2.2.md`)
   - SDK usage (`/docs/guides/SDK_GUIDE.md`)
   - Browser deployment (`/docs/guides/BROWSER_V2_MIGRATION.md`)
   - Frontier memory patterns (`/docs/guides/FRONTIER_MEMORY_GUIDE.md`)

2. **Implementation Details**
   - RuVector integration (`/docs/implementation/RUVECTOR_BACKEND_IMPLEMENTATION.md`)
   - WASM acceleration (`/docs/implementation/WASM-VECTOR-ACCELERATION.md`)
   - Core tools (`/docs/implementation/CORE_TOOLS_IMPLEMENTATION.md`)

3. **Performance Reports**
   - Latency benchmarks (`/docs/integration/PERFORMANCE-SUMMARY.md`)
   - Alpha release metrics (`/docs/validation/ALPHA_RELEASE_ISSUE.md`)

## Simulation Documentation (`simulation/docs/`)
The simulation system has dedicated docs:

- Interactive wizard guide (`/simulation/docs/guides/WIZARD-GUIDE.md`)
- CLI reference (`/simulation/docs/guides/CLI-REFERENCE.md`)
- Architecture details (`/simulation/docs/architecture/SIMULATION-ARCHITECTURE.md`)

## UI Component Documentation
- Settings modal specifications (`/ui/docs/settings-modal-documentation.md`)

## Audit Trails
- Documentation accuracy reports (`/docs/legacy/DOCUMENTATION-ACCURACY-AUDIT.md`)

Documentation is version-controlled with clear timestamps (e.g., "Last Updated: 2025-11-30" in `/simulation/docs/README.md`) and cross-referenced via comprehensive indexes.

## How to use it end-to-end

# How to use it end-to-end

## Installation
AgentDB installs as a standard npm package with zero native dependencies (`scripts/postinstall.cjs` verifies this). Run:

```bash
npm install agentdb@latest
```

The package includes:
- WASM SQLite backend (645KB production bundle per `ui/plan/08-AGENTDB-v1.0.1-UPDATES.md`)
- Core vector operations (init/insert/search/delete)
- Full offline capability

## Initialization
Create a database instance (`docs/guides/MIGRATION_v1.2.2.md` shows the exact schema):

```javascript
import { createVectorDB } from 'agentdb';

const db = await createVectorDB({
  db_path: './my-agent.db', // Path for persistence
  memoryMode: false // Set true for in-memory only
});
```

## Core Operations
### 1. Insert Data
Single insert with automatic embedding generation (`docs/guides/MIGRATION_v1.2.2.md`):

```javascript
await db.executeTool('agentdb_insert', {
  text: "Implement OAuth2 with PKCE flow",
  tags: ["auth", "security"],
  metadata: { priority: "high" }
});
```

Batch insert for efficiency (141x faster than sequential per `tests/docker/test-clean-install.mjs`):

```javascript
await db.executeTool('agentdb_insert_batch', {
  items: [
    {text: "JWT auth guide", tags: ["auth"]},
    {text: "Redis caching", tags: ["performance"]}
  ],
  batch_size: 100 // Optimized chunk size
});
```

### 2. Semantic Search
Find relevant content with hybrid search (vector + keyword):

```javascript
const results = await db.executeTool('agentdb_search', {
  query: "secure authentication methods",
  limit: 5,
  filters: {
    tags: ["auth"],
    metadata: { priority: "high" }
  }
});
```

## Monitoring
Enable built-in health checks (`simulation/docs/guides/DEPLOYMENT.md`):

```bash
export AGENTDB_LATENCY_THRESHOLD=1000 # Alert threshold in ms
agentdb simulate --monitor
```

## Browser Usage
For web apps, use the pre-minified bundle (22.29KB gzipped per `docs/reports/MINIFICATION_FIX_COMPLETE.md`):

```html
<script src="https://unpkg.com/agentdb@latest/dist/agentdb-advanced.min.js"></script>
<script>
  AgentDB.createVectorDB({ memoryMode: true }).then(db => {
    // Use same API as Node.js
  });
</script>
```

## Validation
All core capabilities are production-validated (`docs/VALIDATION-COMPLETE.md`):
- Vector ops: 25K-50K ops/sec
- Batch inserts: 100K ops/sec
- ACID transactions
- Full backward compatibility

For advanced use cases like manufacturing coordination or healthcare ops, see real-world implementations in `simulation/reports/use-cases-applications.md`.
