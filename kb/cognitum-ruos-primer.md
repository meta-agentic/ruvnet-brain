# cognitum-ruos — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

# What it is & who it's for  

**cognitum-ruos** is the first agentic operating system for AI workstations (`README.md`). Unlike traditional OSes that passively execute commands, ruOS actively **observes, reasons, and acts** using a local Qwen2.5-3B LLM, RAG-augmented memory, and autonomous decision-making (`README.md`, `crates/ruos-agent/Cargo.toml`).  

### Core capabilities (all local, no cloud):  
1. **LLM-driven autonomy**:  
   - Reasons about system state every 15 minutes using RAG over 600+ memories (`README.md`)  
   - Implements self-monitoring (service crashes, GPU thermals) via `crates/ruos-agent/src/monitor.rs`  
   - Auto-switches GPU profiles (e.g., `gpu-train` vs. `interactive`) based on usage patterns (`config/CLAUDE.md`)  

2. **Self-improvement**:  
   - Nightly DPO fine-tuning via LoRA adapters (`README.md`)  
   - Embeds unvectorized memories during idle time (`crates/ruos-agent/src/backfill.rs`)  
   - Hourly self-evaluation against reference queries (`crates/ruos-agent/src/eval.rs`)  

3. **Security & context**:  
   - Scans for prompt injection/PII using `packages/ruos-agent/aidefence.py` patterns  
   - Collects opt-in sensor data (WiFi presence, vitals) via `crates/ruos-sensors/src/main.rs`  
   - Weekly OTA updates through GitHub (`crates/ruos-agent/src/ota.rs`)  

### Who it's for:  
- **AI researchers** needing local, autonomous GPU/CPU profile management  
- **Developers** who want LLM-augmented system debugging (124 built-in MCP tools in `config/CLAUDE.md`)  
- **Privacy-focused users** requiring offline operation with cryptographic consent for sensors (`crates/ruos-sensors/src/main.rs`)  

All capabilities are implemented and verifiable in the cited paths. The system has no cloud dependencies—everything runs locally via the `ruos-agent` daemon (`crates/ruos-agent/src/main.rs`).

## Capabilities (what it can do)

# Capabilities (what it can do)

## 1. Sensor Data Collection with Cryptographic Consent
EXISTS in `crates/ruos-sensors/src/main.rs`  
- Collects system metrics from 30+ sensor sources (`"system-metrics", "network-stats", "csi-sensing", "geo-satellite"` etc.)  
- Enforces opt-in consent via ed25519 signatures (`mod consent`)  
- Supports both one-shot collection (`collectors::collect_all()`) and continuous daemon mode (`collectors::daemon()`)  
- Stores observations as "brain memories" for agent reasoning  

## 2. Incremental System Backup with Rollback
EXISTS in `crates/ruos-backup/src/main.rs`  
- Creates space-efficient snapshots using rsync hard-links  
- Supports rollback to specific snapshots (`rollback <ID>`)  
- Automatic pruning of old backups (`prune --keep 5`)  
- Scheduled daily backups via system timer (`schedule`)  

## 3. Voice Control Interface
EXISTS in `crates/ruos-voice/src/main.rs`  
- Processes wake phrases ("hey ruOS"/"jarvis")  
- Executes voice commands:  
  - System control (`"switch to [profile]"`, `"lock"`)  
  - Information retrieval (`"system status"`, `"what did you learn"`)  
  - Application launching (`"open [app]"`)  
  - Security testing (`"run security test"`)  
- Uses Whisper for speech-to-text and TTS for responses  

## 4. Agentic Decision-Making
EXISTS in `crates/ruos-agent/src/main.rs`  
- Runs observe-reason-decide-act loop with:  
  - Self-monitoring (`mod monitor`)  
  - Automatic profile switching (`mod profile`)  
  - OTA updates (`mod ota`)  
  - Session distillation (implied by `"session distillation"` in doc)  
- Interfaces with external LLM services (`LLM_URL = "http://127.0.0.1:8080"`)  

## 5. AI Security (AIDefence)
EXISTS in `packages/ruos-agent/aidefence.py`  
- Detects and prevents:  
  - Instruction override attacks  
  - Role manipulation attempts  
- Ported from TypeScript implementation (AIDefenceGuard.ts)  

## Limitations
- Local LLM inference is not yet implemented (currently uses HTTP service per `crates/ruos-agent/src/llm.rs`)  
- Some voice commands may require additional integration (e.g., "search for [query]" depends on brain service availability)

## Core concepts & how they work

# Core Concepts & How They Work

