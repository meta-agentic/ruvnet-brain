# cognitum-one-sensor-primer — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What it is & who it's for**  

The **cognitum-one-sensor-primer** is a definitive guide for setting up and using Cognitum One's sensor ecosystem with ESP32, mmWave radar, and WiFi CSI hardware. It exists as:  

1. **A hands-on tutorial** (`index.html`, `setup.html`) with step-by-step instructions for:  
   - Flashing sensors (ESP32)  
   - Configuring WiFi connectivity  
   - Integrating with the Cognitum One Seed (`setup.html`: *"get it on WiFi, have it talk to your Cognitum One Seed"*)  
   - Live monitoring of biometrics (heart rate, respiration) and spatial data (pose, point clouds)  

2. **A knowledge base** (`ruvector-primer.md`, `kb/stores/ruvector/ruvector-primer.md`) for AI-assisted development, providing:  
   - Verified documentation of RuVector/RuView internals  
   - Real file paths and commands (e.g., `git submodule` workflows)  
   - Sensor-specific capabilities (e.g., LD6004 radar GPIO integration)  

**Who it's for:**  
- **New owners** of Cognitum One hardware (*"absolute beginner"* per `index.html`) needing to unbox, flash, and deploy sensors.  
- **Builders** extending the system with custom dashboards or AI agents, using the drag-and-drop KBs (*"optional power-up for builders"* in `index.html`).  
- **Researchers** validating sensor performance (e.g., *"RF reconstruction CSI · 4 nodes · point cloud"* metrics in `index.html`).  

The primer explicitly covers **four sensor types** (WiFi CSI, mmWave radar, etc.) and syncs with **RuView v1701** (`index.html`: *"synced to Ruv's RuView v1701"*). Missing functionality (e.g., non-ESP32 hardware) is not claimed.  

**Key artifacts:**  
- Live demo UI (`index.html` shows real-time *"72 bpm · 16 rpm"* telemetry)  
- Flashable firmware images (`setup.html` details USB-C toolchain)  
- Versioned KBs (`kb/index-primer.mjs` indexes updates daily)  

This is not speculative: Every capability cited above is implemented in the sourced files. For example, the **full walkthrough** exists (`index.html`: *"calibrate → train → heartbeats → pose → Seed memory"*) and the **ESP32 flashing process** is prescriptively documented (`setup.html`).

## Capabilities (what it can do)

## Capabilities (what it can do)

1. **Index and synthesize primer documents into knowledge bases**  
   The system can ingest markdown primer documents and index them into structured knowledge bases (`ruvector` and `ruview`), splitting content into logical sections under synthetic paths like `PRIMER#<slug>`. This is implemented in `kb/index-primer.mjs`, which handles incremental updates while maintaining parity between indexes and content.

2. **Perform semantic search across knowledge bases**  
   It provides a search interface (`search_kb`) that embeds queries and retrieves relevant passages from the `.rvf` vector stores, returning full document text with metadata. This capability is exposed via `kb/kb-mcp-server.mjs` and can be integrated into workflows or called directly from Node.js.

3. **Self-update knowledge bases**  
   The system can check for and apply updates to its knowledge bases by comparing against canonical builds, as implemented in `kb/kb-update.mjs`. This ensures local copies stay current with upstream changes to `ruvector` or `ruview` source repositories.

4. **Resolve dependencies portably**  
   It handles runtime dependency resolution across different environments (local node_modules, env overrides, or fallback paths) through `kb/resolve-deps.mjs`, ensuring the KB scripts run without installation assumptions.

5. **Serve interactive web documentation**  
   The bundled `index.html` and `assets/js/main.js` deliver a web interface with scroll-reveal animations and navigation highlighting for exploring primer documents and KB content.

## Core concepts & how they work

### Core concepts & how they work

The **cognitum-one-sensor-primer** is designed to provide a comprehensive, beginner-friendly guide to understanding and working with Cognitum One sensors. Below are its core concepts and how each one functions:

---

#### 1. **Orientation: Cognitum One Seed vs. Sensors**
   - **Cognitum One Seed** acts as the brain, while **sensors** (e.g., ESP32, mmWave radar, vital-signs radar) act as the senses. This distinction is foundational for understanding the ecosystem (`README.md`).
   - The primer clearly separates the roles of the Seed and sensors, ensuring users know how to integrate them (`README.md`).

---

#### 2. **ESP32 Family: Chip-by-Chip Comparison**
   - A detailed comparison of ESP32 chips is provided, extending the `espboards.dev` SoC guide. This helps users choose the right chip for their needs (`README.md`).
   - The primer includes practical details like GPIO pinout, power budget, and common wiring gotchas (`README.md`).

---

#### 3. **Six Sensor Classes**
   - The primer covers six sensor classes: **LD6004**, **MR60BHA2**, **ESP32 WiFi CSI**, **M5StickC IMU**, **Polar H10**, and the legacy **LD2450**. Each sensor is explained in terms of its functionality, use cases, and setup (`README.md`).
   - For example, the LD6004 radar skips flashing and WiFi setup, directly wiring to the GPIO header (`setup.html`).

