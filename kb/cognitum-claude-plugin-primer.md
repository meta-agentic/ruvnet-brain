# cognitum-claude-plugin — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

### What it is & who it's for

**cognitum-claude-plugin** is a modular plugin system developed by Cognitum, designed to extend the functionality of Claude, Cognitum's core platform. It provides a suite of specialized "cogs" (plugins) that enable advanced detection, monitoring, and analysis capabilities across various domains, including security, signal processing, and AI-driven behavior analysis. Each cog is a self-contained module with a specific purpose, allowing users to tailor Claude's functionality to their needs.

#### Key Features and Capabilities
The plugin system includes the following cogs, each with distinct functionality:
1. **Adversarial Detection**: Detects tampered or spoofed sensor signals (`plugins/adversarial/.claude-plugin/plugin.json`).
2. **Spiking Tracker**: A brain-inspired tracker optimized for tiny hardware (`plugins/spiking-tracker/.claude-plugin/plugin.json`).
3. **Intrusion Detection**: Alerts when unauthorized individuals enter a monitored area (`plugins/intrusion/.claude-plugin/plugin.json`).
4. **Temporal Logic Guard**: Enforces safety rules on live event streams (`plugins/temporal-logic/.claude-plugin/plugin.json`).
5. **Coherence Gate**: Filters out noisy signals while preserving clean ones (`plugins/coherence-gate/.claude-plugin/plugin.json`).
6. **Behavioral Profiler**: Learns normal behavior patterns and flags anomalies (`plugins/behavioral-profiler/.claude-plugin/plugin.json`).
7. **Loitering Detection**: Alerts when individuals linger too long in a specific area (`plugins/loitering/.claude-plugin/plugin.json`).
8. **Coherence Monitor**: Monitors signal quality across multiple channels (`plugins/coherence/.claude-plugin/plugin.json`).

#### Who it's for
cognitum-claude-plugin is designed for:
- **Developers**: Those building custom solutions on the Claude platform, leveraging cogs like Coherence Monitor and Temporal Logic Guard (`plugins/coherence/.claude-plugin/plugin.json`, `plugins/temporal-logic/.claude-plugin/plugin.json`).
- **Security Professionals**: Users focused on intrusion detection, loitering detection, and behavioral profiling (`plugins/intrusion/.claude-plugin/plugin.json`, `plugins/loitering/.claude-plugin/plugin.json`, `plugins/behavioral-profiler/.claude-plugin/plugin.json`).
- **AI Enthusiasts**: Individuals interested in brain-inspired AI solutions like the Spiking Tracker (`plugins/spiking-tracker/.claude-plugin/plugin.json`).
- **Signal Processing Experts**: Those working with noisy or complex signals, utilizing tools like Coherence Gate (`plugins/coherence-gate/.claude-plugin/plugin.json`).

The plugin system is proprietary and maintained by Cognitum, with detailed documentation and support available through their official channels.

## Capabilities (what it can do)

## Capabilities (what it can do)

The cognitum-claude-plugin provides the following concrete capabilities, each implemented in specific plugin files:

1. **Signal Noise Filtering**  
   EXISTS in `plugins/coherence-gate/.claude-plugin/plugin.json` - Filters out noisy signals while preserving clean ones ("Cognitum cog: Coherence Gate")

2. **Multi-Channel Signal Monitoring**  
   EXISTS in `plugins/coherence/.claude-plugin/plugin.json` - Monitors signal quality across multiple channels ("Cognitum cog: Coherence Monitor")

3. **Focused Attention Control**  
   EXISTS in `plugins/flash-attention/.claude-plugin/plugin.json` - Concentrates sensing on specific areas for improved accuracy ("Cognitum cog: Flash Attention")

4. **Adversarial Signal Detection**  
   EXISTS in `plugins/adversarial/.claude-plugin/plugin.json` - Identifies tampered or spoofed sensor signals ("Cognitum cog: Adversarial Detection")

5. **Real-Time Safety Enforcement**  
   EXISTS in `plugins/temporal-logic/.claude-plugin/plugin.json` - Applies safety rules to live event streams ("Cognitum cog: Temporal Logic Guard")

6. **Centralized System Management**  
   EXISTS in `.claude-plugin/plugin.json` - Provides Seed catalog, CRM integration, and system status via MCP server ("Cognitum MCP server")

7. **Tamper-Proof Audit Logging**  
   EXISTS in `plugins/audit-logger/.claude-plugin/plugin.json` - Records all actions in an immutable compliance log ("Cognitum cog: Audit Trail Logger")

8. **Data Compression**  
   EXISTS in `plugins/temporal-compress/.claude-plugin/plugin.json` - Reduces memory usage by compressing historical data without semantic loss ("Cognitum cog: Temporal Compress")

The plugin does NOT currently provide capabilities for:  
- Image processing  
- Natural language generation  
- Physical device control  
(as these are not mentioned in any of the cited source files)

## Core concepts & how they work

### Core concepts & how they work