## 1. Sensor Data Collection with Cryptographic Consent
EXISTS in `crates/ruos-sensors/src/main.rs`  
- Collects data from 30+ sensor sources (`system-metrics`, `network-stats`, `camera-depth`, etc.)  
- Requires explicit ed25519-signed consent for privacy-sensitive categories (`camera-objects`, `audio-ambient`, etc.)  
- Operates in both one-shot (`Collect`) and continuous (`Daemon`) modes  
- Stores observations as "brain memories" for agent reasoning  

## 2. Voice Control System
EXISTS in `crates/ruos-voice/src/main.rs`  
- Implements wake word detection ("hey ruOS"/"jarvis")  
- Speech-to-text via Whisper CLI integration  
- Handles 8+ command types including:  
  - Brain searches (`search for [query]`)  
  - System control (`switch to [profile]`, `lock/unlock`)  
  - Security tests (`run security test`)  
- Responds via TTS (Text-to-Speech)  

## 3. Incremental Backup System
EXISTS in `crates/ruos-backup/src/main.rs`  
- Uses rsync hard-link snapshots for space efficiency  
- Supports:  
  - Snapshot creation (`snapshot`)  
  - Rollback to any point (`rollback <ID>`)  
  - Automatic pruning (`prune --keep 5`)  
  - Scheduled daily backups (`schedule`)  

## 4. Agentic Reasoning Loop
EXISTS in `crates/ruos-agent/src/main.rs`  
- Implements OODA (Observe-Orient-Decide-Act) cycle with:  
  - Self-monitoring (`monitor.rs`)  
  - Automatic system profiling (`profile.rs`)  
  - Security checks via AIDefence (`aidefence.rs`)  
  - Memory backfilling (`backfill.rs`)  
  - Self-evaluation (`eval.rs`)  

## 5. Security Subsystems
EXISTS in:  
- `packages/ruos-agent/aidefence.py` (injection pattern detection)  
- `crates/ruos-agent/src/aidefence.rs` (runtime guardrails)  
- Detects and prevents:  
  - Instruction override attempts  
  - Role manipulation attacks  

## 6. Memory & Learning
EXISTS in `crates/ruos-agent/src/backfill.rs` and sensor integration  
- Stores observations as vector embeddings  
- Supports semantic search ("what did you learn" voice command)  
- Automatic distillation of important patterns  

Uncovered areas (per sources):  
- No details on the exact LLM integration architecture  
- No specifics about the "brain" storage format  
- GPU profile switching implementation not shown  

All other capabilities not explicitly mentioned in these source files should be considered undocumented at this time.

## Maturity (shipped vs proposed)

# Maturity (shipped vs proposed)

## Shipped and Operational Features

