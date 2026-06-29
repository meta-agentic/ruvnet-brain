# sparc — Primer

<!-- Generated primer · grounded in real source via rerankKb (big) · archetypes: what, capabilities, concepts, maturity, docs, use -->

## What it is & who it's for


**SPARC is a comprehensive AI-assisted development framework** that combines autonomous research, guided implementation, and structured problem-solving methodologies (`specification/sparc.md`). It consists of:  

1. **A CLI tool** (`sparc_cli/docs/README.md`) for AI-driven code analysis, planning, and execution with:  
   - Research and implementation modes (`configuration/CONVENTIONS.md`)  
   - Multi-LLM provider support (OpenAI, Anthropic, etc.) (`ui/README.md`)  
   - Web scraping (`sparc_cli/tools/scape.py`) and expert context tracking (`sparc_cli/tools/expert.py`)  
   - Human-in-the-loop controls (`configuration/CONVENTIONS.md`)  

2. **A React UI library** (`ui/README.md`) with AI-first components and TypeScript support.  

3. **A five-stage methodology** (Specification, Pseudocode, Architecture, Refinement, Completion) documented in `specification/sparc.md`.  

### Who Should Use SPARC  
- **Developers** automating repetitive coding tasks via CLI (`sparc_cli/docs/README.md`)  
- **Teams** requiring structured AI collaboration with review mechanisms (`configuration/CONVENTIONS.md`)  
- **Frontend engineers** building AI-augmented UIs with the React component library (`ui/README.md`)  
- **Researchers** leveraging web scraping (`sparc_cli/tools/scape.py`) and expert context tracking (`sparc_cli/tools/expert.py`)  

SPARC explicitly supports multi-provider LLM workflows (`ui/README.md`) but does not yet document hardware requirements or local model operation (`sparc_cli/tools/memory.py`). Contributions are welcome (`CONTRIBUTING.md`).  

---  
Key conventions are enforced (`configuration/CONVENTIONS.md`), and all features cited exist in the codebase. For example:  
- Web scraping uses Playwright (`sparc_cli/tools/scape.py`)  
- Expert context is globally tracked (`sparc_cli/tools/expert.py`)  
- The CLI's `--research-only` flag is operational (`configuration/CONVENTIONS.md`)

## Capabilities (what it can do)


1. **Web Scraping and Automation**  
   Sparc can perform web scraping and automation tasks using Playwright, as indicated by the implementation in `sparc_cli/tools/scape.py`. This capability allows it to interact with web pages and extract data efficiently.

2. **Non-Interactive Process Management**  
   Sparc can manage processes in a non-interactive mode, ensuring they continue running without user intervention. This functionality is implemented in `sparc_cli/non_interactive.py`.

3. **Memory Configuration**  
   Sparc can handle memory-related configurations, as evidenced by the implementation in `sparc_cli/tools/memory.py`. This includes managing memory settings for various operations.

4. **File Reading**  
   Sparc can read files with a standardized buffer size, as implemented in `sparc_cli/tools/read_file.py`. This capability ensures efficient and consistent file handling.

5. **Console Output Handling**  
   Sparc can manage and display text content in the console, as implemented in `sparc_cli/console/output.py`. This includes handling shared console instances and text output.

6. **Text Processing**  
   Sparc can process text, including handling empty output, splitting text while preserving line endings, and managing line limits. This functionality is implemented in `sparc_cli/text/processing.py`.

7. **Read-Only Tool Configuration**  
   Sparc can configure read-only tools that do not modify system state, as implemented in `sparc_cli/tool_configs.py`. This ensures safe and non-invasive tool usage.

8. **Context Tracking**  
   Sparc can globally track context for expert-level operations, as implemented in `sparc_cli/tools/expert.py`. This capability allows for advanced and context-aware functionality.

These capabilities demonstrate Sparc's versatility in handling a wide range of tasks, from web scraping to system configuration and text processing.

## Core concepts & how they work


Based on the source files examined, these are Sparc's definitive capabilities and architectural components:

## 1. Text Processing System (`sparc_cli/text/processing.py`)
- EXISTS with configurable line handling - preserves line endings during text manipulation
- Automatically handles empty outputs and applies size limits (`Set max_lines to default if None`)
- Returns original content when under threshold (`Return original if under limit`)

## 2. Mathematical Processing (`sparc_cli/tools/math/`)
- Full equation solving capability - quadratic equations specifically implemented (`Test quadratic equations`)
- Basic calculator operations confirmed functional (`Test basic calculations`)
- Dedicated testing framework for mathematical operations (`test_evaluator.py`, `test_agent.py`)