The **cognitum-claude-plugin** is a modular system composed of specialized components called "cogs," each designed to handle specific tasks or functionalities. Below are the core concepts and how they work, based on the provided sources:

---

#### 1. **Gesture Recognition**  
The **Gesture Recognition** cog (`cog-gesture`) is a foundational building block for recognizing gestures. It processes input data to identify and interpret physical gestures, enabling interaction with systems through body movements.  
**Implementation:** `plugins/gesture/.claude-plugin/plugin.json`  

---

#### 2. **Coherence Gate**  
The **Coherence Gate** cog (`cog-coherence-gate`) filters out noisy signals while preserving clean ones. It ensures that only high-quality, coherent data is passed through, improving the reliability of downstream processes.  
**Implementation:** `plugins/coherence-gate/.claude-plugin/plugin.json`  

---

#### 3. **Federated Learning**  
The **Federated Learning** cog (`cog-federated-learning`) enables AI training across multiple "seeds" (devices or nodes) without sharing raw data. This decentralized approach enhances privacy and scalability in machine learning workflows.  
**Implementation:** `plugins/federated-learning/.claude-plugin/plugin.json`  

---

#### 4. **Coherence Monitor**  
The **Coherence Monitor** cog (`cog-coherence`) monitors signal quality across multiple channels. It ensures that data streams remain consistent and reliable, providing insights into the health of communication pathways.  
**Implementation:** `plugins/coherence/.claude-plugin/plugin.json`  

---

#### 5. **Temporal Logic Guard**  
The **Temporal Logic Guard** cog (`cog-temporal-logic`) enforces safety rules on live event streams. It uses temporal logic to validate and constrain real-time data, ensuring compliance with predefined safety protocols.  
**Implementation:** `plugins/temporal-logic/.claude-plugin/plugin.json`  

---

#### 6. **Psycho-Symbolic Reasoning**  
The **Psycho-Symbolic** cog (`cog-psycho-symbolic`) reasons over knowledge graphs using multiple reasoning styles. It combines symbolic and psychological approaches to derive insights from structured data.  
**Implementation:** `plugins/psycho-symbolic/.claude-plugin/plugin.json`  

---

#### 7. **Emotion Detection**  
The **Emotion Detection** cog (`cog-emotion-detect`) reads stress and calm levels from body language and breathing patterns. It provides real-time emotional state analysis, useful for applications in health, wellness, and human-computer interaction.  
**Implementation:** `plugins/emotion-detect/.claude-plugin/plugin.json`  

---

#### 8. **Meta Adapt**  
The **Meta Adapt** cog (`cog-meta-adapt`) automatically tunes itself for optimal performance. It dynamically adjusts parameters and configurations to adapt to changing conditions, ensuring efficiency and effectiveness.  
**Implementation:** `plugins/meta-adapt/.claude-plugin/plugin.json`  

---

### Summary  
Each cog in the **cognitum-claude-plugin** system is a specialized module designed to perform a specific function, from gesture recognition and emotion detection to federated learning and temporal logic enforcement. These cogs work together to create a robust, modular framework for advanced AI and signal processing applications.

## Maturity (shipped vs proposed)

### Maturity (shipped vs proposed)

The `cognitum-claude-plugin` is **fully mature and shipped**, with all features implemented and accepted as of April 29, 2026. Each plugin is backed by an **Accepted ADR** (Architectural Decision Record), confirming its design, implementation, and readiness for production use. Below is a breakdown of the shipped features and their maturity status:

#### Shipped Features (Accepted ADRs)
1. **Predictive Maintenance**  
   - EXISTS: The `/predictive-maintenance` slash command is fully implemented and shipped.  
   - Source: `plugins/predictive-maintenance/docs/ADR-predictive-maintenance.md`  
   - Implementation: `cognitum-one/cognitum-claude-plugin/cogs/predictive-maintenance/`

2. **Fall Detection**  
   - EXISTS: The `/fall-detect` slash command is fully implemented and shipped.  
   - Source: `plugins/fall-detect/docs/ADR-fall-detect.md`  
   - Implementation: `cognitum-one/cogs:src/cogs/fall-detect/`

3. **Cough Detection**  
   - EXISTS: The `/cough-detect` slash command is fully implemented and shipped.  
   - Source: `plugins/cough-detect/docs/ADR-cough-detect.md`  
   - Implementation: `cognitum-one/cogs:src/cogs/cough-detect/`

4. **Baby Cry Detection**  
   - EXISTS: The `/baby-cry` slash command is fully implemented and shipped.  
   - Source: `plugins/baby-cry/docs/ADR-baby-cry.md`  
   - Implementation: `cognitum-one/cogs:src/cogs/baby-cry/`

5. **Water Leak Detection**  
   - EXISTS: The `/water-leak` slash command is fully implemented and shipped.  
   - Source: `plugins/water-leak/docs/ADR-water-leak.md`  
   - Implementation: `cognitum-one/cognitum-claude-plugin/cogs/water-leak/`

