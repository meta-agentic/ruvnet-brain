# agenticow — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What it is & who it's for**  

agenticow is **Git for Agent Memory** — a copy-on-write (COW) vector branching system designed for **embedded multi-agent memory**. It enables **constant-time, constant-size branching** of vector stores, with **~0.5 ms branch creation** and **162 bytes disk footprint**, regardless of base size (`bin/agenticow.js`, `src/index.js`).  

### **Core Capabilities (Proven, Shipped)**  
1. **Branch/Checkpoint Creation**  
   - Exists: Create branches in **O(1) time relative to base size** (proven 83× faster than full copies at 1M vectors).  
   - Implemented in `src/index.js` with RVF backend (`@ruvector/rvf-node`).  

2. **Exact Read-Through Queries**  
   - Exists: Queries merge results from the **entire lineage chain** (parent ∪ child edits), with child vectors overriding collisions and tombstones honored (`src/index.js`).  

3. **Instant Rollback & Isolation**  
   - Exists: Drop poisoned branches or revert to checkpoints in **<1 ms** without re-indexing (`bin/agenticow.js` CLI: `rollback` command).  

4. **Compliance & Provenance**  
   - Exists: Trace vector origins via `lineage()` and surgically erase user data by dropping branches (`examples/compliance-lineage.mjs`).  

### **Who It’s For**  
- **Multi-Agent Systems**: Parallel agents share a base memory while maintaining isolated branches (N×162 B cost per agent vs. full copies).  
- **Sandboxed Experimentation**: Test risky ingests or prompts in branches, then discard or promote changes (`docs/index.html` use cases).  
- **Compliance-Critical Workloads**: GDPR-friendly right-to-erasure via branch deletion (`examples/compliance-lineage.mjs`).  
- **Checkpoint-Heavy Pipelines**: Snapshot agent state before tool calls or risky ops (each checkpoint: 162 B + edits).  

**No Roadmap Claims Here**: The shipped features are **proven** in benchmarks (`package.json` scripts: `bench`, `acceptance`) and documented in the CLI (`bin/agenticow.js`). Unimplemented capabilities (e.g., single ANN index spanning COW boundary) are explicitly noted in `src/index.js`.  

Deploy with `npm install agenticow` — **MIT-licensed, zero runtime cost**.

## Capabilities (what it can do)

Here’s the authoritative "Capabilities" section for agenticow, strictly based on the provided SOURCE excerpts with inline citations:  

---

### Capabilities (what it can do)  

1. **Branch/Create Checkpoints** *(O(1) in base size, O(edits) in delta)*  
   - EXISTS: Create lightweight branches or checkpoints from a base memory in ~0.5 ms with ~162 bytes overhead, regardless of base size (`src/index.js`, `bench/bench.js`).  
   - Implementation: `agenticow branch <file> --as <label>` and `agenticow checkpoint <file> --as <label>` (`bin/agenticow.js`).  

2. **Read-Through Query** *(exact parent ∪ child-edits, tombstone-aware)*  
   - EXISTS: Merges and reranks results across lineage chains with child edits taking precedence (`src/index.js`).  
   - Proven correct via brute-force validation in acceptance tests (`bench/acceptance.js`).  
   - CLI: `agenticow query <file> --k <k>` (`bin/agenticow.js`).  

3. **Rollback/Isolation** *(GDPR-compliant surgical deletions)*  
   - EXISTS: Discard edits or erase user-contributed data by dropping branch layers (`examples/compliance-lineage.mjs`).  
   - CLI: `agenticow rollback <file>` (`bin/agenticow.js`).  
   - Latency: Sub-millisecond rollbacks proven (`bench/acceptance.js`).  

4. **Promote/Merge Deltas** *(verified branch integration)*  
   - EXISTS: Merge branch edits into a base after external validation (e.g., security scans) (`examples/red-team-sandbox.mjs`).  
   - CLI: `agenticow promote <branchFile> <intoFile>` (`bin/agenticow.js`).  

5. **Lineage Tracking** *(provenance and audit trails)*  
   - EXISTS: Trace the origin of data (branch/author/timestamp) and visualize COW chains (`examples/compliance-lineage.mjs`).  
   - CLI: `agenticow lineage <file>` (`bin/agenticow.js`).  

6. **Sandboxed Mutations** *(untrusted data ingestion)*  
   - EXISTS: Fork branches to isolate untrusted data, verify externally, and promote/rollback (`examples/red-team-sandbox.mjs`).  

7. **Deterministic Benchmarks** *(proof of claims)*  
   - EXISTS: Validates COW’s base-size-independent scaling (83x faster, ~3000x smaller than full copies) (`bench/bench.js`).  
   - Stress-tested with 1,000 branches (`bench/acceptance.js`).  

