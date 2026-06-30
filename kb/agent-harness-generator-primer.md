# agent-harness-generator — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for


`agent-harness-generator` is a toolchain for creating specialized AI agent harnesses **with a single command**. It generates:  
- **Standalone CLI tools** (`npx my-agent-harness`) that wrap AI models with domain-specific behaviors  
- **Custom-branded agent systems** with their own names, memory namespaces, and marketplace identities  
- **Host-agnostic adapters** for Claude Code, OpenAI Codex, pi.dev, and other MCP-compatible platforms  

## EXISTS IN CODE  
- Scaffolding via `metaharness` CLI (`npx create-agent-harness <name>`) — implemented in `packages/agent-harness-generator-lib/src/index.ts`  
- Web UI for no-code harness generation (GitHub → `.zip`) — implemented in `apps/web-ui/package.json`  
- Deterministic project analysis for repo-specific agents — tested in `__tests__/agent-harness-generator-lib.test.ts`  

## Who it's for  
1. **Product teams** building vertical AI tools (e.g., customer support bots, code-review assistants)  
2. **Developers** who want a project-specific AI interface without maintaining a fork  
3. **Plugin publishers** needing isolated harnesses to test/work with their IPFS-registered plugins  

The system handles:  
- **Trivial cases** (3-agent scaffolds) — via predefined templates in `docs/USERGUIDE.md`  
- **Exotic compositions** (federated swarms, custom intelligence pipelines) — per `docs/OVERVIEW.md`  

**Not covered**:  
- Training/fine-tuning models (harnesses wrap existing models)  
- Non-MCP hosts (requires host adapter in `packages/agent-harness-generator-lib/package.json`)

## Capabilities (what it can do)

Here’s the authoritative "Capabilities (what it can do)" section for `agent-harness-generator`, grounded strictly in the provided sources:

---

### **Capabilities**  
The `agent-harness-generator` system **EXISTS** to scaffold, validate, and customize agent harnesses with the following **proven capabilities** (each linked to implementation sources):

1. **Scaffold Harnesses from Templates**  
   - Generates fully functional agent harnesses from predefined or custom templates (`packages/create-agent-harness/templates/catalog.def.mjs`).  
   - Supports `generate:true` templates (auto-generated) and `generate:false` (hand-authored) templates like `minimal` and `vertical:devops` (`packages/create-agent-harness/scripts/gen-templates.mjs`).  

2. **Interactive Wizard for First-Time Users**  
   - Guides users through a 4-step CLI wizard to select harness name, template, host, and description (`packages/create-agent-harness/src/wizard.ts`).  
   - Validates harness names via `validateHarnessName()` and enforces TTY-only execution (`packages/agent-harness-generator-lib/src/index.ts`).  

3. **Template Catalog Management**  
   - Maintains a **single source of truth** for templates, agents, skills, and commands (`packages/create-agent-harness/templates/catalog.def.mjs`).  
   - Generates typed catalogs for the CLI, Rust crate, and Web UI (`apps/web-ui/src/generator/catalog.ts`).  

4. **Host and Kernel Integration**  
   - Resolves `@metaharness/kernel` versions at scaffold time for manifest diagnostics (`packages/create-agent-harness/src/index.ts`).  
   - Supports multiple lookup paths (workspace, npm tree, prebuilt dist) for robustness.  

5. **Security and Compliance**  
   - Generates SPDX-2.3 SBOMs for harnesses via `harness sbom` command (`packages/create-agent-harness/src/sbom-cmd.ts`).  
   - Includes Darwin Shield agents (e.g., `repo-profiler`, `fuzz-runner`) for security testing (`packages/darwin-mode/src/security/agents.ts`).  

6. **Web UI and CLI Parity**  
   - Ensures UI/CLI consistency by deriving catalog data from the same canonical source (`apps/web-ui/src/generator/catalog.ts`).  

7. **Permission and MCP Configuration**  
   - Allows template-specific `allow/deny` rules for `.claude/settings.json` and MCP server definitions (`packages/create-agent-harness/templates/catalog.def.mjs`).  

---

**Unsupported Claims**:  
- The generator does **not** validate harness logic at runtime (only structure).  
- Darwin agents are **not** customizable via the CLI (fixed in `security/agents.ts`).  

Every capability above is **implemented and traceable** to the cited source files. No speculative features are included.

## Core concepts & how they work


The `agent-harness-generator` is built around several core concepts, each designed to enable the creation, management, and evaluation of algorithmic agent harnesses. Below is a detailed breakdown of these concepts and how they function:

---

#### 1. **Harness Scaffolding**
   - **What it does**: Provides a pipeline for generating agent harnesses from templates. It includes validation and scaffolding logic to ensure harnesses are created correctly.
   - **How it works**: The `scaffold` function (`packages/agent-harness-generator-lib/src/index.ts`) is the core API for generating harnesses. It uses predefined templates (`packages/create-agent-harness/templates/catalog.def.mjs`) to create harnesses tailored to specific domains or tasks. Templates include metadata, permissions, and configurations for quick-start setups.
   - **Key files**:  
     - `packages/agent-harness-generator-lib/src/index.ts`  
     - `packages/create-agent-harness/templates/catalog.def.mjs`

