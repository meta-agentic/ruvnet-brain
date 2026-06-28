# <NAME> Knowledge Base — Primer

> Top-down orientation for humans AND AI agents (Claude, Codex). EVERY factual claim below is
> grounded in a query run against THIS KB during generation — show the citing path as
> `[grounded: <path>]`. Do NOT write claims from memory; run `forge-ask.mjs` and cite the hit.
>
> This primer is structured around the SIX comprehension archetypes a raw repo cannot answer on
> its own. The build also indexes each section as a synthetic `PRIMER#<n>-<slug>` document, so the
> retrieval layer can force-route an orientation question straight to the matching section.

## PRIMER#1 — What this product IS  (archetype 1: what is it?)
One paragraph: the repo's purpose, who it's for, the single sentence that captures it.
`[grounded: <path from "what is this repository">]`

## PRIMER#2 — Core concepts (the vocabulary)  (archetype 2: what are the concepts?)
The 5-10 terms you must know to read anything else. One line each, each grounded in the DEFINING
doc (the ADR/source/doc whose filename or title names the concept), not a passing mention.
`[grounded: <path(s)>]`

## PRIMER#3 — How each concept/component works  (archetype 3: how does it work?)
Mechanism per major component. Where a design doc (ADR/DDD) describes intent, say so AND cite the
implementing source if it exists — a proposal is not shipped reality.
`[grounded: <path(s)>]`

## PRIMER#4 — Capabilities graded honestly  (archetype 4: how complete/mature is it?)
Per major component: what WORKS today, what's PARTIAL, what's PROPOSED-only. Grade A-F with
evidence. No inflation. If an ADR is `Status: Proposed`, grade it as intent, not delivery.
Surface the ADR status explicitly. `[grounded: <path(s)>]`

## PRIMER#5 — Where everything lives  (archetype 5: where is the documentation?)
The map: the ADR index (how many, where), docs/tutorials/examples, key source dirs. A reader who
wants to go deep should know exactly where to look. `[grounded: <path(s)>]`

## PRIMER#6 — End-to-end playbook  (archetype 6: how do I use it?)
The from-scratch walkthrough: install, the minimal first task, then the common next tasks. Real
commands. `[grounded: <path(s)>]`

## How to query this KB
```
cd <kb-dir> && npm i                       # first time only
node forge-ask.mjs --dir . --name <NAME> --q "your question" --k 6   # auto-picks big if present
node forge-ask.mjs --dir . --name <NAME> --q "..." small             # force the 384-dim build
```
- TWO builds may ship from the SAME passages: a **big** 768-dim (bge, Mac/PC, sharper) and a
  **small** 384-dim (MiniLM, edge/Seed-compatible). One tool auto-selects the embedder by reading
  the `<NAME>.rvf.embed.json` sidecar next to each `.rvf` — so a query is always embedded with the
  model the corpus was.
- The `.rvf` returns `{id, distance}` only; full TEXT comes from `<NAME>.passages.jsonl` (the join
  is done for you by `forge-ask.mjs` / `forge-mcp.mjs`).
- DO NOT use `@ruvector/rvf-mcp-server` — it's a non-functional stub.

## What this KB covers (census + grades)
Paste the Step-1 census, the census-diff coverage score, the dual-metric answer-quality grades
(STRICT + REAL-USE), and any known gaps / proposed-not-shipped areas.