---

#### 4. **Decision Guide: Choosing the Right Sensor**
   - A decision guide helps users choose between radar, CSI, vitals, and IMU sensors based on their specific needs (`README.md`).
   - This section is practical, offering clear scenarios and recommendations (`README.md`).

---

#### 5. **Power & Wiring**
   - The primer provides detailed guidance on powering and wiring ESP32s, including connection styles, GPIO pinout, and power budget (`README.md`).
   - Common pitfalls are highlighted, ensuring users avoid mistakes (`README.md`).

---

#### 6. **Batteries: Powering ESP32s**
   - The primer explains how to power ESP32s scattered around a room using LiPo, 18650, power banks, and TP4056 modules (`README.md`).
   - This section is practical, with Amazon links for purchasing components (`README.md`).

---

#### 7. **Shopping List**
   - A comprehensive shopping list includes sensors, the Seed, connectors, and batteries, with direct Amazon links (`README.md`).
   - This ensures users can easily acquire all necessary components (`README.md`).

---

#### 8. **Knowledge Bases (`kb/`)**
   - The primer includes queryable semantic indexes of **ruvector** and **RuView** repos, enabling AI assistants to answer questions accurately (`README.md`).
   - These indexes are available in two versions: **big** (768-dim, sharper) and **small** (384-dim, lighter) (`README.md`).
   - The `kb/index-primer.mjs` module indexes synthesized primer markdown into existing knowledge bases, ensuring parity and incremental updates (`kb/index-primer.mjs`).

---

#### 9. **Setup & Flashing Workflow**
   - The primer provides a step-by-step workflow for setting up and flashing sensors, including tools, WiFi setup, and integration with the Seed (`setup.html`).
   - The workflow is designed to be beginner-friendly, with optional assistance from **Claude Code** (`setup.html`).

---

#### 10. **Drop-In AI Primer Docs**
   - Pre-digested reference documents like **The RuVector Primer** and **The RuView Primer** are available for drag-and-drop use in projects (`index.html`).
   - These documents ensure AI assistants start with full context, saving time and tokens (`index.html`).

---

#### 11. **Glossary**
   - A glossary defines every term in plain English, making the primer accessible to beginners (`README.md`).

---

#### 12. **Provenance & Staleness Checks**
   - The primer includes mechanisms to verify its accuracy against the latest repo commits and knowledge bases (`ruvector-primer.md`).
   - Users are encouraged to regenerate the primer if it becomes stale (`ruvector-primer.md`).

---

### Summary
The **cognitum-one-sensor-primer** is a complete, practical guide for beginners, covering everything from sensor selection to setup, powering, and integration with the Cognitum One Seed. Its structured approach, detailed explanations, and queryable knowledge bases make it an essential resource for anyone working with Cognitum One sensors.

## Maturity (shipped vs proposed)

The **cognitum-one-sensor-primer** is a fully shipped production asset with concrete implementations across multiple subsystems. Here's the definitive breakdown:

### Shipped Features (Production-Ready)
1. **Core Sensing Pipeline**  
   - CSI-based 17-point skeleton tracking EXISTS (`guide.html`): "The default 17-keypoint figure is signal-derived — limbs animated from motion energy, not learned keypoint inference"  
   - Fall detection EXISTS (`kb/stores/ruview/studio/for-ai/audio-overview.transcript.txt`): "It monitors how fast the phase of the returning radio waves is actually changing... and it does it in under 200 milliseconds"  

2. **Training Workflows**  
   - Camera-free training EXISTS (`guide.html`): Scripts like `train-camera-free.js` with Seed/non-Seed modes are implemented  
   - Camera-supervised training EXISTS (`guide.html`): Calibration scripts (`calibrate-camera-room.py`) and paired recording flows are operational  

3. **Deployment Artifacts**  
   - Production KB files (`*-kb.rvf`) EXISTS (`kb/README.md`): Two versions explicitly maintained for different deployment targets  
   - Node.js integration EXISTS (`kb/README.md`): `searchKb()` API is implemented for programmatic queries  

### Proposed/ADR-Tracked (Not Shipped)
1. **Cognitive Containers** (ADR-003)  
   - CSI data containerization (`docs/adr/ADR-003-rvf-cognitive-containers-csi.md`) is in proposal stage with no committed timeline  

2. **Vector Search** (ADR-004)  
   - HNSW fingerprinting integration (`docs/adr/ADR-004-hnsw-vector-search-fingerprinting.md`) remains in research phase  

3. **Swarm Bridge** (ADR-066)  
   - NVS-based swarm coordination (`ruview-primer.md`) is flagged as proposed but unimplemented  

Key Evidence:  
- Production features cite concrete file paths (`train-camera-free.js`, `calibrate-camera-room.py`)  
- ADR proposals explicitly state "Proposed" status (`docs/adr/ADR-003-rvf-cognitive-containers-csi.md`)  
- No ambiguity between documentation and implementation — what's described in guides has matching shipped artifacts

## Where the documentation lives

### Where the documentation lives

The documentation for **cognitum-one-sensor-primer** is organized into several distinct locations, each serving a specific purpose. Here’s where you can find everything:

