---
id: ADR-027
title: The brain advocates, it does not wait — capability advocacy + the death of passive signals
status: Proposed
date: 2026-07-21
updated: 2026-07-21
authors: [Stuart Kerr, Claude Code]
tags: [strategy, learning, proactivity, agentdb, sona, reasoningbank, console, health]
supersedes: []
relates: [ADR-0013, ADR-0023, ADR-0024, ADR-0025]
---

**Status**: Proposed (2026-07-21)

Governed DDD: `docs/ddd/0004-advocacy-context.md`

## The failure that forced this

For **three weeks**, RuvNet Brain had indexed 69 of rUv's repositories — including `agentic-flow`'s
ReasoningBank, `ruflo`'s SONA/MoE intelligence layer, the 4-step RETRIEVE → JUDGE → DISTILL →
CONSOLIDATE pipeline, and the `ruflo-intelligence` plugin that wraps 29 intelligence MCP tools.

It could have *answered* any question about any of them. It never once *said*:

> "Your learning system is installed and switched off. Turn it on."

The owner discovered it himself, on 2026-07-21, and measured the cost: the learner had **5
trajectories and 7 patterns, last trained six days earlier**, while **1,884 captured events** sat
undelivered in a queue. Draining it took the learner to **412 trajectories / 412 patterns** in one
command. Three weeks of learning had been available for the asking and never asked for.

His verdict, recorded verbatim because it is the design input: *"That is the most obvious active
piece of intelligence you could have given me."*

## The strategic error underneath it

**We built a search box and called it a brain.**

rUv's problem is not that his work is undocumented. It is that it is **undiscovered**. His own
`ruflo-intelligence` README calls cross-project IPFS pattern transfer *"the substrate plugin's most
underused capability."* The author knows people cannot find what he built. Dozens of genuinely
powerful technologies inside RuVector are effectively invisible to the people who already have them
installed.

**Closing that gap is the product.** Retrieval is a means. A brain that waits to be asked is a
search box with good manners; a brain that says *"you own X, it is off, here is what turning it on
buys you, shall I?"* is the thing worth having on your shoulder.

## The mechanical error underneath THAT

Every signal this system produces is **passive**. Reviewed across 2026-07-20/21, the pattern is
exact and repeats without variation:

| Signal | Encoded as | Result |
|---|---|---|
| ADR status (Proposed vs Accepted) | prose in a response | model read past it; design intent relayed as fact |
| Proactivity | prompt text in a session hook | model reasoned past it, articulately |
| Retrieval confidence | result formatting | thin evidence read as "nothing exists" → hand-rolling |
| Store integrity | a console card | corruption sat unfixed until the owner noticed |
| Learning | a CLI nobody runs | 1,884 events queued, learner idle six days |

Against that, the signals encoded as **gates** — `ground-before-write`, `verify-interface`,
`pre-push` — were obeyed **100% of the time**, including three occasions in one session where they
stopped this author from hand-rolling a tool rUv already ships.

**The conclusion is not subtle: knowledge that does not interrupt does not act.**

## Decision

### 1. Capability advocacy becomes a first-class product surface

The brain audits the user's machine for RuvNet capability that is **installed but dormant** and
recommends it, unprompted. Dormant-but-installed is classified as a **defect**, never a neutral
state.

The audit is grounded in what is actually on the machine — never a hardcoded list of "cool
features," which would rot within a week of rUv shipping.

### 2. Detection without a remedy is prohibited

Any surface that can detect a problem MUST be able to offer a fix. Concretely: every health
dimension that can report `fail` must have a corresponding recommendation with an executor behind
it. A card that worries someone is not a button that fixes it.

This is enforced structurally — recommendations are constructed through
`console-engine.makeRecommendation()`, which **throws** on any recommendation lacking evidence,
cost, an undo, and (when it touches the machine) a plain-English impact statement.

### 3. Signals become active

Anything load-bearing moves out of prose and into a gate, a recommendation, or an alarm:

- **Memory/store corruption** joins the GONG path already used for retrieval outage — the same
  loud, in-band, unmissable treatment. Silent integrity failure is unacceptable.
- **Score deltas alarm, not just scores.** A fall from 100 → 49 must be its own signal; without a
  persisted baseline, a cliff and a drift look identical.
- **The learning flush runs on a heartbeat**, not only on a clean `SessionEnd`. A queue that drains
  only on graceful exit will always leak, because sessions compact, crash, and resume.

