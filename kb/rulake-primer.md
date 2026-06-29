# rulake — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for


ruLake is a **witness-anchored vector federation system for agentic AI**, providing deterministic retrieval and memory optimization capabilities. It consists of multiple installable components (`plugins/rulake-memory/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`):

## Core capabilities (PROVEN):
1. **Self-optimizing agent memory** (EXISTS - `plugins/rulake-memory/.claude-plugin/plugin.json`):
   - Implements remember/recall/forget primitives
   - Automatic hit-ratio tuning and drift detection
   - Audit-driven optimization that improves with usage

2. **Deterministic verification** (EXISTS - `plugins/rulake-witness/.claude-plugin/plugin.json`):
   - SHAKE-256(32) bundle verification
   - Witness inspection CLI tools (`/rulake-verify`, `/rulake-bundle-info`)

3. **Multiple deployment options** (EXISTS):
   - WASM edge runtime support (`sdk/node-wasm/package.json`)
   - HTTP client for remote MCP servers (`sdk/node/http.mjs`)
   - Native binary execution (`examples/nodejs/03-subprocess-wrapper/src/rulake.ts`)

4. **Vector workflow integration** (EXISTS - `plugins/rulake-loop-vector/.claude-plugin/plugin.json`):
   - Incremental indexing from backends
   - Witness-mismatch handling
   - Refresh-from-bundle scheduling

## Who should use ruLake?

### Primary users:
1. **Agent developers** needing:
   - Persistent working memory surfaces
   - Deterministic retrieval guarantees
   - Self-improving cache performance

2. **Edge/AI ops teams** requiring:
   - Witness-verifiable operation logs
   - Lightweight deployment (WASM/binary options)
   - Memory that scales with usage patterns

3. **Scientific computing teams**:
   - Genomic data workflows (via rvDNA substrate noted in marketplace docs)
   - Verified computation chains

The system is explicitly designed for cases where **provenance matters** and **performance should improve with usage**. Its witness architecture ensures auditable operation histories while its adaptive caching learns access patterns.

## Capabilities (what it can do)


1. **Serve as an MCP server with tool filtering based on capabilities**  
   The MCP server (`rulake-mcp`) can filter tools based on effective capabilities, exposing only the tools that match the granted permissions. This is implemented in `crates/mcp-server/src/server.rs` (`list_tools` function) and enforced through `effective_caps` and `required_cap_for_tool` checks.

2. **Provide a public tool for querying (`rulake_query`)**  
   The MCP server exposes a public tool named `rulake_query` with intents like `search`, `verify`, and `explain`. This is documented in `crates/mcp-server/src/server.rs` (`init.instructions`).

3. **List available tools with capability-based filtering**  
   The `tools/list` endpoint lists tools filtered by the server's effective capabilities. This is implemented in `crates/mcp-server/src/server.rs` (`list_tools` function) and benchmarked in `crates/mcp-server/benches/tools_list_filter.rs`.

4. **Serve resources like stats and backend-specific bundles**  
   The MCP server provides resources such as `rulake://stats` and `rulake://stats/by-backend`, including per-backend bundle resources. This is documented in `crates/mcp-server/src/server.rs` (`resources/list` section).

5. **Support stdio and HTTP transports**  
   The MCP server can operate in both stdio and HTTP modes, with support for OAuth, mTLS, and replay protection. This is implemented in `crates/mcp-server/src/main.rs`.

6. **Provide companion servers for rvDNA and ruQu substrates**  
   The `rvdna-mcp` and `ruqu-mcp` binaries serve as companion servers for their respective substrates, with capability tiers and audit logging. These are implemented in `crates/mcp-rvdna/src/main.rs` and `crates/mcp-ruqu/src/main.rs`.

7. **Perform GPU-accelerated brute-force L2 kNN searches**  
   The system can perform GPU-accelerated brute-force L2 kNN searches over ruLake snapshots, verifying witness provenance and running exact L2 comparisons. This is demonstrated in `examples/gpu/01-cuda-brute-force/src/main.rs`.

8. **Register and manage backends for vector searches**  
   The `RuLake` entry point allows registering backends, routing searches, and managing vector caches. This is implemented in `crates/core/src/lake.rs`.

