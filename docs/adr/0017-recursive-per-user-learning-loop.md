---
id: ADR-017
title: Recursive per-user learning loop — capture how you work, share learnings across projects, isolate facts
status: Accepted
date: 2026-07-15
authors: [Stuart Kerr, Claude Code]
tags: [learning, agentdb, sona, reasoningbank, cross-project, configurator, explainer]
supersedes: []
relates: [ADR-013, ADR-016]
updated: 2026-07-22
updated_source: derived-from-git
---

**Status**: Accepted (foundation shipped in v3.0.5; retrieval + skill-promotion are the named next layers)

## Status

**Foundation implemented — v3.0.5 (2026-07-15).** The capture loop, cross-project global store, the
console "what it's learned" strip, and the explainer callout shipped. Retrieval-in-project (using the
learnings during work) and best-practice→skill promotion (e.g. codifying the deploy workflow as a global
skill) are the named next layers, not yet built.

## Context

RuvNet Brain stored and recalled memory, but it did not *learn* — it never got smarter about how the
user works. A deep dive (grounded in `concepts/agentdb` + `marketing/reasoningbank-agentdb`, and proven
by effect on the live machine) found the real cause: **AgentDB's learning engine (ReasoningBank + Reflexion
+ the SONA self-learning bandit with EWC++ consolidation) works, but nothing ever invoked it.** No hook
recorded the user's real work as a trajectory. Two earlier assumptions were disproven live: `ruflo neural
train` does not fail (JS fallback works), and updating ruflo to 3.31.x does not help (learning code is
byte-identical — proven by tarball diff). Proof the engine works: recording a trajectory via
`ruflo hooks post-edit`/`trajectory-*` climbed the global counter (1858→1863), learned real SONA patterns,
ran EWC++ consolidation, and persisted to AgentDB — verifiable, repeatable.

The user's vision: each person's Brain gets recursively smarter about *them* — **learnings** (how they
ship, test, verify) shared across all their projects; **facts** (code, secrets, data) isolated per
project, never cross-pollinated. A workflow done twice becomes a reusable best practice that appears in
every project. A pattern library, not rebuilding every house from scratch. And it must generalize to
every user, not just one — uncapped intelligence that grows through use.

## Decision

1. **Capture in the plugin, so it's cross-project by construction.** A `PostToolUse` hook
   (`plugin/scripts/learn-capture.sh`, Write|Edit|Bash) appends each step to a per-session queue — the
   workflow ACTION only (command verbs, file basenames), never file content or secrets. A session is a
   trajectory. Because the hook ships in the plugin, every installed RuvNet Brain does this for its own
   user automatically.
2. **Feed the GLOBAL per-user learner at session end.** `plugin/scripts/learn-flush.mjs` (SessionEnd)
   feeds the distinct workflow actions into the SONA learner with `cwd=$HOME`, so learnings accumulate in
   ONE per-user store (`~/.claude-flow`), shared across all projects. Project facts stay in each
   project's `.swarm/memory.db`, never here. Bounded + best-effort (never stalls session end).
3. **Show it (make the invisible visible).** `scripts/learnings.mjs` reads the global learner (counts,
   last-adaptation, recently-observed workflow); the console renders a compact "Learning how you work"
   strip in the memory card, and the explainer carries a callout on uncapped, per-user recursive learning.
4. **Honest data only.** The strip shows real counts + the actual recent workflow; nothing invented.

## Verification (so it is real, not theater)

- Mechanism proven: `ruflo hooks post-edit` climbs `.claude-flow/neural/stats.json trajectoriesRecorded`
  (done-criteria: `before < after` ⇒ PASS — ran live, passed 4→5).
- Cross-project capture proven: feeding a deploy workflow (version bump → git push → gh run watch → vercel
  → playwright verify) via `learn-flush.mjs` climbed the GLOBAL learner 1858→1863.
- `tests/unit/learnings.test.mjs` locks the reader (inactive shape, real counts, dedupe, malformed-skip).

## Known limits / next layers (honesty)

- **Store split:** the MCP server caches globalStats in memory and different paths write different
  cwd-relative `.claude-flow` stores — a lost-update class already documented in global CLAUDE.md Rule 19.
  The capture path uses a single-writer-per-call pattern (safe enough); an append-only stats fix is the
  durable answer if reliability demands it.
- **Retrieval-in-project** (using the learnings to actually change behavior during work) and
  **best-practice→skill promotion** (codifying a repeated workflow, e.g. deploy, as a global
  `~/.claude/skills/` skill that loads in every project) are the next layers — designed, not yet built.

## Consequences

- Every user's Brain learns how *they* work and gets smarter across all their projects — the uncapped,
  recursive loop, shipped as a plugin default.
- Learnings and facts are cleanly separated (share how-you-work, isolate project data).
- The learning is visible and honest in the configurator and explainer — a real, showable win.