6. **Frost Warning**  
   - EXISTS: The `/frost-warning` slash command is fully implemented and shipped.  
   - Source: `plugins/frost-warning/docs/ADR-frost-warning.md`  
   - Implementation: `cognitum-one/cognitum-claude-plugin/cogs/frost-warning/`

7. **Adversarial Detection**  
   - EXISTS: The `/adversarial` slash command is fully implemented and shipped.  
   - Source: `plugins/adversarial/docs/ADR-adversarial.md`  
   - Implementation: `cognitum-one/cogs:src/cogs/adversarial/`

8. **Air Quality Index**  
   - EXISTS: The `/air-quality-index` slash command is fully implemented and shipped.  
   - Source: `plugins/air-quality-index/docs/ADR-air-quality-index.md`  
   - Implementation: `cognitum-one/cogs:src/cogs/air-quality-index/`

#### Proposed Features
There are **no proposed features** in the provided sources. All plugins are fully shipped and accepted, with no pending or speculative functionality.

#### Conclusion
The `cognitum-claude-plugin` is **production-ready**, with all features implemented, tested, and documented. Each plugin is backed by an Accepted ADR, ensuring clarity and consistency in design and usage. For further details, refer to the specific ADRs and implementation paths cited above.

## Where the documentation lives

## Where the documentation lives

The cognitum-claude-plugin's documentation is organized across two primary locations:

1. **Official Cognitum Store Documentation**  
   Each plugin has dedicated documentation hosted at `https://cognitum.one/store/cogs/[plugin-name]` as confirmed by the `homepage` field in every plugin's manifest (e.g., `plugins/coherence/.claude-plugin/plugin.json` shows `"homepage": "https://cognitum.one/store/cogs/coherence"`). This includes:
   - Usage guides
   - Versioned release notes (via `version` field in manifests)
   - Commercial licensing terms (all manifests declare `"license": "Proprietary"`)

2. **GitHub Repository Metadata**  
   The canonical source repository at `https://github.com/cognitum-one/cognitum-claude-plugin` contains:
   - Plugin manifests (e.g., `.claude-plugin/plugin.json` for core MCP server)
   - Implementation-specific documentation via `description` fields (e.g., `plugins/ppe-compliance/.claude-plugin/plugin.json` documents PPE detection logic)
   - Developer-oriented keywords (e.g., `plugins/psycho-symbolic/.claude-plugin/plugin.json` tags knowledge graph capabilities)

No ADRs (Architecture Decision Records) or detailed technical design documents are visible in the provided source paths. For implementation details, the plugin manifests and store documentation are the authoritative sources.

## How to use it end-to-end

### How to use it end-to-end

To install and use the `cognitum-claude-plugin`, follow these steps:

1. **Install the Plugin**  
   The plugin is available as part of the Cognitum ecosystem. Ensure you have access to the repository and install it via the provided methods. The plugin is structured into multiple components, each serving a specific purpose.  

2. **Configure the Plugin**  
   Each component of the plugin has its own configuration file (`plugin.json`). For example:  
   - The `cognitum-seed` plugin connects to a local Seed appliance and provides tools for setup, pairing, and sensor flows (`cognitum-seed/.claude-plugin/plugin.json`).  
   - The `cog-meta-adapt` plugin automatically tunes itself for optimal performance (`plugins/meta-adapt/.claude-plugin/plugin.json`).  
   - The `cog-coherence-gate` plugin filters noisy signals to maintain clean data (`plugins/coherence-gate/.claude-plugin/plugin.json`).  

3. **Use the Plugin Features**  
   The plugin offers a variety of functionalities:  
   - **Device Management**: Use the `cognitum-seed` plugin to connect to a local Seed appliance and manage its tools (`cognitum-seed/.claude-plugin/plugin.json`).  
   - **Signal Processing**: Leverage the `cog-coherence-gate` and `cog-coherence` plugins to monitor and filter signal quality (`plugins/coherence-gate/.claude-plugin/plugin.json`, `plugins/coherence/.claude-plugin/plugin.json`).  
   - **Attention Optimization**: The `cog-flash-attention` plugin focuses sensing on specific areas for better accuracy (`plugins/flash-attention/.claude-plugin/plugin.json`).  
   - **Data Compression**: Use the `cog-temporal-compress` plugin to shrink old data and save memory (`plugins/temporal-compress/.claude-plugin/plugin.json`).  
   - **Local Document Search**: The `cog-rag-local` plugin enables AI-powered document search on the Seed (`plugins/rag-local/.claude-plugin/plugin.json`).  

4. **Access Additional Resources**  
   For support, documentation, and updates, refer to the `cognitum-mcp` plugin, which provides access to the Seed catalog, CRM leads, order status, and more (`.claude-plugin/plugin.json`).  

5. **Verify Licensing**  
   All components of the plugin are proprietary (`plugins/meta-adapt/.claude-plugin/plugin.json`, `plugins/coherence-gate/.claude-plugin/plugin.json`, etc.). Ensure compliance with the licensing terms provided in each `plugin.json` file.  

By following these steps, you can fully utilize the `cognitum-claude-plugin` to manage devices, optimize performance, and process data effectively.
