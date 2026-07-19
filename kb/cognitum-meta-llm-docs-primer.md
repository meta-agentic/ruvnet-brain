# cognitum-meta-llm-docs — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for

### What it is & who it's for

**cognitum-meta-llm-docs** is the **public, high-level documentation and landing page** for **Cognitum MetaHarness-as-a-Service (MaaS)**, a multi-tenant, tiered, metered, budget-governed platform that provides a dual-protocol (OpenAI + Anthropic) Completions API and autonomous Darwin-Loop agent pods with human approval gates. It is deployed on Google Cloud and serves as a governance, cost, safety, and multi-tenancy layer on top of commodity language models (`README.md`).

The platform is designed for organizations and developers who need **cost-efficient orchestration** of language models, **multi-tenancy support**, and **safety mechanisms** for autonomous agent workflows. It is **not a frontier model** but rather a measured, Pareto cost-corner solution that leverages cheap models for everyday tasks while escalating only the hard tail to more expensive tiers (`index.html`).

#### Key Features:
1. **Tiered Model Routing**: Each request is scored by an intrinsic difficulty signal and routed to low, mid, or high tiers (`capabilities.html`).
2. **Host Runtime Flexibility**: Pods can be driven by different agentic runtimes, ensuring every model call remains tiered, metered, and budget-capped (`capabilities.html`).
3. **Human Approval Gates**: Irreversible or outward-facing actions park at a human approval gate, ensuring safety (`capabilities.html`).
4. **Metering and Budget Governance**: Every token is metered, and every dollar is governed before a model is called (`architecture.html`).

#### Who it’s for:
- **Developers** who need a cost-efficient, governed API for language model completions.
- **Organizations** requiring multi-tenancy and budget control for LLM usage.
- **Teams** building autonomous agent workflows with built-in safety mechanisms.

The documentation site is **static**, containing plain HTML and CSS with **no JavaScript, analytics, trackers, external CDNs, or cookies**. It is intentionally a high-level overview and does not include application code, API keys, or private internals (`SECURITY.md`, `.well-known/security.txt`). For detailed status and roadmap, refer to `status.html`.

For security concerns, vulnerabilities, or over-exposure, contact `security@cognitum.one` as outlined in `.well-known/security.txt` and `SECURITY.md`.

This documentation is for **platform users** and does not cover MetaHarness Studio or AgentBBS, which are separate surfaces built on top of the platform (`README.md`).

## Capabilities (what it can do)

## Capabilities (what it can do)

1. **Multi-protocol API Serving**  
   Provides a unified API endpoint supporting both OpenAI and Anthropic protocols (`/v1/chat/completions`, `/v1/messages`), with real-time translation between them.  
   - Implemented in the live API as confirmed in `status.html`:  
     > "OpenAI chat completions (streaming + JSON) — primary serving path LIVE"  
     > "Anthropic Messages API (streaming + JSON), with real tool-use translation LIVE"  
   - Architecture documented in `architecture.html`:  
     > "client (OpenAI SDK, Anthropic SDK, curl, agentic hosts, …) → api.cognitum.one"

2. **Tiered Model Routing**  
   Dynamically routes requests to low/mid/high model tiers based on intrinsic difficulty scoring (input length, reasoning markers, etc.), with optional escalation.  
   - Core capability described in `capabilities.html`:  
     > "Dial 1 — Tier (the model dial)... That score selects a low/mid/high tier"  
   - Verified live in `status.html`:  
     > "Tier router — intrinsic difficulty (low / mid / high) LIVE"

3. **Budget-Governed Execution**  
   Enforces Reserve-and-Commit spending controls with fail-closed semantics, preventing budget overruns.  
   - Explicitly implemented per `status.html`:  
     > "Reserve-and-Commit budget (sharded, account cap, fail-closed) BUILT"  
   - Pipeline detailed in `architecture.html`:  
     > "4. RESERVE worst-case · fail-closed → 7. COMMIT actual cost"

4. **Darwin-Loop Pods**  
   Runs autonomous agent loops (`pod = {domain × host × tier}`) with human approval gates for irreversible actions.  
   - Confirmed operational in `status.html`:  
     > "Pod spawn + lifecycle LIVE"  
   - Workflow documented in `capabilities.html`:  
     > "approve → commit the held reservation... reject → release the reservation"

5. **Multi-Tenant Security**  
   Provides hashed key authentication, tenant-scoped rate limiting, and idempotency guarantees.  
   - Built per `status.html`:  
     > "Multi-tenant key auth (hashed lookup → scopes) BUILT"  
     > "Scatter-gather rate limiter + tenant-scoped idempotency BUILT"  
   - Enforced via architecture in `architecture.html`:  
     > "1. AUTH key → tenant + scopes"

6. **Transparent Metering**  
   Tracks token usage per request/pod step and reports resolved tier/escalation status.  
   - Live feature per `status.html`:  
     > "Family-correct metering + usage ledger BUILT"  
   - Pipeline stage in `architecture.html`:  
     > "6. METERING token count → usage ledger"