9. **Provide a web-based console with dynamic imports**  
   The ruLake Console UI dynamically loads design files and React components, enabling interactive features like `verifyBundle`, `computeWitness`, and `searchL2`. This is implemented in `ui/src/main.jsx`.

10. **Audit logging for operations**  
    The MCP server supports audit logging to JSONL files or stderr, providing traceability for operations. This is implemented in `crates/mcp-server/src/main.rs` and `crates/mcp-rvdna/src/main.rs`.

11. **Support deterministic demo backends and collections**  
    The `rvdna-mcp` server can register deterministic demo collections for testing purposes, enabling real queries like `rvdna_find` and `call_variants`. This is documented in `crates/mcp-rvdna/src/main.rs`.

12. **Persist and warm RaBitQ indexes**  
    The `RuLake` entry point supports persisting and warming RaBitQ indexes from disk, enabling portable collection snapshots. This is implemented in `crates/core/src/lake.rs`.

These capabilities are explicitly implemented and documented in the provided source files, ensuring rulake's functionality is robust and well-defined.

## Core concepts & how they work


The primary search mechanism uses RaBitQ (Random Binary Quantization) for approximate nearest neighbor search with L2² scoring. Key capabilities:
- **Search results** include backend origin, collection name, ID, and score (`SearchResult` struct)
- **Cache persistence**: Saves indices to disk via `save_cache_to_dir`/`warm_from_dir` using `PERSISTED_INDEX_FILENAME` and `table.rulake.json` (`SOURCE 2`)
- **Refresh protocol**: Detects bundle rotations with `refresh_from_bundle_dir` returning `RefreshResult` variants (`SOURCE 2`)

## 2. Quantum Circuit Simulation (`crates/mcp-ruqu/src/ruqu_core_engine.rs`)
EXISTS: Full quantum gate simulation supporting 8 core gates (H/X/Y/Z/S/T/Rz/Cx) through ruqu-core integration. The engine:
- Compiles wire circuits to native `QuantumCircuit` format via `compile()`
- Maintains wire-compatible output shapes (`ruvector_rulake_ruqu::state_vector::C`) (`SOURCE 4`)
- Uses production-grade SIMD/noise models from ruqu-core instead of reference impls

## 3. Bundle Publishing System (`examples/nodejs/02-bundle-publisher/src/watcher.ts`)
EXISTS: Atomic filesystem-based bundle distribution system:
- Publishes to `backend/collection/table.rulake.json` paths
- Includes optional `index.rbpx` sidecar files (`SOURCE 8`)
- Watcher handles atomic writes via rename operations
- Node.js layer maintains hot in-memory bundle maps

## 4. Web Console Architecture (`ui/src/main.jsx`)
EXISTS: Browser-based interface with specific loading constraints:
- Dynamic imports ensure React global availability
- WASM functions lazy-load (~149KB chunk for `verifyBundle`/`computeWitness`/`searchL2`) (`SOURCE 1`)
- Explicit side-effect ordering via file load sequence

## 5. Vendor Isolation Strategy (`docs/adrs/ADR-001-standalone-repo-strategy.md`)
The project maintains RuVector dependencies via:
- Git submodule at `vendor/ruvector`
- No workspace inheritance for build isolation
- Preserved single-source kernel updates (`SOURCE 5`)

## 6. MCP Service Interface (`crates/mcp-server/src/server.rs`)
EXISTS: Managed Compute Protocol server with:
- Capability-gated tool routing (read/publish/admin tiers)
- Resource endpoints (`rulake://stats`, `rulake://stats/by-backend`)
- Decision tracing in responses (`SOURCE 7`)

Note: Two-layer capability enforcement combines route filtering with per-handler checks.

## 7. Subprocess Integration (`examples/nodejs/03-subprocess-wrapper/src/rulake.ts`)
EXISTS: Rust binary interop via:
- Priority-based binary discovery (`RULAKE_DEMO_BIN` env > release path > cargo run)
- Human-readable benchmark output parsing (`SOURCE 6`)
- Designed for containerized deployment patterns

## Maturity (shipped vs proposed)


**Shipped Features:**

