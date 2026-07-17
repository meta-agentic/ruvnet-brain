# Security Policy

RuvNet Brain runs on your machine, downloads a knowledge bundle, and (with your consent) can update
itself — so we take reports seriously and fix them in the open. This policy exists because the project's
first security review was a private, responsible disclosure; the next reporter should have a clear path.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Instead:

- Use GitHub's **[private vulnerability reporting](https://github.com/stuinfla/ruvnet-brain/security/advisories/new)**
  (Security tab → "Report a vulnerability"), or
- Email the maintainer at the address on the [GitHub profile](https://github.com/stuinfla).

Include: what you found, a `file:line` or reproduction, the impact, and (if you have one) a suggested fix.
"Confirmed" reports — where you ran the exact command or read the exact line — are the most actionable.

## What to expect

- We verify every report against the real code before acting (we do not dismiss, and we do not
  rubber-stamp). Fixes are proven with a real command before they're called done.
- Each finding is tracked with a `file:line` root cause, the exact fix, and its verification — see
  [`docs/adr/0010-security-hardening-sec-0010.md`](docs/adr/0010-security-hardening-sec-0010.md) for the
  format (that ADR is the record of the first review).
- We credit reporters unless you ask us not to.

## What runs automatically, and when

Installing the plugin installs everything under `plugin/` (that's the marketplace source —
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) points at `./plugin`), but only the
hooks actually registered in [`plugin/hooks/hooks.json`](plugin/hooks/hooks.json) run automatically. Here
is every one of them, what it does, and whether it can block you:

| Event | Script | What it does | Can it block a turn? |
|---|---|---|---|
| `SessionStart` | `session-start.sh` | Prints the "brain active" confirmation, checks a handful of local state files (nightly-failure marker, brain-health flags), and — rate-limited to once per ~15 min — does a single read-only `curl` to check whether a newer plugin version exists. First-run-only, it asks two one-time yes/no questions (auto-update? anonymous usage counts?) and records your answer to a local file. | No — always exits 0. |
| `UserPromptSubmit` | `ground-ruvnet.sh` | Reads your prompt text and, if it matches certain keyword patterns, injects grounding/context text before Claude answers (e.g. call `search_ruvnet` before asserting a stack capability). Also runs a rate-limited (~6 h) background version check against the public npm registry for a few packages. | No — always exits 0. |
| `PreToolUse` (`Write`\|`Edit`\|`Bash`) | `hijack-ruvnet.sh` | Scans the content of a proposed Write/Edit/Bash for third-party defaults it thinks the rUv stack already has a native replacement for, and injects a suggestion via `additionalContext`. | No — `permissionDecision: "defer"`, never denies. |
| `PreToolUse` (`Task`) | `route-dispatch.sh` | If — and only if — you've opted into model-cost routing (`~/.claude/model-router/profile.json` exists), blocks a subagent dispatch that doesn't declare an explicit `model`, so it can't silently inherit the calling session's (possibly expensive) model. | **Yes, but opt-in only.** No profile file → this hook is a no-op for you. |
| `PreToolUse` (`Bash`) | `verify-interface.sh` | Same opt-in gate as above. When it fires, it blocks invoking a handful of named ecosystem CLIs (`ruflo`, `claude-flow`, `agentic-flow`, `agentic-qe`, `ruvector`, `agent-browser`, `ruv-swarm`) on a subcommand whose `--help` hasn't been read in the last 24h — a guardrail against guessing CLI flags. | **Yes, but opt-in only** (same profile gate). |
| `PreToolUse` (`Bash`) | `design-wall.sh` | **Not opt-in-gated.** Blocks `git commit` when the staged files include anything under `explainer/`, `console/`, or a file named `README.md` (plain substring match against `git diff --cached --name-only` — this can match paths in *any* project, not just this repo), blocks `vercel ... --prod`, and blocks `open`-ing a small hardcoded list of this project's own URLs — unless a fresh (≤45 min) passing design-grade stamp exists for that surface. Escape hatch: `RUVNET_SKIP_DESIGN_WALL=1`. | **Yes, unconditionally** for the specific patterns above — this is the one hook here that isn't behind an opt-in profile check. |
| `PostToolUse` (`Write`\|`Edit`\|`MultiEdit`\|`Bash`) | `learn-capture.sh` | Appends one line per tool call to a local per-session queue: the tool name plus either a Bash command's first ~120 chars *up to its first embedded quote* (workflow verbs like `git push`, not full arguments) or an edited file's basename (never its path or contents). | No — always exits 0. |
| `SessionEnd` | `learn-flush.mjs` | Reads that session's queue, dedupes to at most 8 distinct actions, and feeds them into the ruflo/AgentDB self-learning store **at `$HOME`** (i.e. your global, cross-project learner, not this project's `.swarm/memory.db`) via `ruflo hooks post-command`/`post-edit`. Deletes the queue file when done. | No — best-effort, every failure swallowed. |

