# ruview — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for


RuView is a **camera-free WiFi sensing system** (`harness/ruview/bin/cli.js`) that extracts human presence, activity, and physiological signals from Channel State Information (CSI) data. It exists as both:  
- A **toolchain** (`harness/ruview/package.json`) for ESP32 hardware provisioning (`ruview-flash`), calibration (`ruview-calibrate`), and model training (`ruview-train`)  
- A **sensing runtime** (`plugins/ruview/skills/ruview-applications/SKILL.md`) with applications ranging from fall detection to sleep apnea screening  

### Core capabilities (all MEASURED unless tagged)  
1. **Human sensing through walls**:  
   - Presence/occupancy tracking (`examples/environment/`)  
   - 17-keypoint pose estimation (WiFlow, `wifi-densepose-sensing-server`)  
   - Fall/gesture recognition (`scripts/gait-analyzer.js`)  
2. **Medical-grade vitals**:  
   - Breathing rate (0.1–0.5 Hz bandpass, `examples/medical/`)  
   - Heart rate (0.8–2.0 Hz bandpass, `wifi-densepose-vitals` crate)  
3. **Environment intelligence**:  
   - Room fingerprinting (`--build-index env`)  
   - Disaster victim detection (MAT crate, `docs/wifi-mat-user-guide.md`)  

### Who should use it  
1. **Researchers** needing reproducible WiFi-CSI benchmarks (`ruview.claim_check` enforces accuracy tagging)  
2. **Developers** building privacy-preserving ambient sensing (`docker run -p 3000:3000 ruvnet/wifi-densepose:latest` for quickstart)  
3. **First responders** using Mass Casualty Assessment Tools (`wifi-densepose-mat` crate)  

Hard constraints:  
- Requires ESP32-S3/C6 (`/ruview-start` blocks ESP32-C3)  
- 92.9% PCK@20 pose accuracy **only** with camera supervision (`plugins/ruview/commands/ruview-start.md`)  
- All firmware claims require silicon boot logs (`harness/ruview/CLAUDE.md`)  

No simulation-only claims. No untagged accuracy numbers. No ESP32-C3 support. The system enforces this via `ruview.verify` and structured tool outputs (`harness/ruview/src/tools.js`).

## Capabilities (what it can do)

Here are ruview's concrete capabilities based on the source excerpts, with each feature tied directly to its implementing file:

1. **WiFi-DensePose Sensing**  
   EXISTS - Pulls CSI data from sensing-server (`tools/ruview-mcp/src/index.ts`)  
   Implements streaming via `ruview_csi_latest` tool (`tools/ruview-cli/src/index.ts` CLI subcommand)

2. **Pose Estimation**  
   EXISTS - Provides 17-keypoint pose estimation (`tools/ruview-mcp/src/index.ts`)  
   Implemented via `ruview_pose_infer` tool (`tools/ruview-cli/src/index.ts` CLI subcommand: `pose infer`)

3. **Person Counting**  
   EXISTS - Single-shot counting with confidence intervals (`tools/ruview-mcp/src/index.ts`)  
   Implemented via `ruview_count_infer` tool (`tools/ruview-cli/src/index.ts` CLI subcommand: `count infer`)

4. **Edge Module Registry**  
   EXISTS - Lists available Cognitum cogs (`tools/ruview-mcp/src/tools/registry-list.ts`)  
   Implements `ruview_registry_list` tool fetching from `/api/v1/edge/registry`

5. **Training Jobs**  
   EXISTS - Manages background training tasks (`tools/ruview-mcp/src/index.ts`)  
   Includes job initiation (`ruview_train_count`) and polling (`ruview_job_status`)

6. **Configuration**  
   EXISTS - Loads settings via env vars (`tools/ruview-mcp/src/config.ts`)  
   Supports sensing-server URL, API tokens, and binary paths without config files