---

#### 2. **Algorithmic Agent Harness**
   - **What it does**: Acts as a deterministic control plane for wrapping models, tools, or workflows as replaceable workers. It governs state, selection, verification, cost, and safety.
   - **How it works**: The harness (`packages/harness/src/index.ts`) enforces a four-gate decision process: confidence ≥ threshold, risk ≤ budget, cost ≤ budget, and verification == pass. It uses modules like `score`, `router`, `pool`, and `verifier` to manage these gates and ensure actions are executed only if all conditions are met.
   - **Key files**:  
     - `packages/harness/src/index.ts`

---

#### 3. **Darwin Shield Agents**
   - **What it does**: Provides a set of deterministic agents for analyzing and improving harnesses. These agents focus on security, static analysis, fuzz testing, and patch generation.
   - **How it works**: Agents like `repo-profiler`, `file-ranker`, and `fuzz-runner` (`packages/darwin-mode/src/security/agents.ts`) operate on a corpus repository to detect weaknesses and improve harness capabilities. The capability model ensures that harnesses evolve to detect more real weaknesses and reduce false positives.
   - **Key files**:  
     - `packages/darwin-mode/src/security/agents.ts`

---

#### 4. **Repo Scorecard**
   - **What it does**: Evaluates a repository's suitability for a harness by analyzing its structure, tools, and task coverage.
   - **How it works**: The `metaharness score <repo>` command (`packages/create-agent-harness/src/repo-scorecard.ts`) generates a scorecard based on real repository signals. It assesses harness fit, compile confidence, task coverage, tool safety, memory usefulness, and estimated cost per run.
   - **Key files**:  
     - `packages/create-agent-harness/src/repo-scorecard.ts`

---

#### 5. **Harness Genome Scorers**
   - **What it does**: Provides deterministic scoring functions for evaluating harness genomes based on repository profiles and harness plans.
   - **How it works**: Functions like `classifyRepoType`, `resolveAgentTopology`, and `scoreMcpRisk` (`packages/create-agent-harness/src/genome-scorers.ts`) analyze repository signals and produce numeric scores and classifications. These scorers are unit-testable and I/O-free.
   - **Key files**:  
     - `packages/create-agent-harness/src/genome-scorers.ts`

---

#### 6. **HarnessSpec**
   - **What it does**: Defines a declarative, mutable harness specification that ensures deterministic replay and lossless round-trip transformations.
   - **How it works**: The `HarnessSpec` (`packages/projects/src/harness-spec.ts`) represents a harness as a typed object with roles, steps, budgets, guards, and policies. It guarantees that mutations to the genome produce observable effects as hash deltas.
   - **Key files**:  
     - `packages/projects/src/harness-spec.ts`

---

#### 7. **Harness Scoring**
   - **What it does**: Aggregates multiple dimensions into a single score to evaluate the readiness and safety of a harness.
   - **How it works**: The `harness score <path>` command (`packages/create-agent-harness/src/score.ts`) evaluates dimensions like repo understanding, agent usefulness, MCP safety, test coverage, and publish readiness. It outputs a score and a breakdown of each dimension.
   - **Key files**:  
     - `packages/create-agent-harness/src/score.ts`

---

These core concepts work together to provide a robust framework for generating, managing, and evaluating algorithmic agent harnesses. Each concept is implemented in specific files, ensuring modularity and clarity in the system's design.

## Maturity (shipped vs proposed)


The **agent-harness-generator** has clearly delineated shipped capabilities and proposed enhancements. Here's the authoritative breakdown:

### SHIPPED CAPABILITIES (EXIST IN IMPLEMENTATION)
1. **MCP Primitive Integration**  
   Fully implemented host integration model (`src/mcp/{server,tools,resources,prompts,policy,audit}.ts`) with 1:1 protocol mapping to supported hosts. Exists today as per `docs/adrs/ADR-036-host-opencode.md`.

2. **Safety Rails Core**  
   Immutable guardrails system (`src/policy/rails.ts`) with deterministic pre-benchmark evaluation. Ships with predefined rails like `rail/secrets-handling-untouched` and `rail/sandbox-not-bypassed` as confirmed in `docs/adrs/ADR-164-darwin-safety-rails-immutability.md`.

3. **Vertical Pack Architecture**  
   Production-ready pack system with kernel-enforced contracts (`src/packs/`) and marketplace integration. Supports custom JUDGE/DISTILL overrides and pattern corpora seeding per `docs/adrs/ADR-013-vertical-packs-publishing.md`.