7. **Security Compliance**  
   Maintains RFC 9116 security.txt and SECURITY.md policies with hardened static site delivery.  
   - Explicit in `.well-known/security.txt` and `SECURITY.md`:  
     > "Policy: https://cognitum-one.github.io/meta-llm-docs/SECURITY.md"  
     > "Strict Content-Security-Policy meta tag... no cookies, no client-side fetches"  

*Notably absent*: The platform does **not** provide frontier model capabilities (per `index.html`: "orchestration as a cost lever, not an accuracy lever") or untracked execution (all paths flow through metering/budget layers).

## Core concepts & how they work

## Core concepts & how they work

### 1. Tiered Model Routing (Cost Governance)
**EXISTS** (`capabilities.html`, `architecture.html`)  
Each request is automatically routed to one of three model tiers (low/mid/high) based on an intrinsic difficulty score calculated from input features (length, code/reasoning markers, output-length band, and tool usage). The system supports:
- Dynamic escalation for hard-tail requests
- Caller-enforced quality floors (`min_tier`) and cost caps (`max_tier`)
- Transparent tier reporting in responses (resolved tier, escalation status, and price)

### 2. Darwin-Loop Pods (Autonomous Agents)
**EXISTS** (`capabilities.html`, `architecture.html`)  
Pods are autonomous agent loops defined by the tuple `{domain × host × tier}`. They feature:
- Step lifecycle management (SPAWNED → EXECUTING → EVALUATING → IDLE)
- Budget reservations for each step
- Automatic pause on budget exhaustion
- Host runtime independence (all calls routed through the governance layer)

### 3. Approval Gates (Safety Controls)
**EXISTS** (`capabilities.html`, `status.html`)  
For irreversible/outward-facing actions, pods enter an approval workflow:
1. **Reservation**: Holds worst-case budget allocation
2. **Proposal**: Generates signed action proposal
3. **Resolution**: Human chooses:
   - Approve → Commits reservation at actual cost
   - Reject → Releases reservation (zero spend/effect)
   - Timeout → Auto-rejects (fail-safe)

### 4. Reserve-and-Commit Budgeting
**EXISTS** (`architecture.html`, `status.html`)  
A two-phase financial control system:
1. **Reserve**: Pre-authorizes maximum possible cost (fail-closed)
2. **Commit**: Adjusts to actual usage post-execution
- Multi-tenant aware with account-level caps
- Integrated with metering ledger

### 5. Dual-Protocol API Gateway
**EXISTS** (`status.html`, `architecture.html`)  
Unified endpoint supporting:
- OpenAI Chat Completions API (streaming + JSON)
- Anthropic Messages API (with real-time protocol translation)
- Common metering and governance layer regardless of protocol

### 6. Host Runtime Independence
**EXISTS** (`capabilities.html`, `status.html`)  
Agent pods can be driven by different runtimes ("hosts") while maintaining:
- Consistent tiered routing
- Metering and budget enforcement
- Failure isolation (unavailable hosts pause pods with audit trails)

### Security & Compliance
**EXISTS** (`.well-known/security.txt`, `SECURITY.md`)  
- RFC 9116-compliant security contact
- Static documentation with zero executable code
- Hardened CSP headers and HTTPS enforcement
- No secret exposure in public materials

*Note: Implementation details of the scoring algorithms, host runtimes, and internal service composition are intentionally omitted from public documentation as per `SECURITY.md`.*

## Maturity (shipped vs proposed)

Here's the definitive "Maturity (shipped vs proposed)" section based strictly on the sources:

---

### Maturity (shipped vs proposed)

Cognitum MaaS maintains a rigorously honest status ledger (`status.html`) that distinguishes between **live**, **built**, **designed**, and **blocked** features. The platform is production-ready with core capabilities shipped, while some ancillary features remain in development.

#### **Shipped (LIVE)**
1. **Completions API Core**
   - OpenAI chat completions (streaming + JSON) - primary serving path (`status.html`)
   - Anthropic Messages API (streaming + JSON) with tool-use translation (`status.html`)
   - Model listing (cognitum-* aliases, no raw vendor IDs) (`status.html`)
   - Liveness endpoint (`/healthz`) (`architecture.html`)

2. **Orchestration**
   - Tier router (low/mid/high dynamic routing) (`status.html`, `capabilities.html`)
   - Darwin-Loop pod spawn + lifecycle management (`status.html`)
   - Runaway-cap pause (budget enforcement) (`status.html`)

3. **Governance**
   - Reserve-and-Commit budget system (sharded, fail-closed) (`status.html`, `architecture.html`)
   - Scatter-gather rate limiter + tenant-scoped idempotency (`status.html`)

#### **Built + Tested (BUILT)**
- Legacy OpenAI completions API shape (`status.html`)
- Multi-tenant key auth (hashed lookup → scopes) (`status.html`)
- Post-generation escalation (non-streaming) (`status.html`)
- Family-correct metering + usage ledger (`status.html`)
- Read-only pod poll (multi-tenant projection) (`status.html`)