### 4. We turn rUv's systems ON; we never rebuild them

The learning architecture is not ours to write. `ruflo hooks pre-task/post-task/post-edit/
post-command`, SONA, MoE, ReasoningBank, and `agentdb_consolidate` already exist and work — proven
live this session. Our job is wiring, surfacing, and advocacy. Where rUv ships a discoverable
surface (`ruflo-intelligence`, 29 tools behind `/intelligence` and `/neural`), we **recommend and
install it** rather than building a worse parallel.

### 5. Every ADR carries a DDD, and both get attacked

An ADR ships with an accompanying DDD (bounded context, ubiquitous language, invariants), and both
are subjected to adversarial review before acceptance — to establish the design is *optimal*, not
merely workable. Cross-model attack (Claude vs GPT-5.6) is the standing mechanism; tonight it found
defects three Claude reviewers missed.

## The proof case (why this is worth building)

**John O'Hare, 2026-07-21.** A technically excellent engineer running RuVector via a docker sidecar,
self-assessed at *~20%* utilisation. He was handed **one question** to ask his AI — *"give me the
five most differentiated and valuable features of ruvector as a markdown table."*

His response, hours apart:

> *"this is a new way for me to even try to attempt that — which is further than I was before"*
>
> *"been trying to land this upgrade for MONTHS and you unlocked it with one question,,, amazing"*

He shipped a mesh-verified upgrade plan the same day. **He was never blocked by skill.** He was
blocked by not knowing which question to ask — and the only reason anyone knew the question is that
someone else had been lost in the same place first.

**Knowing the question is the scarce resource.** Not intelligence, not documentation, not access.

### The standard this sets

> A developer who solves a hard problem with this tool, and *later* discovers they already owned a
> capability that would have made it trivial, is a **failure of this project** — not of the user.

### The constraint that keeps it honest

**This is goal-aware capability matching, not evangelism.** The job is *not* to push RuvNet
technology into every situation. It is to notice what the person is actually trying to accomplish,
know the stack well enough to identify which parts genuinely serve *that* goal, and offer those.

Recommending rUv tech to someone whose problem it does not fit is the same failure in the opposite
direction — and it is the faster way to destroy trust, because it is indistinguishable from
salesmanship.

The form is always an offer, never a demand: *"Here's something I noticed. Is that something you'd
like me to pursue?"* They do not have to act on it. They do have to **know**.

### Why it stays invisible without this

Users cannot see what is on. In the owner's words: *"a ton of people don't know what is or isn't
turned on because it's very much a black box."* Measured on his own machine the same day: **208
AgentDB stores, 156 with zero learns, 87 holding 154,106 memories while learning nothing.** The
console had `patterns` and `learns` on every fleet entry the entire time and never said the sentence.

## Constraints and honesty

- **Advocacy must not become nagging.** A recommendation is offered once per state change, is
  dismissible, and never re-fires while dismissed. The nudge principle governs: correct, clear,
  confident, deferential, never pushy.
- **No fabricated capability claims.** The audit reports only what it observed on this machine.
  Recommending a capability the user does not have installed is the same lie as any other.
- **Two learner stores exist and disagree** — the project-local `.claude-flow/neural` and the global
  `~/.claude-flow/neural`. rUv documents this as issue #2245 ("four contradictory sources"). Until
  it is unified upstream, the console MUST read the store that learning actually writes, or state
  plainly that both exist. This ADR does not pretend to fix rUv's fragmentation; it refuses to
  report a corpse as your brain.

## Consequences

- The console gains health/learning recommendations with real executors (`scripts/health-repair.mjs`).
- The capture queue drains on a heartbeat; the learner stops starving.
- New failure mode to watch: advocacy that fires too often becomes noise, and noise is how a real
  alarm gets ignored. Dismissal state is therefore part of the design, not an afterthought.

## Verification (what must be true before this is Accepted)

1. A corrupt store produces a recommendation with a working one-click repair — proven on a real
   store, with row counts before and after.
2. A machine with a healthy store and a live learner produces **no** recommendations (no false
   alarms).
3. A dormant capability on a real machine produces a real recommendation naming it.
4. A score drop from a persisted baseline fires an alarm, demonstrated on known-bad input.
5. The adversarial review of this ADR and its DDD is recorded, including anything it defeated.
