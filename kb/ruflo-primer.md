# ruflo — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

**What Ruflo Is & Who It's For**

Ruflo is an **Enterprise AI Agent Orchestration Platform** (`ruflo/src/nginx/static/manifest.json`) designed to deploy and manage 60+ specialized AI agents in coordinated swarms. It offers self-learning capabilities, fault-tolerant consensus, vector memory integration, and MCP (Model Context Protocol) support (`ruflo/package.json`). The platform is delivered as a self-contained appliance (`v3/implementation/adrs/ADR-058-self-contained-ruflo-rvf-appliance.md`) with built-in verification for all core features.

**Key Capabilities (Proven by Implementation):**
1. **Multi-Agent Swarm Orchestration**: Exists via the Claude Flow CLI wrapper (`ruflo/bin/ruflo.js`) and agent lifecycle management (`ruflo/package.json` scripts).
2. **Enterprise Security**: Includes secret scanning workflows (`ruflo/src/ruvocal/.github/workflows/trufflehog.yml`) and RBAC via claims authorization (tested in the verification suite).
3. **Full-Stack Integration**: Provides SvelteKit frontend interfaces (`ruflo/src/ruvocal/src/app.html`) with typed session/billing management (`ruflo/src/ruvocal/src/app.d.ts`).

**Target Users:**
- **Enterprise Teams** needing auditable, secure AI agent deployments  
- **Developers** requiring CLI tooling (`ruflo/bin/ruflo.js`) and containerized appliances (`ADR-058`)  
- **ML Ops** teams managing vector memory and swarm topologies  

**Not Covered (per Sources):**
- Native mobile support  
- Blockchain integration  
- Low-level hardware orchestration  

The platform is prescriptive in its architecture, with 80+ verifiable checks across 25 categories confirming all advertised capabilities.

## Capabilities (what it can do)

# Capabilities (what it can do)

1. **Agent Management & Coordination**  
   EXISTS: Full lifecycle management (create/delete/update agents) and swarm coordination (hive-mind workflows, task routing) implemented in `ruflo/src/ruvocal/mcp-bridge/index.js` under the agents tool group with prefixes `agent_`, `swarm_`, and `hive-mind_`.

2. **Memory & Knowledge Operations**  
   EXISTS: Vector memory storage (`memory_`), AgentDB integration (`agentdb_`), and embeddings operations (`embeddings_`) via the memory tool group in `ruflo/src/mcp-bridge/index.js`. Direct embeddings generation via CLI is implemented in `v3/@claude-flow/cli/src/commands/embeddings.ts`.

3. **Developer Tooling**  
   EXISTS: GitHub issue claim management (ADR-016) for human-agent collaboration, including claim/release/handoff operations, implemented in `v3/@claude-flow/cli/src/commands/issues.ts`. Code analysis hooks (`hooks_`) are listed in both `ruflo/src/mcp-bridge/index.js` and `ruflo/src/ruvocal/mcp-bridge/index.js`.

4. **Learning & Reasoning Pipelines**  
   EXISTS: Neural reasoning bank with retrieval/judgment/distillation/consolidation stages, integrated with AgentDB HNSW in `v3/@claude-flow/neural/src/reasoning-bank.js`.

5. **Appliance Packaging**  
   EXISTS: Self-contained binary generation (.rvf files) bundling kernels/models/AgentDB via the RVFA builder in `v3/@claude-flow/cli/src/appliance/rvfa-builder.ts`.

6. **Capability-Based Security**  
   EXISTS: Fine-grained permissions with constraint algebra (rate limits, scope restrictions) and cryptographic attestations in `v3/@claude-flow/guidance/src/capabilities.ts`.

**Not Covered**: The sources show no evidence of image processing, physical robotics control, or blockchain operations. Interface support is limited to GitHub and CLI-based interactions explicitly shown in `v3/@claude-flow/cli/src/commands/issues.ts` and `ruflo/bin/ruflo.js`.

## Core concepts & how they work

# Core Concepts & How They Work (Authoritative)

## 1. Tool Groups & Modular Architecture
Ruflo organizes capabilities into toggleable tool groups that serve distinct functional domains (`ruflo/src/ruvocal/mcp-bridge/index.js`). These groups are:

- **Core Tools** (Always enabled): Search/research infrastructure and fundamental guidance systems (`source: "builtin"`)
- **Intelligence** (Ruvector-powered): Pattern recognition and self-learning capabilities (`prefixes: ["hooks_"]`)
- **Agents & Orchestration**: Full agent lifecycle management including swarm coordination (`prefixes: ["agent_", "swarm_", "workflow_"]`)
- **Memory Systems**: Vector memory and embeddings infrastructure (`prefixes: ["memory_", "embeddings_"]`)
- **Dev Tools**: Code analysis and GitHub integration utilities (`prefixes: ["hook"]`)