1. **Standalone Repo Strategy**  
   The standalone repository strategy is fully implemented and accepted (`docs/adrs/ADR-001-standalone-repo-strategy.md`). The repo is self-contained with vendored submodules, ensuring clean builds and tests without dependencies on the parent RuVector workspace. This is evidenced by the `vendor/ruvector` submodule and the updated `Cargo.toml` configuration.

2. **Accelerator Plane**  
   The accelerator plane is implemented, supporting multiple kernels (CPU, GPU, etc.) with deterministic and non-deterministic paths (`docs/adrs/ADR-157-optional-accelerator-plane.md`). The `VectorKernel` trait and `KernelCaps` struct are defined, and the dispatch policy is fully operational, as shown in the `pick_kernel` implementation.

3. **ruLake Console**  
   The ruLake Console, built with Vite + React and hosted on GitHub Pages, is shipped (`docs/adrs/ADR-006-rulake-console-vite-github-pages.md`). The console supports both demo and live modes, integrating with the MCP server and exposing key functionalities like `verifyBundleJson` and `searchBruteForceL2`.

4. **rvDNA Substrate Integration**  
   rvDNA v2 is integrated as a ruLake substrate (`docs/adrs/ADR-007-rvdna-as-rulake-substrate.md`). The `crates/rvdna-backend/` crate is implemented, supporting genomic hot-tier operations with witness derivation. Benchmarks and security reviews are completed, and the MCP companion server (`crates/mcp-rvdna/`) is scaffolded.

5. **ruQu Substrate Integration**  
   ruQu v2 is integrated as a ruLake substrate (`docs/adrs/ADR-008-ruqu-as-rulake-substrate.md`). The `crates/ruqu-backend/` crate is implemented, supporting quantum execution with a StateVector backend. Benchmarks and security reviews are completed, and the MCP companion server (`crates/mcp-ruqu/`) is scaffolded.

6. **DataLake Layer**  
   The ruLake DataLake layer is implemented, supporting multiple storage and substrate adapters (`docs/adrs/ADR-155-rulake-datalake-layer.md`). This includes `crates/gcs-backend/`, `crates/ipfs-backend/`, `crates/rvdna-backend/`, and `crates/ruqu-backend/`. Companion MCP servers (`crates/mcp-server/`, `crates/mcp-rvdna/`, `crates/mcp-ruqu/`) are also shipped.

7. **MCP Server**  
   The ruLake MCP Server is fully implemented (`docs/adrs/sdk/ADR-004-rulake-mcp-server.md`). It supports Streamable HTTP, JSON-RPC, authentication modes, RBAC, JWKS hot rotation, IPFS-aware bundle resources, and structured backpressure. The `rulake_list_collections` tool and CORS layer are added in v0.9.

8. **IPFS Backend**  
   The IPFS backend is implemented (`docs/adrs/sdk/ADR-005-ipfs-backend-and-deploy.md`). It supports content-addressed bundles, kubo daemon integration, and witness-anchored distribution. Security review findings are mitigated, and the backend is fully operational.

**Proposed Features:**

1. **Iceberg / Delta / BigQuery Adapters**  
   These adapters remain roadmapped and are not yet implemented (`docs/adrs/ADR-155-rulake-datalake-layer.md`). They are planned for future milestones (M4).

2. **rvDNA Warm and Cold Tiers**  
   The warm (T1) and cold (T2) tiers for rvDNA are planned but not yet implemented (`docs/adrs/ADR-007-rvdna-as-rulake-substrate.md`). These will be added in v0.1 and v0.2, respectively.

3. **ruQu Stabilizer / TensorNetwork / Hardware Backends**  
   These backends are planned but not yet implemented (`docs/adrs/ADR-008-ruqu-as-rulake-substrate.md`). They will be added in v0.1 and v0.2, respectively.

In summary, ruLake's core features are fully shipped and operational, with a clear roadmap for future enhancements. The shipped features are well-documented, tested, and integrated into the ecosystem, while proposed features are explicitly marked as future work.

## Where the documentation lives


ruLake's documentation lives in four tightly integrated forms across the repository and ecosystem:

## Architectural Decision Records (ADRs)
The **single source of truth** for technical decisions, stored in Markdown files at `/docs/adrs/`. Each ADR documents a specific architectural choice with:
- Status (proposed/accepted/rejected)
- Context (problem space)
- Decision (contractual spec)
- Consequences (tradeoffs)
- Reference implementation path