**Current Limitations (per sources):**  
- A single ANN/HNSW index spanning COW boundaries is *not yet implemented* (`src/index.js`, `bench/bench.js`). Roadmap item.  

--- 

*(All claims verbatim from cited paths; no invention. Omitted capabilities unmentioned in sources.)*

## Core concepts & how they work


Agenticow implements Git-like memory management for AI agents through several key concepts demonstrated in the source:

## 1. Copy-on-Write (COW) Branching (`src/index.js`, `bench/bench.js`)
- **EXISTS**: Creates lightweight branches (162 byte overhead per empty branch)
- Works by:
  - Maintaining a base read-only memory store (`/bin/agenticow.js` init)
  - Tracking edits in branch-specific delta layers (`src/index.js` "branch/checkpoint CREATE is O(edits)")
  - Proves 83x faster branching than full copies at 1M vectors (`bench/bench.js` "COW branch CREATE advantage")

## 2. Read-Through Query (`src/index.js`, `bench/acceptance.js`)
- **EXISTS**: Merges results across branch lineage with strict precedence rules
- Works by:
  - Union of parent and child vectors (`src/index.js` "parent ∪ child-edits")
  - Child vectors override collisions (`src/index.js` "child wins on an id collision")
  - Tombstoned vectors are excluded (`bin/agenticow.js` "tombstone-masked")
  - Re-ranks combined results by distance (`bench/acceptance.js` "reranked by distance")

## 3. Compliance Lineage (`examples/compliance-lineage.mjs`)
- **EXISTS**: Full audit trail and GDPR-compliant data removal
- Works by:
  - Tracking provenance via branch labels ("author = branch label")
  - Isolating user data in dedicated branches ("Each user contributes in their OWN branch")
  - Surgical erasure via branch dropping ("dropping that layer surgically erases...data")

## 4. Branch Management (`bin/agenticow.js`)
- **EXISTS**: Full lifecycle operations for memory versions
- Key operations:
  - `branch`: Creates new writable branch (162B overhead)
  - `checkpoint`: Freezes restore points (`bin/agenticow.js` checkpoint)
  - `rollback`: Discards edits since last checkpoint (`bench/acceptance.js` step 4)
  - `promote`: Merges branches upstream (`bin/agenticow.js` promote)

## 5. Deterministic Operation (`examples/_shared.mjs`)
- **EXISTS**: Reproducible execution for debugging
- Implemented via:
  - Seedable PRNG ("mulberry32 — small, fast, seedable PRNG")
  - Examples use local source imports ("run against this repo with zero setup")

Not yet implemented: A single ANN index spanning COW boundaries (roadmap item per `src/index.js` and `bench/bench.js`). Current queries use exact merging across boundaries.

## Maturity (shipped vs proposed)



These capabilities EXIST today in the npm package (`agenticow@0.2.3`) and are demonstrated in production examples:

1. **O(1) branching**  
   - Branch creation takes ~0.5ms and 162 bytes regardless of base size (`src/index.js`)  
   - Core implementation: `@ruvector/rvf-node` derive primitive (`src/index.js`)  

2. **Exact read-through queries**  
   - Merges parent ∪ edits with child winning conflicts (`bench/acceptance.js`)  
   - Implementation: Wrapper over native RVF stores (`src/index.js`)  

3. **Branch lifecycle operations**  
   - CLI verbs: `branch`, `checkpoint`, `rollback`, `diff` (`bin/agenticow.js`)  
   - Storage isolation proven in 1000-branch test (`bench/acceptance.js`)  

4. **Compliance tooling**  
   - Lineage tracking (`examples/compliance-lineage.mjs`)  
   - Surgical deletion via branch isolation (`bin/agenticow.js` rollback)  

5. **Production patterns**  
   - Multi-tenant isolation (`examples/multi-tenant-saas.mjs`)  
   - Right-to-erasure compliance (`examples/compliance-lineage.mjs`)  

## Proposed/Roadmap Features

Not yet implemented per source files:

1. **Single ANN spanning COW boundary**  
   - Currently requires separate ANN queries per branched store (`src/index.js`)  

2. **Native cluster-level read-through**  
   - Requires integration of RuVector PR #617 (`src/index.js`)  

3. **Automatic promotion pipelines**  
   - Demonstration exists (`examples/promotion-pipeline.mjs`) but not as turnkey solution  

All shipped claims are backed by:  
- Verified benchmarks (`bench/claim-ladder.js`)  
- Acceptance tests (`bench/acceptance.js`)  
- Production examples (`examples/multi-tenant-saas.mjs`)  