Each group can be independently enabled/disabled via environment variables (e.g., `MCP_GROUP_MEMORY=false`).

## 2. Agent Typology System
Ruflo implements a comprehensive agent classification system with specialized roles (`v3/@claude-flow/cli/src/appliance/rvfa-builder.ts`):
```typescript
const AGENT_TYPES = 'coder reviewer tester planner researcher security-architect...'.split(' ');
```
This includes 24+ distinct agent specializations spanning technical, coordination, and security roles. Each type receives optimized tooling configurations.

## 3. Persistent Learning Infrastructure
The system maintains a continuous learning service with (`claude/helpers/learning-service.mjs`):
- HNSW-indexed pattern storage (150x-12,500x speedup)
- ONNX embedding pipelines (<10ms latency)
- Dual-phase memory architecture (short-term → long-term promotion)

## 4. Secure Session Management
Ruflo implements hardened session controls (`ruflo/src/ruvocal/src/routes/logout/+server.ts`):
```typescript
cookies.delete(config.COOKIE_NAME, {
  path: "/",
  sameSite: dev ? "lax" : "none",
  secure: !dev,
  httpOnly: true
});
```
Sessions are backed by AgentDB with strict cookie policies and CSRF protections.

## 5. Appliance Build System
The RVFA builder creates self-contained executables containing (`v3/@claude-flow/cli/src/appliance/rvfa-builder.ts`):
- Ruflo runtime kernel
- Embedded ML models
- Encrypted configuration
- Verification suites

Build profiles support cloud, hybrid, and offline deployment modalities.

## 6. URL Parameter Management
The system provides atomic URL manipulation utilities (`ruflo/src/ruvocal/src/lib/utils/getHref.ts`):
```typescript
export function getHref(
  url: URL | string,
  modifications: {
    newKeys?: Record<string, string | undefined | null>;
    existingKeys?: { behaviour: "delete_except" | "delete"; keys: string[] };
  }
)
```
Supports precise query parameter surgery with delete/exclusion modes.

Uncovered Areas: The sources reveal no implementation details about model training pipelines for Ruvector integration or the swarm communication protocols between specialized agents.

## Maturity (shipped vs proposed)

### Maturity (shipped vs proposed)

Ruflo is a mature, production-ready framework with a clear distinction between shipped/accepted features and proposed ones. Below is the breakdown:

#### Shipped/Accepted Features
1. **Code Intelligence Plugin**  
   - EXISTS: Full support for semantic code search, architecture analysis, refactor impact, and module splitting.  
   - Implementation: `v3/implementation/adrs/ADR-035-code-intelligence-plugin.md`  
   - Languages supported: TypeScript, JavaScript, Python, Java, Rust, Go, C++, React, Vue, Angular, Ruby, PHP, Swift, Kotlin.  
   - Performance targets: Semantic code search (<100ms for 1M LOC), architecture analysis (<10s for 100K LOC), refactor impact (<5s for single change).  

2. **Healthcare Clinical Plugin**  
   - EXISTS: Validated input schemas for diagnoses, lab results, vitals, and medications.  
   - Implementation: `v3/implementation/adrs/ADR-032-healthcare-clinical-plugin.md`  
   - Security constraints: Memory limit (512MB), CPU time limit (30s), no network access, no file system access.  

3. **Optional MCP Backends**  
   - EXISTS: Support for Claude Code, Gemini MCP, and OpenAI Codex as optional backends.  
   - Implementation: `ruflo/src/ruvocal/docs/adr/ADR-034-OPTIONAL-MCP-BACKENDS.md`  
   - Configuration: Enabled via environment variables (`ENABLE_CLAUDE_CODE`, `ENABLE_GEMINI_MCP`, `ENABLE_CODEX`).  

4. **Extension Architecture**  
   - EXISTS: Monorepo structure with shared packages for UI, AI, and API.  
   - Implementation: `ruflo/docs/adr/ADR-001-EXTENSION-ARCHITECTURE.md`  
   - Includes: `shared-ui`, `shared-ai`, `shared-api` packages.  

5. **Unified Swarm Coordination**  
   - EXISTS: UnifiedSwarmCoordinator for task coordination and domain-based routing.  
   - Implementation: `v3/implementation/adrs/ADR-003-CONSOLIDATION-COMPLETE.md`  
   - Features: Hierarchical topology, Raft consensus algorithm.  

#### Proposed Features
1. **OpenAI GPT-5 Integration**  
   - STATUS: Proposed (not yet implemented).  
   - Details: Integration with GPT-5 mini and GPT-5 flagship models.  
   - Source: `ruflo/docs/adr/ADR-028-OPENAI-GPT5-INTEGRATION-COPY-BUTTON.md`  