`plugin/scripts/` also ships four more scripts — `ground-before-write.sh`, `grounding-stamp.sh`,
`kling-preflight.sh`, `version-bump-gate.sh` — that are **not** referenced in `hooks.json`. They ship as
inert files with every install; they only ever run if something *else* explicitly wires them into a
`settings.json` (this repo's own [`.claude/settings.json`](.claude/settings.json) wires
`version-bump-gate.sh` for this repo's own maintainers — that is a project-scoped dev convenience, not
part of what an installed plugin does for you).

## What leaves your machine — and what never does

Everything below is a plain, unauthenticated `GET`/`POST` to a public endpoint — none of it carries an
API key, a machine identifier, your prompts, your code, or file contents. Grep the cited file yourself;
that's the point of this section.

**Version / update checks (read-only, no payload beyond the HTTP request itself):**
- `plugin/scripts/session-start.sh` — `curl` to `raw.githubusercontent.com/.../plugin.json`, rate-limited
  to once per ~15 min, 3 s timeout, to detect a newer plugin version.
- `plugin/scripts/ground-ruvnet.sh` — `curl` to `registry.npmjs.org/<pkg>/latest` for a handful of stack
  packages, rate-limited to once per ~6 h, backgrounded so it can never block a prompt.
- `bin/install.mjs` — `api.github.com/repos/.../releases/latest` (find the current release) and the
  matching `github.com/.../releases/download/...` asset URL (download the ~500 MB knowledge bundle zip).