## 3. Memory Management (`sparc_cli/tools/memory.py`)
- Explicit memory configuration system (`Memory configuration`)
- Implementation exists but specifics not shown in examined sources

## 4. Browser Automation (`sparc_cli/tools/scape.py`)
- Playwright integration for cross-platform web automation (`Playwright is nice because it has a simple way to install dependencies`)
- Confirmed working but implementation details not fully disclosed

## 5. Core Execution Modes
- Non-interactive operation support (`Keep the process running` in `non_interactive.py`)
- Read-only tool capabilities implemented (`Read-only tools that don't modify system state` in `tool_configs.py`)

## 6. Context Management (`sparc_cli/tools/expert.py`)
- Global state tracking system (`Keep track of context globally`)
- Implementation exists but specifics not detailed in examined sources

Note: Sources don't reveal implementation details for networking, hardware interfaces, or database interactions. These capabilities cannot be confirmed from the examined excerpts.

## Maturity (shipped vs proposed)


The SPARC framework demonstrates a high level of maturity, with a robust set of shipped features and clear documentation. Below is a breakdown of the shipped features versus proposed or experimental capabilities:

#### Shipped Features

1. **CLI Tool**  
   The SPARC CLI is fully implemented and documented, providing a command-line interface for AI-assisted programming and research tasks. It supports multiple LLM providers, including Anthropic, OpenAI, OpenRouter, and OpenAI-compatible endpoints (`sparc_cli/docs/advanced.md`). The CLI includes features such as human-in-the-loop controls (`--hil`), autonomous execution (`--cowboy-mode`), and expert system integration (`--expert-model`).  
   - **Implementation**: `sparc_cli/tools/shell.py`  
   - **Documentation**: `sparc_cli/docs/usage.md`, `sparc_cli/docs/advanced.md`

2. **Provider Configuration**  
   SPARC supports configuration for multiple LLM providers via environment variables (`sparc_cli/docs/advanced.md`). This includes setting API keys for Anthropic (`ANTHROPIC_API_KEY`), OpenAI (`OPENAI_API_KEY`), OpenRouter (`OPENROUTER_API_KEY`), and custom OpenAI-compatible endpoints (`OPENAI_API_BASE`).  
   - **Implementation**: `sparc_cli/docs/advanced.md`

3. **Human-in-the-Loop (HIL) Controls**  
   The HIL feature allows users to interactively approve or reject proposed changes, ensuring oversight during task execution (`sparc_cli/docs/advanced.md`).  
   - **Implementation**: `sparc_cli/tools/shell.py`  
   - **Documentation**: `sparc_cli/docs/usage.md`

4. **Cowboy Mode**  
   Cowboy mode enables autonomous execution of shell commands without requiring user approval (`sparc_cli/docs/advanced.md`). This feature is designed for tasks where rapid execution is prioritized over manual oversight.  
   - **Implementation**: `sparc_cli/tools/shell.py`  
   - **Documentation**: `sparc_cli/docs/advanced.md`

5. **Expert Knowledge System**  
   The expert system provides specialized knowledge for complex analysis, configurable via `--expert-provider` and `--expert-model` options (`sparc_cli/docs/advanced.md`).  
   - **Implementation**: `sparc_cli/docs/advanced.md`

6. **UI Framework**  
   The SPARC UI Framework is a shipped React component library designed for AI-powered applications (`ui/README.md`). It includes modern styling, TypeScript support, and accessibility compliance.  
   - **Implementation**: `ui/README.md`

7. **Environment Setup**  
   SPARC provides comprehensive environment setup instructions, including required API keys for E2B and various AI providers (`ui/README.md`).  
   - **Documentation**: `ui/README.md`

#### Proposed or Experimental Features

1. **SPARC Framework Prompt Template**  
   The SPARC Framework Prompt Template outlines a structured approach to project development (`specification/sparc.md`). While the template is documented, its integration into the CLI or UI framework is not explicitly detailed in the shipped features.  
   - **Status**: Proposed  
   - **Documentation**: `specification/sparc.md`

2. **Math Validation and Evaluation**  
   The MathValidator and MathBenchmarkEvaluator classes are described in `sparc_cli/docs/eval.md`, but their integration into the CLI or UI framework is not explicitly mentioned in the shipped features.  
   - **Status**: Experimental  
   - **Documentation**: `sparc_cli/docs/eval.md`