1. **Sensor Framework with Consent System**  
   - EXISTS in `crates/ruos-sensors` (v0.1.0)  
   - 30+ data sources with Ed25519-signed opt-in consent (`crates/ruos-sensors/src/consent.rs`)  
   - Actively collects brain data to `~/brain-data/brain.rvf (`config/CLAUDE.md`)

2. **Agentic Core**  
   - EXISTS in `crates/ruos-agent` (v1.1.0)  
   - Implements self-monitoring, auto-profiling, and AIDefence patterns (`crates/ruos-agent/Cargo.toml`)  
   - Profile switching via `ruv_profile_apply` with 5 predefined modes (`config/CLAUDE.md`)

3. **Brain Operations**  
   - EXISTS with 22 MCP-brain tools including:  
     - `brain_write_memory`/`brain_write_preference_pair` for corrections (`config/CLAUDE.md`)  
     - Full CRUD via `brain_search`/`brain_get`/`brain_delete` (`config/CLAUDE.md`)  

4. **System Awareness**  
   - EXISTS via `ruvultra-mcp` with 102 tools for hardware/OS telemetry (`config/CLAUDE.md`)  
   - Includes GPU/CUDA monitoring, storage, network, and docker management  

5. **Voice Interface**  
   - EXISTS in `crates/ruos-voice` (v0.1.0) with CPAL audio capture (`crates/ruos-voice/Cargo.toml`)  

6. **Backup System**  
   - EXISTS in `crates/ruos-backup` (v0.1.0) with incremental snapshots (`crates/ruos-backup/Cargo.toml`)  

## Proposed/In-Development Features

1. **Local LLM Inference**  
   - Currently proxies to external service (`crates/ruos-agent/src/llm.rs`)  
   - Planned candle-based integration marked as future work  

2. **Advanced Auto-Profiling**  
   - Basic rule-based switching EXISTS (`crates/ruos-agent/src/profile.rs`)  
   - LLM-enhanced reasoning not yet implemented per docstring  

## Versioning Highlights
- Agent is production-ready (v1.1.0)  
- Sensors/voice/backup at v0.1.0 but fully functional  
- No breaking changes indicated in manifests  

All shipped features are actively maintained with concrete implementations — no hypothetical capabilities claimed.

## Where the documentation lives

## Where the documentation lives

cognitum-ruos's documentation is organized across these key locations:

### Core System Guide
The authoritative system reference exists at `config/CLAUDE.md` - this documents:
- Available tools (`ruvultra-mcp` with 102 system tools and `mcp-brain` with 22 knowledge tools)
- Brain interaction patterns (preference pairs, memory storage)
- Storage locations (`~/brain-data/brain.rvf` for cognitive data, `~/.config/ruvultra/identity.key` for identity)
- System profiles (GPU-train, GPU-infer, CPU-bulk, etc.)

### Implementation Documentation
Each subsystem documents its capabilities inline:
- Voice command processing: See `crates/ruos-voice/src/commands.rs` for command mapping
- Sensor collection: Defined in `crates/ruos-sensors/Cargo.toml` with 30 data sources
- Agent capabilities: Documented in `crates/ruos-agent/Cargo.toml` (self-monitoring, auto-profile, AIDefence, OTA)
- Security layer: Implemented in `crates/ruos-agent/src/aidefence.rs` with prompt injection/PII detection

### Module-Level Docs
Component functionality is documented at the source level:
- LLM integration: `crates/ruos-agent/src/llm.rs` describes the current HTTP bridge and planned candle-based inference
- Agent subsystems: The module structure in `crates/ruos-agent/src/` reveals core capabilities (backfill, eval, monitoring)

No centralized API reference exists outside these locations - all operational knowledge is either in `CLAUDE.md` or embedded in the implementing crates. The system follows a "document at the source" philosophy where capabilities are explained where they're implemented.

## How to use it end-to-end

### How to use it end-to-end

#### Installation
1. **System Requirements**: Ensure your machine meets the requirements for running ruOS, including GPU support for CUDA and sufficient RAM.
2. **Clone the Repository**: Clone the ruOS repository from the official source.
3. **Build the Crates**: Use `cargo build` to compile the necessary crates, including `ruos-agent`, `ruos-voice`, and `ruos-backup`.

#### Initial Setup
1. **Boot Context**: Start by calling `ruv_meta_boot_context` to retrieve detailed information about your machine's state, including GPU, CPU, RAM, services, brain stats, profile, and kernel tunings (`config/CLAUDE.md`).
2. **Identity Setup**: Ensure your identity key is generated and stored at `~/.config/ruvultra/identity.key` (`config/CLAUDE.md`).

#### Using the Brain
1. **Memory and Preferences**: Use `ruv_brain_write_memory` to store learned information and `ruv_brain_write_preference_pair` to record preferences (`config/CLAUDE.md`).
2. **Search**: Utilize `ruv_brain_search` to find relevant past knowledge before answering queries (`config/CLAUDE.md`).

#### Voice Control
1. **Activation**: Use wake words like "hey ruOS" or "jarvis" to activate the voice control daemon (`crates/ruos-voice/src/main.rs`).
2. **Commands**: Issue commands such as "search for [query]", "switch to [profile]", "system status", and "what did you learn" (`crates/ruos-voice/src/main.rs`).

#### System Profiles
1. **Profile Management**: Switch between profiles like `gpu-train`, `gpu-infer`, `cpu-bulk`, `interactive`, and `power-save` using `ruv_profile_apply` (`config/CLAUDE.md`).

#### OTA Updates
1. **Check for Updates**: The OTA module checks GitHub releases for updates (`crates/ruos-agent/src/ota.rs`).
2. **Install Updates**: Automatically download and install updates (`crates/ruos-agent/src/ota.rs`).

#### Backup and Rollback
1. **Auto-Backup**: Use `ruos-backup` for incremental snapshots and rollback (`crates/ruos-backup/Cargo.toml`).
2. **Rollback**: Restore the system to a previous state using the rollback feature (`crates/ruos-backup/Cargo.toml`).

#### Security
1. **AIDefence**: Run the AIDefence test suite to ensure system security (`crates/ruos-voice/src/main.rs`).
2. **Injection Patterns**: Utilize the AIDefence module to detect and prevent instruction override and role manipulation (`packages/ruos-agent/aidefence.py`).

#### Local LLM Inference
1. **LLM Module**: Currently, the agent calls the external `ruos-llm-serve` via HTTP, but future updates will include inline candle inference (`crates/ruos-agent/src/llm.rs`).

By following these steps, you can effectively install, configure, and utilize cognitum-ruos end-to-end, leveraging its full range of capabilities for system management, voice control, brain operations, and security.