- `scripts/onboarding-console.mjs` (`gatherTrust`, serving the local Console's Trust card) —
  `api.github.com/repos/.../releases/latest` plus the published `.sha256` asset, to show you the release
  bundle's fingerprint. The Console server itself binds `127.0.0.1` only and rejects any request whose
  `Host` header isn't loopback (DNS-rebinding guard) — nothing it serves is reachable off your machine.

**Optional, consent-gated usage counts (`kb/telemetry-ping.mjs`, `bin/install.mjs`):**
- Nothing is ever sent unless `~/.cache/ruvnet-brain/.telemetry-consent` contains the literal word `yes`
  — written only after the installer explicitly asks you ("Share anonymous usage counts... [Y/n]"), and
  never written at all on a non-interactive install (so a scripted/CI install stays silent by default).
  Decline up front with `--no-telemetry`, or flip the file back to `no` / delete it at any time.
- The entire payload, always: `{ event: "install", v: <version> }` once at install time, and at most one
  daily-batched `{ event: "search"|"session", v: <version>, n: <count> }` per event type — a name, the
  installed bundle's version string, and an integer count. No query text, no repo names, no file paths,
  no code, no username, no machine ID is ever read by this code path, let alone transmitted — see the
  contract comment at the top of `kb/telemetry-ping.mjs`.
- Hard kill-switches: `RUVNET_BRAIN_TELEMETRY=0` or `RUVNET_BRAIN_TEST=1` disable the module outright.

**Model weights (first run only, then fully local)** — see **Model & data provenance** below; the short
version is: a specific pinned HuggingFace revision, only when not already cached, never on repeat runs.

**What never leaves your machine, full stop:** your prompts, your source code, the text of your
`search_ruvnet` queries, anything AgentDB/ruflo memory stores (`.swarm/memory.db` is local SQLite), the
RVF vector stores themselves, and the contents of any file the hooks touch (they log *that* a Write/Edit
happened and a basename — never the diff or the file body).

## Consent gates

Every point where RuvNet Brain can do something beyond "answer inside this session" is opt-in and
recorded as a plain file you can read or flip yourself:

- **Anonymous usage counts** — asked once, at install; default is OFF on a non-interactive install;
  `~/.cache/ruvnet-brain/.telemetry-consent`.
- **Background plugin auto-update** — asked once, at first `SessionStart`; even when enabled, a new
  version only *downloads* automatically — loading it still requires you to restart/`--continue` your
  session (Claude Code only loads plugins at process start, a hard platform constraint, not a choice this
  project makes); `~/.cache/ruvnet-brain/.auto-update-pref`.
- **Knowledge-bundle updates** — detect-and-notify only; `forge-update.mjs --apply` is never run
  automatically, by design, because it overwrites executable `.mjs` tool files from a GitHub Release (see
  the signing posture below) — you run `--apply` yourself after reviewing.
- **Model-router cost routing / the interface-check and dispatch-model walls** — nothing in
  `route-dispatch.sh` or `verify-interface.sh` does anything until you've answered the router's setup
  questions and `~/.claude/model-router/profile.json` exists.
- **Console Apply flow** — every mutating action is a POST that must echo a random, per-launch token
  (never persisted to disk), and the undo is journalled *before* the mutation runs so any applied change
  is reversible; see `scripts/onboarding-console.mjs`'s header comment for the full contract.

## Known, tracked security posture (honest disclosure)

- **The knowledge bundle is Ed25519-signed with transitional enforcement.** `scripts/sign-bundle.mjs`
  emits a detached `<zip>.sig` (over the bundle's SHA-256) plus `<zip>.sha256`, and the installer
  verifies it **before extracting**, against an Ed25519 public key **embedded in `bin/install.mjs`** so
  the trust root travels with the installer code (an attacker who swaps the bundle can't also swap the
  key). A signature that is **present but invalid always fails closed** — the download is deleted and
  extraction refused. A **missing** signature currently **warns and proceeds** (`SIGNING_REQUIRED = false`)
  so releases predating signing still install; this flips to hard-required once every release is signed.
  The *unattended* code-overwrite path remains disabled (updates detect-and-notify, they do not
  auto-apply executable files).
- **Model weights** download from HuggingFace on first run only when not already cached, and are now
  **pinned to exact commit SHAs** (no longer the floating `main` branch) so the weights — and therefore
  every embedding — cannot silently change under an upstream re-publish. See **Model & data provenance**
  below.
- The grounding **hooks are POSIX shell** — on native Windows without WSL/Git-Bash they don't fire (the
  `search_ruvnet` tool still works).

## Model & data provenance

The brain's answers are only as trustworthy as the weights that produce its embeddings, so those are
pinned and loaded locally:

- **Embedding models (pinned by exact HuggingFace commit SHA, quantized ONNX):**
  - `Xenova/all-MiniLM-L6-v2` — 384-dim, the default query embedder and the *small* build
    (`kb/forge-ask.mjs`, `kb/forge-build.mjs`) — pinned at `751bff37182d3f1213fa05d7196b954e230abad9`.
  - `Xenova/bge-base-en-v1.5` — 768-dim, the sharper *big* build (`kb/forge-big.mjs`, and the query
    side of `kb/forge-ask.mjs` when a big bundle is present) — pinned at
    `4d6cd88e18e51a5e020c2c305726d76ada9c03cf`.
  - `Xenova/ms-marco-MiniLM-L-6-v2` — cross-encoder reranker (`kb/forge-rerank.mjs`) — pinned at
    `a09144355adeed5f58c8ed011d209bf8ee5a1fec` when the default model is used (an operator `CE_MODEL`
    override falls back to `main`).
- **Weights load from a local ONNX cache**, not the network by default. The loader
  (`@xenova/transformers` v2.17.2) points at a local model cache (`KB_MODEL_CACHE`, else a `kb/`-local
  `models-cache`) and permits a remote HuggingFace fetch **only** when that specific model is not already
  cached. Once cached it is fully offline. The cache lookup is revision-agnostic, so pinning a SHA never
  forces a re-download of an already-present model — it only makes the first fetch on a fresh machine
  deterministic.
- **Pin vs. package version are independent.** The pinned SHA fixes the *weights*; the
  `@xenova/transformers` npm version (bumped via Dependabot) fixes the *loader code*. A loader upgrade
  never changes the pinned weights — review such updates for API compatibility with the pinned revisions.
- **Bundle integrity** is covered by the Ed25519 signing posture described above (signed `.sig` +
  `.sha256`, public key embedded in the installer, verify-before-extract, invalid-signature fail-closed).

## What v3.3 adds

- **A CycloneDX SBOM for the shipped surfaces.** `npm run sbom` runs the standard
  [`@cyclonedx/cyclonedx-npm`](https://github.com/CycloneDX/cyclonedx-node-npm) tool (`--omit dev`, so
  test/build-only tooling like `vitest` is excluded) and writes
  [`sbom/ruvnet-brain.cdx.json`](sbom/ruvnet-brain.cdx.json) — a CycloneDX 1.6 document listing every
  production package the installer and plugin actually ship (currently `@metaharness/router` and its one
  transitive dependency, `@metaharness/flywheel`; the installer and the plugin's MCP launcher themselves
  import only Node's standard library — zero third-party runtime dependencies of their own). The
  Onboarding Console's Trust card reads this file locally and, once you've generated it, shows the real
  component count and generation date in place of the "coming v3.3" placeholder — the wiring is already
  live in `scripts/onboarding-console.mjs` (`gatherTrust`) and `console/app.js` (`renderTrust`) as of this
  change. A signed, published SBOM attached to each GitHub Release (matching the existing `.sha256`/`.sig`
  pattern) is the remaining step to make this row "coming v3.3" a full "measured from the published asset"
  the way the bundle signature row already is.
- **An npm provenance plan** (not yet executed — no publish has happened as part of this work) for the
  `ruvnet-brain` npm package, using `npm publish --provenance` over GitHub Actions OIDC (the "trusted
  publisher" flow) rather than a long-lived npm token. See
  [`docs/research/npm-provenance-plan.md`](docs/research/npm-provenance-plan.md) for the exact
  requirements and steps.

## Supported versions

Active development is on `main`; fixes land there first and flow to users via the plugin's update path.
The exact current version is on the badge at the top of the [README](README.md).
