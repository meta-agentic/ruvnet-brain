# MetaHarness

Updated: 2026-07-17

> Source of truth for the MetaHarness explainer diagram used by the console card and the tips page.
> Every element below is grounded in rUv's accepted ADRs — nothing here is inferred:
>
> - **Seven policy surfaces** and "freeze the model, evolve the harness" — `agentic-flow/docs/adr/ADR-075-metaharness-harness-evolution-and-provenance.md` (Status: Accepted, implemented in 2.1.0)
> - **Four pillars** (route · evolve · orchestrate · verify) and "a cheap model in a well-built,
>   self-improving harness matches a frontier model at a fraction of the cost" —
>   `agentic-flow/docs/adr/ADR-076-reposition-agentic-flow-as-agentic-meta-harness.md` (Status: Accepted)
> - **28.5% cheaper at 98.1% bar-compliance** — ADR-073, cited in ADR-076.
>
> ADR-076 names the exact problem this diagram exists to solve, in its own risks section:
> *"'Meta-harness' is a newer term; the README must define it in the first screen so it doesn't read
> as jargon. Mitigation: the one-line 'freeze the model, evolve the harness' gloss + the four-pillar
> framing."* We shipped the jargon and skipped the mitigation. This is the mitigation.

## MetaHarness architecture

```
                    FREEZE THE MODEL  ·  EVOLVE THE HARNESS

    +-- THE HARNESS -- seven policy surfaces, each mutated and measured -----+
    |                                                                        |
    |    planner        contextBuilder        reviewer        retryPolicy    |
    |                                                                        |
    |                  +--------------------------+                          |
    |                  |     MODEL   [ FROZEN ]   |                          |
    |                  |  the same Claude you     |                          |
    |                  |  already have. Never     |                          |
    |                  |  retrained. Never swapped|                          |
    |                  +--------------------------+                          |
    |                                                                        |
    |    toolPolicy        memoryPolicy             scorePolicy              |
    |                                                                        |
    +------------------------------------------------------------------------+
             |               |                |                |
           ROUTE          EVOLVE        ORCHESTRATE         VERIFY
      cheap -> frontier   keep only      agents, swarms,   provenance
        per query       what measurably       MCP          + safety gate
                            improves

         a cheap model in a good harness  ~  a frontier model, for less
                  measured: 28.5% cheaper at 98.1% bar-compliance
```

## What it means in one line

You cannot retrain the model. So evolve everything wrapped around it — and keep only the changes
that measurably win.