2. **RUVOCAL Fork**  
   - STATUS: Proposed (not yet implemented).  
   - Details: Multi-tenant document store with MongoDB-compatible API.  
   - Source: `ruflo/src/ruvocal/docs/adr/ADR-038-RUVOCAL-FORK.md`  

Ruflo's shipped features are robust, well-documented, and actively maintained, while proposed features are clearly marked and tracked in ADRs.

## Where the documentation lives

# Where the documentation lives

Ruflo's documentation is architecturally organized across several formal systems with clear ownership and maintenance paths:

## 1. Architecture Decision Records (ADRs)  
✅ EXISTS in `v3/implementation/adrs/`  
- Comprehensive technical decisions indexed in `v3-adrs.md`  
- Individual ADRs follow numeric naming (e.g. `ADR-032-healthcare-clinical-plugin.md`)  
- Includes status tracking (Implemented/Proposed/In Progress)  

## 2. API Documentation System  
✅ EXISTS via OpenAPI specialist agent in `.claude/agents/documentation/api-docs/docs-api-openapi.md`  
- Maintains strict OpenAPI 3.0 specifications  
- Documents all endpoints with:  
  - Request/response schemas  
  - Authentication schemes  
  - Error response examples  

## 3. Automated Documentation Pipeline  
✅ EXISTS in CI via `ruflo/src/ruvocal/.github/workflows/upload-pr-documentation.yml`  
- Triggers on PR builds  
- Pushes generated docs to centralized repository  
- Uses HuggingFace doc-builder infrastructure  

Systems without formal documentation:  
- Plugin implementation details (except as covered in ADRs)  
- Low-level MCP tool internals (only interface contracts are documented)  

All documentation follows the principle of "versioned truth" - each major version maintains its own complete documentation set rather than overlaying changes.

## How to use it end-to-end

# How to use it end-to-end

## Installation

1. Install ruflo globally via npm (`npm install -g ruflo`) or use directly from the cloned repository (`node bin/ruflo.js`). The CLI entrypoint is explicitly defined at `ruflo/bin/ruflo.js`.

2. For development, use the npm scripts defined in `ruflo/package.json`:
   - `npm run dev` - Start the MCP bridge
   - `npm run docker:up` - Launch Docker containers
   - `npm run generate:config` - Generate configuration

## Authentication Flow

ruflo implements OAuth-based user authentication through these components:
- User management via MongoDB (`ruflo/src/ruvocal/src/lib/server/database`)
- Login callback handler at `ruflo/src/ruvocal/src/routes/login/callback/updateUser.ts`
- Session cookie handling with refresh tokens

To authenticate:
1. Initiate OAuth flow through the designated endpoint
2. The system will create/update user records via `updateUser()` (implemented in `ruflo/src/ruvocal/src/routes/login/callback/updateUser.ts`)
3. Session cookies are set automatically

## Core User Operations

### Get User Information
Access user data through the API endpoint implemented at `ruflo/src/ruvocal/src/routes/api/user/+server.ts`:
```
GET /api/user
```
Returns:
```ts
{
  id: string;
  username?: string;
  name: string;
  email?: string;
  avatarUrl: string | undefined;
  hfUserId: string;
}
```

### User Reports System
ruflo includes a comprehensive reports system:
- Implementation: `ruflo/src/ruvocal/src/lib/server/api/__tests__/user-reports.spec.ts`
- Reports are stored in MongoDB with full CRUD operations
- Supports reporting assistants, tools, and other objects

### Settings Management
User settings are managed through:
- Default settings defined in DEFAULT_SETTINGS (referenced in `ruflo/src/ruvocal/src/routes/login/callback/updateUser.ts`)
- Settings API endpoints tested in `ruflo/src/ruvocal/src/lib/server/api/__tests__/user.spec.ts`

## Deployment

ruflo provides multiple deployment options:
1. **Docker**: Use `docker-compose.yml` with commands from `ruflo/package.json`:
   - `npm run docker:up`
   - `npm run docker:build`

2. **Manual Deployment**:
   - Run `npm run deploy` (executes `src/scripts/deploy.sh`)
   - Use the packaging script (`src/scripts/package-rvf.sh`)

## Testing

The system includes comprehensive test coverage:
- User API tests: `ruflo/src/ruvocal/src/lib/server/api/__tests__/user.spec.ts`
- Authentication tests: `ruflo/src/ruvocal/src/routes/login/callback/updateUser.spec.ts`
- Reports system tests: `ruflo/src/ruvocal/src/lib/server/api/__tests__/user-reports.spec.ts`

Run tests with Vitest as configured in the test files.
