# Capability Cards

Capability-phrased, keyword-rich descriptions of each RuvNet building block. These route a
DESCRIBED need ("what should I use to do X?") to the right repo even when the user never names it.
One card per building block, grounded in each repo's primer.

## ruflo
RuvNet's agent orchestration engine. Use it to coordinate swarms of agents working in parallel, run multiple coding agents at once that share state and memory, spawn agents, route and orchestrate multi-step tasks, and add hooks/MCP tools. Reach for ruflo whenever you need multi-agent coordination, parallel agents, swarms, or task orchestration.

## ruvector
RuvNet's high-performance vector database and search engine, written in Rust with SIMD-optimized HNSW indexing and an `.rvf` binary container format (plus WASM bindings for in-browser use). Use it to store embeddings and run fast approximate-nearest-neighbor / similarity search, build local on-device semantic search, power a private RAG index, or replace a hosted vector DB (Pinecone, Qdrant, pgvector) with a zero-server on-disk store. Reach for ruvector whenever you need vector search, HNSW indexing, an embeddings store, nearest-neighbor lookup, or semantic search that runs locally and privately.

## agentdb
RuvNet's cognitive database for agent memory, combining vector search with graph relationships and explainable recall. Use it to give an agent durable, persistent memory that survives across sessions, store structured agent state and knowledge, run graph/relationship (n-ary hyperedge) queries over what the agent remembers, and audit why a result was recalled via feature attributions. Reach for agentdb whenever you need long-term agent memory, persistent structured storage across sessions, a memory graph, or explainable, queryable recall.

## rulake
RuvNet's self-optimizing, witness-anchored vector cache and working-memory layer that sits in front of a vector store. Use it as a caching layer to speed up repeated vector queries with fast (sub-millisecond) recall, give agents a remember/recall/forget memory surface, get deterministic and provenance-verifiable retrieval, and let cache hit-ratio auto-tune and improve with usage. Reach for rulake whenever you need a vector cache, a read cache in front of a vector database, faster repeated lookups, cache coherence, or verifiable retrieval that gets better the more it is used.

## ruview
RuvNet's camera-free WiFi sensing system that turns ordinary WiFi radio signals (Channel State Information / CSI) into human presence, activity, and physiological readings — with no cameras. Use it to detect people and occupancy through walls, estimate body pose and count people, recognize falls and gestures, and read medical-grade vitals such as breathing and heart rate from radio alone, all privacy-preserving. Reach for ruview whenever you need WiFi/CSI sensing, contactless presence or fall detection, vitals monitoring without a wearable, or ambient activity recognition without a camera (requires ESP32-S3/C6 hardware).

## agentic-flow
A Claude-Code-integrated agent orchestration platform shipping 54+ ready-to-run specialized agents (coder, reviewer, PR-manager, architect) across three swarm topologies (mesh, hierarchical, ring). Use it to run and coordinate agent swarms, generate code and manage PRs through prebuilt agents, persist context with ReasoningBank memory, and route work across multiple model providers (Anthropic, OpenRouter, Gemini) to manage cost, with self-learning swarm optimization and auto-topology selection. Reach for agentic-flow whenever you need ready-made coding agents, swarm coordination inside Claude Code, multi-provider model support, or orchestration with persistent reasoning memory.

## sparc
A structured, AI-assisted software-development methodology organized into five phases — Specification, Pseudocode, Architecture, Refinement, Completion — with enforced conventions and review/quality gates between stages, plus a CLI for AI-driven analysis, planning, and execution. Use it to take a feature from idea to shipped code in disciplined steps, enforce quality gates and human-in-the-loop review, and run research-then-build workflows. Reach for sparc whenever you need a build methodology, a phased or structured development process, a spec-to-code workflow, or quality gates for AI-generated code.

## qudag
A quantum-resistant, DAG-based communication platform built on post-quantum cryptography (ML-KEM, ML-DSA) with anonymous multi-hop routing. Use it for end-to-end encrypted, anonymous secure messaging between agents or nodes that resists traffic analysis and future quantum attacks, peer-to-peer QUIC networking, and resource-metered exchange. Reach for qudag whenever you need quantum-resistant / post-quantum security, anonymous routing, secure agent-to-agent messaging, or a censorship-resistant communication layer.

## safla
SAFLA (Self-Aware Feedback Loop Algorithm) — a self-improvement architecture that lets a system monitor, evaluate, and modify its own behavior through operational, meta-cognitive, and self-modification layers. Use it to give an agent recursive self-improvement, self-awareness and self-monitoring, performance evaluation with divergence and novelty detection, and automated error recovery plus policy/strategy adaptation. Reach for safla whenever you need an agent that improves itself, a meta-cognitive feedback loop, self-optimizing behavior, or continuous self-evaluation and adaptation.

## ruv-fann
A fast, memory-safe neural network library written in Rust (a FANN-style framework, zero unsafe code) that compiles to WASM for the browser and edge. Use it to build and train neural networks (MLPs, cascade-correlation networks that grow dynamically), run time-series forecasting, and embed portable neural backends into agents or edge/WASM applications. Reach for ruv-fann whenever you need a neural network library, in-Rust ML, WASM-deployable models, forecasting, or fast on-device inference.

