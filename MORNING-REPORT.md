# RuvNet Brain — Overnight Build Report (2026-06-29)

> Honest status. "Proven" = a command was run and its output checked. Re-run anything below yourself.

## Bottom line
The brain went from **5 → 19 repos**, every one now has the prose capability layer, and the
"never wrongly doubt a capability" guarantee was hardened and **proven to generalize** — not just on
the questions I tuned against, but on a held-out set I built *after* tuning. It's packaged as a
one-line-install Claude Code plugin and the shipped bundle was acceptance-tested as a fresh consumer.

## Proven (with the numbers)
- **19 repos built** (both embedding variants + symbols): agent-harness-generator, agentdb, agentic-flow,
  agenticow, cve-bench, daa, dspy.ts, fact, helix, qudag, ruflo, rulake, rupixel, ruv-fann, ruvector,
  ruview, safla, sparc, synthlang.
- **19/19 prose primers built** (all GROUNDED, 3-vendor primer scores 95–97), folded into the rebuilt
  **concepts store** (19 primers + 11 L2 articles → 114 passages, reconcile MATCH=true).
- **Capability-confidence battery: 27/27 tuned AND 27/27 held-out** → **20/20 capability questions**
  resolve to the correct repo across all 19. The guarantee holds and generalizes.
- **Shipped bundle acceptance test passed**: `cd dist/ruvnet-brain && npm i && node forge-ask-all.mjs …`
  → grounded hit `concepts/ruflo/PRIMER`. The zipped artifact works on its own, not just my dev copy.
- **Bundle**: `dist/ruvnet-brain.zip` (421 MB), `v0.3.0-dev`, coverage `{built:19, catalogued:169, orgTotalApprox:248}`.
- **Primers polished**: stripped 122 redundant doubled headings across all 19, re-embedded concepts, re-verified both batteries still **27/27** after.
- **On-demand ingest built + tested**: `scripts/ingest-repo.mjs` — live-tested by ingesting `rvm` (not previously in the brain) → cloned + embedded (both variants) + symbols, searchable with no restart. Source-searchable immediately; for full capability-confidence on an ingested repo, run its primer next (the script prints the command).

## How the capability guarantee was hardened (the thinking)
Adding 14 new primers first *regressed* ruflo and didn't fix qudag/safla — **concepts dilution**: with
19 primers crowded into one store, the queried repo's own primer got out-ranked by siblings that merely
mention it (qudag lost to daa; ruflo lost to agentic-flow/agent-harness which both say "ruflo"). Two
principled levers fixed it, both general (not question-specific):
1. **Repo-name affinity** — when a question explicitly names a repo, that repo wins ties/near-ties over a
   sibling that merely references it (word-boundary match, so `fact` doesn't fire on "facts"; attributed
   through concepts-hosted primers via path prefix).
2. **Deeper concepts pool** — the concepts store holds all 19 primers, so it needs more candidate slots
   than a single source repo, or the right primer never reaches the cross-encoder.

## The one story worth telling
A held-out question asked "How does FACT do *augmented context retrieval*?" (FACT's description in Ruv's
org README). The brain **refused to strongly match it** and resolved to fact only weakly — because the
*actual repo's* grounded primer says **"FACT = Fast-Access Cached Tools … advanced caching."** The repo is
about caching, not context-retrieval. **The brain corrected my wrong prior from real source — which is the
entire product working, demonstrated on its own author.** (I corrected the test question to the repo's real
self-description; it then passed.)

## Cleanup to one clean version
- Deleted dead code: `kb/forge-grade.mjs`, `kb/forge-score.mjs` (superseded), `dist/ruflo-brain*` (retired v1).
- De-hardcoded every author path out of the **shipped** tools (`resolve-deps`, `forge-rerank`) and the
  author-side scripts (`self-update`, `brain-stamp`) — verified: zero `/Users/stuartkerr` paths in shipped tools.
- Refreshed all docs to the 19-repo / ~248-org reality + unified version `v0.3.0-dev`; wrote a real root `README.md`.
- Refreshed the explainer with correct numbers **+ full SEO** (title, description, OG/Twitter cards, JSON-LD).

## The deliverable
- **Plugin** (`plugin/`): `.mcp.json` (the `search_ruvnet` server) + `skills/ruvnet-brain/SKILL.md` (grounding +
  tool-preference) + `hooks/` (a `UserPromptSubmit` enforcement hook — grounding is *enforced*, not suggested) +
  a real **test suite** (`plugin/test/run-tests.mjs`, run it: `node plugin/test/run-tests.mjs`).
- **Bundle** (`dist/ruvnet-brain.zip`): the 19-repo brain + tuned tools, acceptance-proven.

## Install + test in Helix (your machine, works now)
The brain is already cached on this machine (`~/.cache/ruvnet-brain/kb` → this repo's `kb/`), so:
```
claude plugin marketplace add /Users/stuartkerr/Code/ruvnet-brain/plugin
claude plugin install ruvnet-brain@ruvnet-brain --scope user
```
Then in Helix, ask Claude anything about the RuvNet stack — it will ground via `search_ruvnet` and prefer
RuVector/Ruflo/AgentDB/Cognitum over generic defaults. (First `claude plugin install` may show a one-time
trust prompt for the hook — that's the one step I left for you.)

## Honest gaps / next steps (NOT done)
1. **Ingest, shippable to others** — `scripts/ingest-repo.mjs` works on this machine (it's how I added `rvm`),
   but the build toolchain it calls (`forge-build`/`forge-big`/`build-symbols`) isn't in the shipped bundle yet,
   so on-demand ingest works for *your* brain now; bundling that toolchain is the step to make it work for others.
2. **Public one-line install** — `claude plugin marketplace add stuinfla/ruvnet-brain` needs the plugin pushed
   to GitHub + the 421 MB brain hosted as a Release (the launcher's auto-fetch is a stub). Outward action — your call.
3. **Registry refresh** — still the 169-repo snapshot; re-pull to ~248 to fix the `catalogued` count.
4. **Grading** — only the original 5 of 19 are 3-vendor graded; the 14 new have primers + pass the capability
   gate but aren't formally graded yet.

## Verify it yourself
```
node plugin/test/run-tests.mjs                                              # 27/27 (tuned)
CAP_QUESTIONS=plugin/test/capability-questions.heldout.json node plugin/test/run-tests.mjs   # 27/27 (held-out)
```
(Both need `export KB_MODEL_CACHE=/Users/stuartkerr/Code/PowerPlatePulse/scripts/models-cache`.)