The core value proposition (constant-time branching + isolated edits) is fully implemented and proven at scale. Advanced query optimization across branches remains future work.

## Where the documentation lives


The documentation for **agenticow** is organized across several key locations, each serving a distinct purpose. Here’s a complete breakdown of where to find what:

#### **Core Documentation**
- **API Reference**: The TypeScript type declarations and detailed API documentation live in `src/index.d.ts`. This file defines the core types, parameters, and interfaces for agenticow, including vector dimensions, distance metrics, and HNSW configuration options.
- **CLI Usage**: The command-line interface (CLI) documentation is embedded in `bin/agenticow.js`. This file provides a comprehensive list of commands (`init`, `branch`, `checkpoint`, `rollback`, etc.) and their usage examples.

#### **Guides and Examples**
- **Interactive Documentation**: The official UI page, `docs/index.html`, serves as the primary landing page for agenticow. It explains core concepts like copy-on-write vector branching, exact read-through queries, and instant rollback capabilities.
- **Example Scripts**: Practical examples demonstrating agenticow’s capabilities are located in the `examples/` directory. For instance, `examples/compliance-lineage.mjs` showcases how to handle compliance and data lineage using agenticow primitives.

#### **Benchmarks and Acceptance Tests**
- **Benchmarks**: Performance benchmarks for agenticow’s core operations are documented in `bench/claim-ladder.js`. This file measures the latency and storage costs of branching, querying, and promoting operations.
- **Acceptance Tests**: The headline proof of agenticow’s correctness and scalability is in `bench/acceptance.js`. This script validates the exactness of read-through queries, rollback latency, and storage efficiency across 1,000 branches.

#### **Package Metadata**
- **Package Details**: The `package.json` file contains metadata about the agenticow package, including its version, dependencies, and npm scripts for running benchmarks, examples, and tests.

#### **Missing Documentation**
- **ADRs (Architectural Decision Records)**: There is no explicit mention of ADRs in the provided sources. If they exist, they are not referenced in the core files or documentation paths listed above.

By following these paths, you can access the complete documentation for agenticow, from API references to practical examples and performance benchmarks.

## How to use it end-to-end



Install agenticow via npm (requires Node.js >=18):
```shell
npm install agenticow
```

Verification:
```shell
agenticow demo      # Runs scripted walkthrough
agenticow bench     # Benchmarks COW branching speed
```

## Core Workflow

### 1. Initialize a base memory
Create a new vector memory file with dimension:
```shell
agenticow init memory.rvf --dim 768   # File created: `memory.rvf` + `.agenticow.json` lineage manifest
```

### 2. Populate with vectors (demo)
Ingest test data (or skip for real-world vectors):
```shell
agenticow ingest memory.rvf --n 1000  # Adds 1k random vectors (exists in `bin/agenticow.js`)
```

### 3. Branch for agent operations
Create isolated branches for parallel agents:
```shell
agenticow branch memory.rvf --as agent1  # Creates branch in ~0.5ms (162 B)
agenticow branch memory.rvf --as agent2  # Each branch isolates writes (`src/index.d.ts` confirms)
```

### 4. Agent memory operations
Work with branches:
```shell
# Checkpoint before risky ops (162 B per checkpoint)
agenticow checkpoint memory.rvf.agent1 --as pre_risk 

# Rollback if poisoned (`bench/acceptance.js` verifies isolation)
agenticow rollback memory.rvf.agent1

# Query merged view (parent ∪ agent edits)
agenticow query memory.rvf.agent1 --k 10

# View lineage and provenance
agenticow lineage memory.rvf    # Shows COW chain (`examples/compliance-lineage.mjs`)
```

## Advanced Patterns

### Promotion pipeline
Merge agent branches upstream:
```shell
agenticow promote memory.rvf.agent1 memory.rvf
```

### Compliance workflows
Answer regulatory queries using built-in provenance:
```shell
# GDPR right-to-erasure (delete user branch)
rm memory.rvf.user123  # Physical delete (`examples/compliance-lineage.mjs`)

# Exact provenance tracking
agenticow lineage memory.rvf.user456  # Full edit history
```

## Production Deployment

Run platform-scale examples:
```shell
npm run examples:platform  # Executes `examples/promotion-pipeline.mjs` etc.
```

Benchmark verification (1000 branches):
```shell
BASE=50000 BRANCHES=1000 node bench/acceptance.js  # Stress test (`bench/acceptance.js`)
```

Key metrics (exists in docs):
- 162 B per empty branch (`docs/index.html`)
- ~0.5 ms branch creation time (O(1))
- Verified 1000-branch isolation (`bench/acceptance.js`)