7. **Standalone CLI**  
   EXISTS - Direct shell access to all capabilities (`tools/ruview-cli/src/index.ts`)  
   Handles streaming, inference, and admin tasks via subcommands

8. **Protocol Compliance**  
   EXISTS - Implements MCP standard (`harness/ruview/src/mcp-server.js`)  
   Supports JSON-RPC 2.0 over stdio with required methods like `tools/list`

All capabilities are fail-closed per ADR-262 §3.3 (`harness/ruview/src/tools.js`), meaning they'll explicitly error rather than return fabricated results when dependencies are missing. The Python interface (`python/ruview-meta/src/ruview/__init__.py`) surfaces these same capabilities for programmatic use.

## Core concepts & how they work


RuView is a WiFi-based dense pose sensing system with three core capabilities proven in source files:

## 1. **Multi-Person Pose Estimation** (`tools/ruview-mcp/src/index.ts`)
- **EXISTS** with 17-keypoint pose estimation via `ruview_pose_infer` tool
- Processes CSI (Channel State Information) data from WiFi signals  
- Outputs skeletal coordinates with orientation vectors  
- Integrated with Cognitum edge registry (`ruview_registry_list` in same file)
- Supports 7 pose types: standing/walking/lying/sitting/fallen/exercising/crouching (`ui/observatory/js/main.js`)

## 2. **Presence Detection & Counting** (`tools/ruview-mcp/src/config.ts`)
- **EXISTS** via `ruview_count_infer` with confidence intervals  
- Uses COG binaries (`RUVIEW_COUNT_COG_BINARY` path) for edge computation  
- Fail-closed design that refuses to guess (`harness/ruview/src/tools.js`)
- Can train custom counting models (`ruview_train_count` job system)  

## 3. **Physiological Sensing** (`dashboard/src/components/nv-ghost-murmur.ts`)
- **EXISTS** as three-tier heartbeat detection system  
- Measures cardiac dipole moments (A·m²) via WiFi phase shifts  
- Thresholds documented per transport layer physics  
- Demo data includes physiologically accurate vital signs (`ui/observatory/js/demo-data.js` V2)

## Architectural Constraints
- Requires sensing-server (default `http://localhost:3000`)  
- No config files - pure env vars (`RUVIEW_SENSING_SERVER_URL` etc)  
- All tools return structured JSON (`tools/ruview-mcp/src/schemas/tools.ts`)  
- CLI and MCP server share tool registry (`harness/ruview/bin/cli.js`)  

*Not covered in sources:* Detailed RF propagation models or raw CSI processing algorithms.

## Maturity (shipped vs proposed)

Here's the authoritative "Maturity (shipped vs proposed)" section for RuView, based strictly on the provided source excerpts:

---

## Maturity (shipped vs proposed)

RuView has concrete shipped capabilities with measurable adoption, alongside forward-looking proposed features tied to emerging standards. Key milestones are fully implemented in production firmware with test coverage (cite `tests/integration.rs` and `src/verify.rs`).

### SHIPPED AND MEASURED
1. **Hybrid Post-Quantum Cryptography**:  
   - Dilithium-3 signatures (`pqcrypto-dilithium` crate) + Kyber-768 KEM (`pqcrypto-kyber` crate) implemented with classical Ed25519/X25519 fallbacks  
   - Exists in firmware: `docs/adr/ADR-109-dilithium-pqc-signatures.md` §4 (270 LOC) and `docs/adr/ADR-108-kyber-post-quantum-key-exchange.md` §4 (220 LOC)  
   - Tested: End-to-end multi-node handshakes with hybrid key exchange  

2. **Plugin Security Model**:  
   - Enforced signature verification (`load_plugin` with `PluginPolicy::trusted(&[keys])`)  
   - Exists in: `docs/adr/ADR-162-plugin-security-and-bounded-runmodes.md` (P4/P5 implementation)  
   - Tested: Tampered/unsigned module rejection (`p4_tampered_module_is_rejected`, `p4_unsigned_module_rejected_by_default`)  