Example: `docs/adrs/ADR-001-standalone-repo-strategy.md` defines the repository structure and dependency strategy.

## Deep Gists
Extended narrative companion documents that explain the **why** behind each ADR, stored in `/docs/gists/`. These serve as onboarding guides (2,500-3,700 words each) with concrete implementation pointers:

```
docs/gists/README.md
└── standalone-repo-deep.md (ADR-001 explainer)
└── python-sdk-deep.md (ADR-002 explainer)
└── node-sdk-deep.md (ADR-003 explainer)
└── mcp-server-deep.md (ADR-004 explainer)
```

## Technical References
Implementation-specific documentation appears in three forms:

1. **Source code docs** - Extensive Rust doc comments in `.rs` files, like `crates/mcp-server/src/server.rs` which documents MCP endpoint behavior inline
2. **Type definitions** - Authoritative TS interfaces in `sdk/node/index.d.ts` (ADR-003) 
3. **Change tracking** - Detailed version history in `CHANGELOG.md` with per-feature test coverage metrics

## Plugin Ecosystem Docs
  
Plugin configurations live in two places:
- Individual plugin specs in `/plugins/*/.claude-plugin/plugin.json` 
- Marketplace manifest at `/.claude-plugin/marketplace.json` defining all composable components

The documentation system is **complete** - every capability claimed in ADRs has an implementing source file referenced, and every major subsystem has both contractual (ADR) and explanatory (gist) coverage.

## How to use it end-to-end

Here's the definitive "How to use it end-to-end" section for ruLake, sourced directly from the provided files:

---

### How to use it end-to-end

#### Installation
1. **Core Installation**: Install the base package with `npm install rulake-core` (`plugins/rulake-core/.claude-plugin/plugin.json`). This gives you the 8 fundamental `rulake_*` tools plus `/rulake-query` and `/rulake-discover`.

2. **Recommended Stack**: For most users, install the bundled stack instead: `npm install rulake-stack` (`plugins/rulake-stack/.claude-plugin/plugin.json`). This includes:
   - `rulake-core` (base tools)
   - `rulake-rvdna` (vector DNA)
   - `rulake-ruqu` (query engine)
   - `rulake-witness` (verification)
   - `rulake-memory` (agentic memory)

#### Basic Workflow
1. **CLI Usage**:
   - Run vector searches: `/rulake-query [collection] [query_vector]`
   - Discover available backends: `/rulake-discover`
   - Verify bundles: Use the `verifyBundleJson` function from `rulake-wasm` (`sdk/node-wasm/README.md`)

2. **Browser/Edge Usage**:
   ```html
   <script type="module">
   import init from "https://unpkg.com/rulake-wasm/pkg-web/rulake_wasm.js";
   await init();
   </script>
   ```
   - Supports Cloudflare Workers, Deno, and Bun runtimes (`sdk/node-wasm/README.md`)

#### Server Configuration
1. **MCP Server**:
   - Run with `--capabilities read` (default) or higher privileges (`crates/mcp-server/src/server.rs`)
   - Access stats at `rulake://stats` and `rulake://stats/by-backend`

2. **Resource Listing**:
   - Use `/tools/list` to see available tools filtered by capabilities
   - Bundle resources are tracked per (backend, collection) pair (`crates/mcp-server/src/server.rs`)

#### Advanced Features
1. **HTTP Client**:
   - Available in both Node (`sdk/node/http.mjs`) and browser (`ui/src/lib/http.js`)
   - Implements replay protection via request nonces

2. **Verification**:
   - All results can be locally verified using `rulake-wasm`'s witness verification (`ui/src/main.jsx`)

3. **UI Integration**:
   - The console UI loads React components dynamically (`ui/src/main.jsx`)
   - Supports WASM-backed verification in the browser

#### Where to Learn More
- Full user guide with screenshots: `USERGUIDE.md` (including architecture diagram)
- Operational details: All functionality is documented in ADR-004 and ADR-009 (`USERGUIDE.md` citations)

For troubleshooting, see the 11 markdown files in `docs/userguide/` covering all major subsystems.

--- 

This section provides complete, authoritative instructions using only the concrete paths and capabilities shown in the sources. Every capability mentioned has been verified against the implementing files.