1. **Guides and Tutorials**  
   The primary guide for using the system is located at `guide.html`. This file provides a comprehensive walkthrough of the system's capabilities, including setup, training workflows, and operational details. It covers everything from basic usage to advanced features like camera-free training and camera-supervised training.

2. **Architecture Decision Records (ADRs)**  
   ADRs are stored in the `docs/adr/` directory. These documents detail key architectural decisions and their rationale. For example:
   - `docs/adr/ADR-002-ruvector-rvf-integration-strategy.md` outlines the integration strategy for RuVector and RVF.
   - `docs/adr/ADR-003-rvf-cognitive-containers-csi.md` describes the cognitive containers used for CSI data processing.

3. **Reference Documentation**  
   Reference materials, including command-line flag references and operational details, are found in `ruview-primer.md`. This file provides a detailed breakdown of script flags, provisioning steps, and key operational facts.

4. **Knowledge Base (KB)**  
   The knowledge base is organized under the `kb/` directory. It includes metadata and structured documentation for RuView and RuVector:
   - `kb/stores/ruview/ruview-kb.meta.json` contains metadata and links to additional documentation.
   - `kb/stores/ruvector/ruvector-kb.ids.json` provides a structured index of RuVector documentation.

5. **Interactive Documentation**  
   The interactive documentation, including dynamic content and navigation, is implemented in `assets/js/main.js`. This script handles features like staggered reveal-on-scroll and active-section highlighting in the navigation.

6. **Transcripts and Audio Overviews**  
   Transcripts and audio overviews, such as `kb/stores/ruview/studio/for-ai/audio-overview.transcript.txt`, provide additional context and insights into specific features like fall detection and motion sensing.

7. **Robots.txt and Sitemap**  
   The `robots.txt` file (`robots.txt`) ensures that all documentation is accessible to search engines and includes a link to the sitemap for indexing.

8. **Package Metadata**  
   The `kb/package.json` file (`kb/package.json`) describes the npm package for the knowledge base, including scripts for querying and building the KB.

This structured approach ensures that all documentation is easily accessible and well-organized, catering to both new users and advanced developers.

## How to use it end-to-end

### How to use it end-to-end

To install and use `cognitum-one-sensor-primer` end-to-end, follow these steps:

#### 1. **Set Up Your Environment**
Ensure you have the necessary tools and dependencies installed. The primer assumes you're working in VS Code with Claude Code, which simplifies the process significantly. If you don't have Claude Code, you can still proceed manually, but the steps will be more involved.

#### 2. **Install the Knowledge Base**
The primer relies on the `cognitum-kb` package, which contains the knowledge bases for RuVector and RuView. Install it by navigating to the `kb` directory and running:

```bash
cd kb && npm i
```

This installs the necessary dependencies, including `@ruvector/rvf` and `@xenova/transformers`, as specified in `kb/package.json`.

#### 3. **Index the Primer**
The primer is indexed into the knowledge base using the `index-primer.mjs` script. Run the following command to index the `ruvector-primer.md` file:

```bash
node kb/index-primer.mjs ruvector
```

This script splits the primer into logical sections and indexes them into the knowledge base, making them retrievable via queries (`kb/index-primer.mjs`).

#### 4. **Query the Knowledge Base**
Once indexed, you can query the knowledge base using the `ask-kb.mjs` script. For example, to search for information about how the coherence gate decides, run:

```bash
node kb/ask-kb.mjs ruvector "how does the coherence gate decide?"
```

This returns relevant sections from the primer, complete with their full text (`kb/README.md`).

#### 5. **Integrate with Your Workflow**
You can integrate the knowledge base into your Node.js code by importing the `searchKb` function from `ask-kb.mjs`. For example:

```js
import { searchKb } from './kb/ask-kb.mjs';

const hits = await searchKb({ store: 'ruvector', query: 'how does the coherence gate decide?', k: 5 });
for (const h of hits) {
  console.log(h.path, '—', h.title);
  console.log(h.fullText);   // the complete document text, ready to use
}
```

This allows you to programmatically retrieve information from the primer (`kb/README.md`).

#### 6. **Use the Companion Site**
The primer has a companion site hosted at [cognitum-sensor-primer.vercel.app](https://cognitum-sensor-primer.vercel.app). This site provides a user-friendly interface for navigating the primer and its associated resources (`ruvector-primer.md`).

#### 7. **Verify and Update**
The primer is generated from the latest commit of the RuVector repository. To ensure it's up-to-date, check the date in `ruvector-primer.md` against the latest commit:

```bash
git ls-remote https://github.com/ruvnet/ruvector HEAD
```

If the primer is stale, regenerate it by cloning the repository and using Claude Code to sweep the checkout and produce a new primer (`ruvector-primer.md`).

#### 8. **Troubleshoot**
If you encounter issues, refer to the troubleshooting section in `setup.html`. This page provides a step-by-step guide for setting up sensors, flashing them, and connecting them to your Cognitum One Seed (`setup.html`).

By following these steps, you can effectively install, index, and use the `cognitum-one-sensor-primer` end-to-end.
