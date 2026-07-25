# Codex skill manifests

Thin TOML manifests that expose the brain to a Codex host, following rUv's own convention
(`metaharness/.codex/skills/*/skill.toml` — `repo-genome` for the `mcp_tool` variant,
`example-harness` for the `shell` variant).

The MCP server these reference is registered in `~/.codex/config.toml` by `npx ruvnet-brain`.
Before that registration existed (issue #42), a Codex host got nothing at all: every artifact
shipped, only the wiring was missing.

| Skill | Dispatch | Backend |
|---|---|---|
| `search-ruvnet` | `mcp_tool` → `ruvnet-brain` / `search_ruvnet` | the one tool `plugin/mcp/server.mjs` actually serves (verified live via `tools/list`) |
| `savings` | `shell` | `~/.claude/model-router/bin/metaharness-receipts.mjs`, installed by `npx ruvnet-brain` |

## What is deliberately NOT manifested here, and why

`brain-score`, `brain-build` and `brain-prompt` ship as Claude Code skills
(`plugin/skills/*/SKILL.md`) and are **intentionally absent** from this directory.

They are agent *prose contracts* — a scorecard rubric, a phase-gated build contract, a
metaprompting method. They have no MCP tool (the brain's server serves `search_ruvnet` and
nothing else) and no single CLI entrypoint: the scripts they mention are steps *inside* the
contract, not the thing that runs it. Dispatching `brain-build` at `route-cheap.mjs` would
print a routing decision and run no build.

The grounded manifest shape supports exactly two dispatch types, `mcp_tool` and `shell`.
Neither can honestly deliver a prose contract, and a manifest that advertises a dispatch which
cannot fire is worse than an absent one — it is the product lying about its own capability.
So they stay Claude Code skills until there is something real to dispatch to.