4. **Verification-Gated Output**  
   Implemented `verify` skill and hooks that block unverified outputs, detected via repo profiling (`src/verify/`). Confirmed operational in `docs/adrs/ADR-050-harness-intelligence-from-verified-swarm.md`.

### PROPOSED ENHANCEMENTS (ADR STATUS)
1. **Darwin Mode Evolutionary Engine**  
   Proposed in `docs/adrs/ADR-070-darwin-mode-self-improving-harness.md`. Pending keystone sandbox implementation (ADR-101) to activate mutation surfaces.

2. **Typed Handoff Contracts**  
   Designed but not implemented (`docs/adrs/ADR-163-typed-handoffs.md`). Requires schema validation layer and swarm chain instrumentation.

3. **OpenCode Host Integration**  
   Proposed as 8th host in `docs/adrs/ADR-036-host-opencode.md`. Awaiting adapter implementation.

4. **Opportunity Scanner**  
   ROI ranking system proposed in `docs/adrs/ADR-165-darwin-opportunity-scanner.md`. Dependent on Darwin Mode activation.

### CRITICAL GAPS
- **Agent-Executing Sandbox** (ADR-101) is the keystone blocker. Current scoring evaluates variants as inert files (`system-audit.mjs` measurements show degeneracy) per `docs/adrs/ADR-101-darwin-agent-executing-sandbox.md`.
- **Human Review Gates** (ADR-166) lack escalation plumbing in the security spine.

The shipped features are production-hardened (cite `src/mcp/` and `src/policy/rails.ts`), while proposed capabilities are rigorously scoped in ADRs with explicit dependencies. No speculation: the source-controlled implementation and ADR trail define exact boundaries.

## Where the documentation lives


The documentation for agent-harness-generator is organized across several authoritative locations:

1. **Architecture Decision Records (ADRs)**  
   Technical design decisions are recorded in `docs/adrs/` (e.g. `/ADR-050-harness-intelligence-from-verified-swarm.md`). These follow the "Proposed/Implemented" status system and cover cross-cutting concerns like verification gates and memory tiers. The index at `docs/adrs/INDEX.md` provides a complete mapping of ADRs.

2. **User-facing guides**  
   The plain-language `docs/USERGUIDE.md` explains core concepts without jargon. It covers:
   - What a harness is (`"A wrapper that adds project-specific knowledge and safety nets to AI models"`)
   - Step-by-step generation workflows (`"Paste a GitHub URL → Download .zip"`)
   - Host compatibility (`"Works with Claude Code, Codex, pi.dev, etc."`)

3. **Library API documentation**  
   The TypeScript entrypoint `packages/agent-harness-generator-lib/src/index.ts` documents the programmatic API (`scaffold()`, `validateHarnessName()`, `HOSTS` enum). Package metadata (version, dependencies) lives in `packages/agent-harness-generator-lib/package.json`.

4. **System overview**  
   High-level architecture and motivation are in `docs/OVERVIEW.md`, which positions the tool (`"Like create-vite but for agent systems"`) and links to the ADR index.

Missing coverage:  
- There is no dedicated API reference for the Web UI (`apps/web-ui/package.json` only lists dependencies).  
- CLI flag documentation must be inferred from ADRs/metaharness source.

## How to use it end-to-end


1. Open the Studio web interface at `https://ruvnet.github.io/agent-harness-generator/` (source: `docs/USERGUIDE.md`)
2. Click the **Repo → Harness** tab
3. Paste any GitHub URL (e.g. `https://github.com/some/repo`)
4. Click "Analyze" - the UI will fetch the repo structure via GitHub API (source: `apps/web-ui/package.json` shows client-side implementation)
5. Review/modify the auto-generated agent configuration
6. Click **Download .zip** to get a complete package

## 2. Run the generated harness locally
1. Unzip the downloaded package
2. Run these commands in the unzipped directory (source: `docs/USERGUIDE.md` verbatim):
   ```bash
   npm install
   npx my-bot --help
   ```

## 3. Advanced: Generate programmatically via CLI/library
For scriptable generation (exists and is fully implemented per `packages/agent-harness-generator-lib/src/index.ts`):

### Via CLI:
```bash
npx metaharness scaffold --template coding --hosts claude-code,gpt-4
```

### Via JS API:
```javascript
import { scaffold } from '@ruvnet/agent-harness-generator';

await scaffold({
  name: 'my-agent',
  template: 'coding',
  hosts: ['claude-code']
});
```

## 4. Migrate existing ruflo projects (complete path exists)
For ruflo users (source: `docs/adrs/ADR-016-migration-for-ruflo-users.md`):
```bash
cd /path/to/ruflo-project
npx create-agent-harness --from-existing .
```

This preserves all existing:
- `.claude/` directory
- Memory indexes (`data/memory/`)
- Custom skills and plugins
- Verification manifests

Limitations: Currently requires manual review of CI workflows post-migration (explicitly noted in ADR-016 context section).