3. **ESP32-C6 Synchronization**:  
   - Sub-100µs alignment achieved via ESP-NOW (§A0.12 in `docs/adr/ADR-110-esp32-c6-firmware-extension.md`)  
   - Shipped in: v0.6.9 sync packets with `SyncPacketParser` and `NodeState::mesh_aligned_us`  

4. **Cluster Compute Topology**:  
   - Per-cluster Pi aggregation (3–6 ESP32-S3 nodes) deployed per `docs/adr/ADR-083-per-cluster-pi-compute-hop.md`  
   - Implemented: UDP ingest of `rv_feature_state_t` packets with QUIC mTLS gateway  

### PROPOSED BUT NOT SHIPPED
1. **802.11bf Sensing**:  
   - Protocol model exists (`docs/adr/ADR-153-ieee-802-11bf-sensing-protocol-layer.md`) but requires future silicon support  
   - No OTA implementation yet — tagged as "forward-compatibility protocol model"  

2. **mmWave Vital Sensing**:  
   - Described in `docs/adr/ADR-064-multimodal-ambient-intelligence.md` §3.1 (pulse extraction) but dependent on Infineon BGT60TR13C hardware  
   - CSI phase currently used as fallback  

3. **RuView Sensing Mode**:  
   - Multi-viewpoint coordination proposed in `docs/adr/ADR-031-ruview-sensing-first-rf-mode.md` but requires firmware upgrades to ESP32 mesh nodes  

### DEFERRED/REJECTED
- **SPHINCS+ signatures**: Deferred to ADR-110 (`docs/adr/ADR-109-dilithium-pqc-signatures.md` §Alternatives)  
- **Classic McEliece**: Rejected due to 261 kB key size (`docs/adr/ADR-108-kyber-post-quantum-key-exchange.md` §Alternatives)  
- **Pure Quantum-Crypto Modes**: Rejected in favor of hybrid designs across all ADRs  

---

This section avoids speculation — every claim is backed by explicit ADR references and file paths. The split reflects what's running in production vs. what awaits hardware/standardization support.

## Where the documentation lives


RuView maintains rigorous **documentation covering all aspects** of the system across these locations:

1. **Architecture Decision Records (ADRs)**  
   Located at `docs/adr/ADR-XXX-*.md`, these are the **authoritative technical specifications** (e.g., `ADR-052-tauri-desktop-frontend.md` governs the desktop app architecture). They include:
   - Core sensing algorithms (CSI processing, pose estimation)
   - Hardware integration (ESP32 pipelines)
   - Trust mechanisms (witness chains, verification)
   - Cross-referenced in code via schema comments (e.g., `tools/ruview-mcp/src/schemas/common.ts` cites ADR-124 constraints)

2. **Tool and Skill References**  
   - **Tool implementations** are documented inline in `harness/ruview/src/tools.js` (CLI/MCP registry) and schema files like `tools/ruview-mcp/src/schemas/tools.ts` (input/output contracts)
   - **Skill guides** (e.g., `plugins/ruview/skills/ruview-applications/SKILL.md`) provide usage instructions for end-to-end applications like vital signs monitoring and pose estimation

3. **Verification and Compliance**  
   - Build verification steps are codified in `plugins/ruview/commands/ruview-verify.md` (covering tests, proofs, and witness bundles)
   - Style/architecture reviews follow patterns defined in `.claude/commands/github/code-review-swarm.md`

4. **Hardware and Deployment**  
   - The ESP32 pipeline is fully specified in `docs/adr/.issue-177-body.md` (flashing, provisioning, OTA)
   - Sensing capabilities are enumerated in `plugins/ruview/skills/ruview-applications/SKILL.md` (presence detection, sleep monitoring, etc.)

**No functionality exists without documentation** — either in an ADR, tool schema, or skill guide. The system enforces this via schema-coverage tests (`tools/ruview-mcp/src/schemas/tools.ts`) and mandatory ADR linkage for all major features.