#### **Designed (DESIGN)**
- Host axis runtime integration (mentioned but implementation incomplete per truncated `status.html` line: _"Host axis — native in-proce"_)

#### **Security**
- Production-grade security practices are LIVE:
  - RFC 9116 security.txt contact protocol (`.well-known/security.txt`)
  - Static site with no JS/CDNs/tracking (SECURITY.md)
  - Automated security scans (`.github/workflows/security.yml`)

#### **Not Yet Implemented**
- No evidence exists in sources for:
  - Custom model fine-tuning endpoints
  - Third-party model integrations beyond OpenAI/Anthropic
  - Detailed pod benchmarking UI

The platform's core thesis — tiered routing of commodity models with governance — is fully operational per the architecture diagram (`architecture.html`) and status ledger. Proposed features are explicitly marked as DESIGN or BUILT in `status.html` with no ambiguity.

## Where the documentation lives

Here's the authoritative "Where the documentation lives" section, based strictly on the provided sources:

---

### Where the documentation lives

The documentation for cognitum-meta-llm-docs is organized as a static site with four core pages and supporting security artifacts. All paths are relative to the repository root.

#### Core documentation pages (HTML):
1. **Landing page** (`index.html`)  
   Exists as the entry point, framing the platform's purpose and value proposition.  
   *Implements:* Overview of governance, cost, and safety features.

2. **Capabilities** (`capabilities.html`)  
   Exists as a conceptual guide to platform features.  
   *Implements:* Detailed breakdown of tier/host/approval dials and Darwin-Loop pods.

3. **Architecture** (`architecture.html`)  
   Exists as the technical overview.  
   *Implements:* Request lifecycle diagrams and substrate composition.

4. **Status ledger** (`status.html`)  
   Exists as the ground-truth implementation tracker.  
   *Implements:* LIVE/BUILT/DESIGN/OPEN status indicators for all capabilities.

#### Supporting artifacts:
- **Security policy** (`SECURITY.md`)  
  Exists as the canonical security declaration, explicitly scoping the static nature of the docs.

- **RFC 9116 contact** (`.well-known/security.txt`)  
  Exists as the machine-readable security contact point, linking to `SECURITY.md`.

#### Absences:
- No API reference documentation exists in this repository (per `SECURITY.md`'s "private and auth-gated" clause).
- No build system or dynamic content exists (confirmed by `README.md` and `.github/workflows/security.yml` only scanning static files).

All paths are publicly accessible at `https://cognitum-one.github.io/meta-llm-docs/` with no authentication required. The architecture is intentionally minimal: plain HTML with a single self-hosted stylesheet, zero JavaScript, and no external dependencies (enforced via `Content-Security-Policy` as stated in `SECURITY.md`).

## How to use it end-to-end

## How to use it end-to-end

### 1. Access the documentation
The entire documentation is available as a static site at **https://cognitum-one.github.io/meta-llm-docs/** (`index.html`). No installation is required - simply navigate to the URL in any modern browser. The site is intentionally built without JavaScript or external dependencies (`README.md`: "Plain HTML + a single self-hosted stylesheet").

### 2. Understand core capabilities
Review the three fundamental dials of the platform (`capabilities.html`):
1. **Tier routing**: Automatic model selection (low/mid/high) based on intrinsic difficulty signals
2. **Host runtime**: Agentic runtime management with enforced governance
3. **Approval gates**: Safety controls for irreversible actions

### 3. Check current status
Consult `status.html` for the honest ledger of what's:
- **LIVE** (proven in production)
- **BUILT** (implemented but not deployed)
- **DESIGN** (planned features)
- **OPEN** (blocked dependencies)

Key live capabilities include:
- OpenAI/Anthropic API compatibility (`status.html`: "OpenAI chat completions (streaming + JSON) — primary serving path LIVE")
- Darwin-Loop pod lifecycle management (`status.html`: "Pod spawn + lifecycle (pod = {domain × host × tier}) LIVE")

### 4. Review architecture
The `architecture.html` page provides the end-to-end flow:
1. Authentication and request routing
2. Tier selection and budget reservation
3. Model execution with metering
4. Approval gate workflow for pods

### 5. Security and reporting
For security concerns:
- Review the policy at `SECURITY.md`
- Contact security@cognitum.one (`.well-known/security.txt`)
- Note that the docs contain no secrets or private API details (`SECURITY.md`: "No API keys, tokens, HMAC/signing secrets")

### What's NOT covered here
The documentation explicitly states these are **not** included (`README.md`):
- Private API implementation details
- MetaHarness Studio/AgentBBS documentation (separate systems)
- Model training internals

For actual API usage, you'll need authenticated access to the private endpoints mentioned in `architecture.html` (api.cognitum.one). The public docs serve only as a conceptual overview.