## synthlang
An LLM middleware and CLI focused on prompt compression and token-cost reduction, fronted by a drop-in OpenAI-compatible proxy. Use it to compress prompts and cut token usage and cost (reported ~75% token reduction), add semantic caching and PII masking in front of an LLM API without rewriting your app, and apply structured / mathematical prompt-engineering transformations. Reach for synthlang whenever you need to shrink prompts, lower token costs, compress context, cache LLM responses, or mask sensitive data in prompts.

## rupixel
A zero-server, client-side visual retrieval system that searches images, live video frames, and document screenshots by semantic meaning using on-device CLIP embeddings — OCR-free, with no data upload. Use it for visual RAG over page-image and document screenshots, real-time webcam/screen video search, and cross-modal text-to-image search that runs entirely in the browser or via CLI. Reach for rupixel whenever you need visual or page-image document retrieval, image or video semantic search, OCR-free visual RAG, or privacy-preserving on-device multimodal search.

## agenticow
"Git for agent memory" — a copy-on-write (COW) vector branching system that forks a vector store in constant time and size (~0.5 ms, ~162 bytes per branch) regardless of how large the base is. Use it to branch, checkpoint, fork, and instantly roll back agent memory, let parallel agents share one base memory while keeping isolated edits, sandbox risky ingests then discard or promote them, and surgically erase data (GDPR right-to-erasure) by dropping a branch while tracing full lineage. Reach for agenticow whenever you need to fork or branch agent memory, snapshot and roll back vector state, isolate per-agent memory cheaply, or trace and erase memory provenance.

## cve-bench
A SWE-bench-style benchmark that measures how well an AI agent can fix real, publicly disclosed security vulnerabilities (CVEs) by passing each project's own security regression test. Use it to evaluate an agent's or code-repair tool's ability to actually patch real CVEs under a conformance firewall (the model never sees the gold fix), and to rank systems on a cost-aware, resolve-per-dollar leaderboard. Reach for cve-bench whenever you need to benchmark security vulnerability fixing, test automated patching or code-repair on real CVEs, or measure an agent's security capability and cost-effectiveness.

## daa
DAA (Decentralized Autonomous Application / Agents) — a Rust framework for building autonomous economic agents that govern themselves with auditable rules, manage token economies, and integrate AI decision-making over MCP. Use it to build decentralized autonomous agents and applications, enforce rule-based governance (spending limits, risk thresholds), run autonomous economic and token accounting, and orchestrate self-running MRAP autonomy loops. Reach for daa whenever you need a decentralized autonomous agents framework, self-governing economic agents, rule-enforced autonomy, or DAO/DeFi-style agent applications.

## dspy.ts
A TypeScript/JavaScript implementation of DSPy — a declarative framework for building LLM pipelines from composable modules and signatures that can be automatically optimized rather than hand-prompted. Use it to program LLM workflows, auto-tune prompts and few-shot examples against a metric with built-in optimizers, build classification/sentiment/QA and ReAct agent pipelines, and run them in browser or Node via ONNX Runtime / OpenRouter. Reach for dspy.ts whenever you need programmable or optimizable LLM pipelines, automatic prompt optimization, declarative LM programs, or DSPy in TypeScript.

## fact
FACT (Fast-Access Cached Tools) — a system for reliable, low-latency AI tool integration built around aggressive caching and resilience. Use it to wire LLM tool calls with fast cached access, keep tool execution dependable under failure with circuit-breaker and graceful-degradation patterns, and monitor cache hit rate, latency, and health. Reach for fact whenever you need cached or low-latency AI tools, dependable tool execution, fewer repeated tool/LLM calls, or resilient tool integration with built-in monitoring.

## agent-harness-generator
Also called metaharness — a factory toolchain that scaffolds complete, custom AI agent harnesses with a single command, then scores and self-evolves them. Use it to generate standalone, host-agnostic agent harnesses (Claude Code, Codex, pi.dev, and other MCP hosts), score a repo for harness fit and a harness for readiness and safety, A/B test and benchmark harness variants, and let Darwin Mode evolutionarily improve them under fixed safety rails. Reach for agent-harness-generator whenever you need to scaffold or generate an agent harness, build a project-specific AI tool, score/benchmark/evolve agent harnesses, or auto-improve an agent via Darwin Mode self-evolution.

## rvm
RuvNet's proof-gated microhypervisor (RVM / ruvix) — a capability-secure runtime that brings formally-verified-OS security (seL4 / CHERI-style) to an AI vector-and-agent substrate: every privileged state mutation requires an unforgeable capability token AND a verifiable proof recorded in an append-only witness log, so nothing changes state without provable, auditable authority. Use it to run untrusted or multi-tenant agent/partition workloads under hardware-grade isolation, gate every mutation behind capabilities (seL4-style derivation tree — mint / derive with monotonic attenuation / epoch-based revoke, max delegation depth 8, seven rights: READ, WRITE, GRANT, REVOKE, EXECUTE, PROVE, GRANT_ONCE), and verify changes through a three-tier proof system (P1 Hash capability check &lt;1µs on the syscall hot path — ships; P2 Witness-chain policy validation &lt;100µs constant-time; P3 deep / zero-knowledge proof &lt;10ms — accepted, partly deferred). Reach for rvm whenever you need capability-based security, a microhypervisor or secure partitioning for agents, proof-gated or witness-logged state transitions, unforgeable authority tokens, tamper-evident audit of every mutation, or seL4 / CHERI-grade isolation for an AI runtime.