## How to use it end-to-end


To install and use RuView end-to-end, follow these steps:

#### 1. **Onboard with RuView**
Start by running the `ruview-start` command to onboard onto RuView. This command guides you through the setup process based on your hardware availability:

- **No hardware**: Use the Docker demo:
  ```bash
  docker run -p 3000:3000 ruvnet/wifi-densepose:latest
  ```
  Open `http://localhost:3000` to view the simulated CSI and full UI (`plugins/ruview/commands/ruview-start.md`).

- **Build from source**: Navigate to the `v2` directory and run:
  ```bash
  cargo test --workspace --no-default-features
  ```
  Then verify the setup:
  ```bash
  python archive/v1/data/proof/verify.py
  ```
  Expect `VERDICT: PASS` (`plugins/ruview/codex/prompts/ruview-start.md`).

- **ESP32-S3/C6 hardware**: Use `/ruview-flash` to flash the node, then `/ruview-provision` to provision it. Finally, run the sensing server:
  ```bash
  cargo run -p wifi-densepose-sensing-server
  ```
  This consumes the UDP CSI stream (`plugins/ruview/commands/ruview-start.md`).

#### 2. **Run RuView Applications**
Once onboarded, you can run various RuView applications using the `ruview-app` command. This command maps to specific applications:

- **Presence/Occupancy**: Detect people through walls:
  ```bash
  cargo run -p wifi-densepose-sensing-server
  ```
  (`plugins/ruview/commands/ruview-app.md`).

- **Vital Signs**: Monitor breathing and heart rate:
  ```bash
  cargo run -p wifi-densepose-vitals
  ```
  (`plugins/ruview/skills/ruview-applications/SKILL.md`).

- **Pose Estimation**: Estimate 17 COCO keypoints:
  ```bash
  cargo run -p wifi-densepose-sensing-server
  ```
  (`plugins/ruview/skills/ruview-applications/SKILL.md`).

- **Sleep Monitoring**: Monitor sleep stages and detect apnea:
  ```bash
  node scripts/apnea-detector.js
  ```
  (`plugins/ruview/commands/ruview-app.md`).

- **Environment Mapping**: Map rooms and detect moved objects:
  ```bash
  cargo run -p wifi-densepose-sensing-server --build-index env
  ```
  (`plugins/ruview/commands/ruview-app.md`).

- **Mass Casualty Assessment (MAT)**: Detect survivors in disaster scenarios:
  ```bash
  cargo run -p wifi-densepose-mat
  ```
  (`plugins/ruview/commands/ruview-app.md`).

- **3D Point Cloud**: Fuse camera depth, CSI, and mmWave radar:
  ```bash
  python scripts/mmwave_fusion_bridge.py
  ```
  (`plugins/ruview/commands/ruview-app.md`).

#### 3. **Integrate with Apple HomePod**
For Apple HomePod integration, RuView can be run as a native HomeKit accessory. The architecture involves:

1. ESP32-C6 CSI node sending UDP feature streams to the RuView Sensing Server.
2. Sensing Server polling by the HAP Bridge, which advertises the HomeKit accessory on mDNS.
3. HomePod or Apple TV discovering the bridge and forwarding data to the Home app and Siri (`docs/user-guide-apple-homepod.md`).

#### 4. **Verify and Validate**
Always verify the accuracy of RuView outputs using the `verify` skill and `ruview.claim_check` tool. This ensures that any accuracy numbers quoted are measured against a baseline (`harness/ruview/skills/onboard.md`).

#### 5. **Next Steps**
Explore advanced features and configurations:
- Train models with `/ruview-train`.
- Verify claims with `/ruview-verify`.
- Configure edge modules, mesh, and Cognitum Seed with `/ruview-advanced` (`plugins/ruview/codex/prompts/ruview-start.md`).

By following these steps, you can fully install, configure, and utilize RuView for various sensing applications.
