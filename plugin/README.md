# ruvnet-brain — a RuvNet brain transplant for Claude Code

One install gives Claude Code a **source-grounded brain over the RuvNet / rUv ecosystem** (19+ repos:
Ruflo, RuVector, AgentDB, RuLake, RuView, agentic-flow, sparc, QuDAG, ruv-FANN, SAFLA, FACT, dspy.ts,
SynthLang, daa, agent-harness-generator, agenticow, CVE-bench, helix, rupixel, …) **plus enforced
grounding** so the model stops arguing about RuvNet and actually uses it.

## Install (one line)

```bash
claude plugin marketplace add stuinfla/ruvnet-brain && claude plugin install ruvnet-brain@ruvnet-brain --scope user
```

Installed at **user scope**, so it's active in every project.

## What you get

| Piece | File | Effect |
|---|---|---|
| **Knowledge** | `.mcp.json` → `ruvnet-brain` MCP | the `search_ruvnet` tool: cross-repo, cross-encoder-ranked, source-grounded retrieval over the whole rUv ecosystem |
| **Behavior** | `skills/ruvnet-brain/SKILL.md` | tells Claude to ground RuvNet claims and prefer RuvNet building blocks over pgvector/Pinecone/etc. |
| **Enforcement** | `hooks/hooks.json` + `scripts/ground-ruvnet.sh` | a `UserPromptSubmit` hook that injects a grounding directive whenever the prompt touches RuvNet — so grounding is *enforced*, not merely suggested |

## How the brain is delivered

The plugin itself is tiny and path-free. The ~300 MB brain bundle is fetched once to
`~/.cache/ruvnet-brain/` by the MCP launcher (`mcp/server.mjs`).

**Local / dev:** point the launcher at a local brain instead of downloading:
```bash
mkdir -p ~/.cache/ruvnet-brain && ln -s /absolute/path/to/ruvnet-brain/kb ~/.cache/ruvnet-brain/kb
```

## Roadmap

- **v0.1 (now):** grounded `search_ruvnet` over 19 repos + grounding skill + enforcement hook.
- **Next:** `ingest_ruvnet_repo` — pull in any `github.com/ruvnet/<name>` repo on demand mid-project.
- **Publish:** host the brain bundle as a GitHub Release; the launcher auto-fetches it.

## License

MIT