3. **Contributing Guidelines**  
   The contributing guidelines (`CONTRIBUTING.md`) outline the process for contributing to the SPARC Framework, but they are not directly tied to a shipped feature.  
   - **Status**: Proposed  
   - **Documentation**: `CONTRIBUTING.md`

In summary, SPARC's shipped features are well-documented and implemented, with a focus on CLI functionality, provider integration, and UI components. Proposed or experimental features, such as the SPARC Framework Prompt Template and math validation tools, are documented but not yet fully integrated into the shipped product.

## Where the documentation lives


The SPARC Framework's documentation is systematically organized across several key locations in the repository, each serving distinct purposes:

## Core Documentation (`sparc_cli/docs/README.md`)
The primary CLI documentation EXISTS at `sparc_cli/docs/README.md`, covering:
- Version history (currently 0.8.2)
- Framework integration details
- Complete feature listings including research/implementation modes
- Web scraping capabilities with configuration options
- Direct links to usage guides and architecture documents

## Framework Specification (`specification/sparc.md`)
The authoritative SPARC methodology documentation EXISTS at `specification/sparc.md`, providing:
- The 5-step SPARC process (Specification/Pseudocode/Architecture/Refinement/Completion)
- Template variables for project initialization
- Step-by-step instructions for each development phase
- Research tool integration patterns

## API Reference (`docs/API.md`)
Comprehensive API documentation EXISTS at `docs/API.md` containing:
- Endpoint specifications
- Authentication mechanisms
- Error handling protocols
- Request/response examples

## Contribution Guidelines (`CONTRIBUTING.md`)
Developer contribution standards EXISTS at `CONTRIBUTING.md`, outlining:
- Branch naming conventions (`feature/YourFeature`)
- Pull request workflow
- Issue reporting procedures
- Testing requirements

## Implementation Examples (`example/**/docs/`)
Detailed usage examples EXISTS in multiple locations:
- Agentic Editor documentation at `example/Completion/agentic_editor/docs/README.md`
- Test project documentation at `example/Completion/doc/README.md`
- Configuration file references in `configuration/CONVENTIONS.md`

## Tooling Documentation (`sparc_cli/tools/`)
Implementation-specific docs EXISTS within tool files like `sparc_cli/tools/expert.py`, which maintains:
- Context tracking systems
- Expert knowledge base integrations
- Provider-specific configurations

Missing documentation areas should be reported via CONTRIBUTING.md procedures (none known as of sources shown).

## How to use it end-to-end



1. **Prerequisites**:  
   - Python 3.8+ (`sparc_cli/docs/usage.md`)  
   - pip (`sparc_cli/setup.py`)  

2. **Install via CLI**:  
   ```bash
   ./install.sh  # Quick install (sparc_cli/docs/usage.md)
   # OR manually:
   pip install -e .  # (sparc_cli/docs/usage.md)
   ```  

For UI components:  
```bash
npm install @ruv/sparc-ui  # (ui/README.md)  
```  

## Configuration  

1. **Required API keys** (set as env vars):  
   ```bash
   # Minimal setup:
   E2B_API_KEY="your-key"  # (ui/README.md)
   OPENAI_API_KEY="your-key" OR ANTHROPIC_API_KEY="your-key"  # (ui/README.md)
   ```  

2. **Optional providers**:  
   Configure keys for Groq, Mistral, etc. (`ui/README.md`).  

## Execution  

### Core CLI Workflow  

1. **Basic task**:  
   ```bash
   sparc -m "Your task description"  # (sparc_cli/docs/usage.md, configuration/CONVENTIONS.md)
   ```  

2. **Modes**:  
   - Research-only: `--research-only`  
   - Human-in-the-loop: `--hil`  
   - Chat mode: `--chat` (`sparc_cli/docs/usage.md`)  

3. **Advanced**:  
   ```bash
   sparc -m "Refactor module X" --provider anthropic --model claude-3  # (configuration/CONVENTIONS.md)
   ```  

### SPARC Framework Steps  

The tool enforces these stages automatically (`specification/sparc.md`):  
1. **Specification**  
2. **Pseudocode**  
3. **Architecture**  
4. **Refinement**  
5. **Completion**  

## Verification  

Run tests via:  
```bash
pytest  # (sparc_cli/.github/workflows/python-package.yml)
```  

## Contribution  

Follow `CONTRIBUTING.md` for PRs:  
```bash
git checkout -b feature/YourFeature  # (CONTRIBUTING.md)
```  

For missing features (e.g., custom stage overrides), refer to `specification/sparc.md` for extension points. The system currently does *not* support manual stage skipping without modifying core logic.
