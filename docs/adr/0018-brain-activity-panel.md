---
id: ADR-018
title: Brain Activity panel — the harness, visible, inside the configure console
status: Implemented
date: 2026-07-15
authors: [Stuart Kerr, Claude Code]
tags: [console, brain-activity, agentdb, visualization, personalization, ux, legibility]
supersedes: []
relates: [ADR-013, ADR-015, ADR-017]
updated: 2026-07-27
updated_source: derived-from-git
---

# ADR-0018: Brain Activity panel — the harness, visible, inside the configure console

**Status**: Implemented (ships in v3.1.0)
Date: 2026-07-15
Updated: 2026-07-15 (evening) — BUILT AND INTEGRATED: `console/activity.js` + `card-activity`
(first card) + `GET /api/activity`, live-verified against the real store. Same session shipped the
console-wide confidence pass this ADR's review provoked: legibility floor (both themes), provenance
badges, empty states, providers row, dev/prod + settings click-to-learn popovers, privacy standby
framing, relevance-ordered recommendations, in-row stack remedies, instant-cache stack loads.
Earlier update — prototype round 2 after Stuart's review: stat tiles become clickable
"doors" (lessons browser / memories breakdown by namespace / universe list); a compact animated
"distillation flow" strip (captured → distill → lessons) returns the visualization as meaning,
not mood; panel teaches its own vocabulary (memories vs distilled lessons) in one line.

## Context

Stuart's brief (2026-07-15, distilled from the Glass Brain design session): people who start
with the stack "have no idea what's happening under the covers." The value story rUv struggles
to tell — *"it's not just about the underlying smarts of the model anymore; it's about the
harness that knows how to drive it to maximum effectiveness"* — is currently invisible: AgentDB
writes, compaction survival, MetaHarness audits, and routing decisions all happen silently.

A first full-screen "cinematic galaxy" prototype failed review on four counts (contrast,
clarity, message, screen real estate) and produced a standing design rule: **information-first,
high-contrast, every pixel earns its place; a metaphor may decorate the data, never replace it.**

Verified live against this project's `.swarm/memory.db` (2026-07-15): 1,073 active entries
(Jun 30 → Jul 15), 5 distilled lessons (TASK/TRIED/WORKS shape), 365 `causal_edges`, real
`metaharness-audit` and `trajectories` namespaces, and an `access_count`/`last_accessed_at`
schema whose write path is barely exercised (access log empty). Machine-wide: 50 projects with
stores, ~85,000 memories total.

## Decision

Add a **"Brain activity"** card to the existing onboarding console (`console/index.html`,
ADR-0013/0015 family), following the console's exact card grammar and Amber Substrate
semantics (cyan = observed, amber = the mind acting, green = grounded).

1. **Tool attribution is the organizing principle.** Every feed row leads with the harness
   component that acted (AgentDB / MetaHarness / Ruflo / agenticow chip) + a plain-English
   action ("stored lesson — never cp a live DB"). Real rows come from `memory_entries` by
   namespace; anything illustrative carries a visible marker. A harness-roster strip gives
   each tool a ≤6-word role; hovering highlights its rows. Footer tagline: *"the model is the
   engine — this is the harness driving it."*
2. **Drill-down = personalization.** Lesson rows expand inline to the verbatim stored lesson
   (TASK / TRIED / WORKS) with learned-date and recall count. The user's own memory looking
   back at them is the retention moment ("after two weeks: it learned all these things").
3. **Form factor:** a `details.card` (`id="card-activity"`) beside `card-memory` —
   `card-memory` = store health; `card-activity` = what the harness did. Never full-screen.
4. **Server:** new `GET /api/activity` in `scripts/onboarding-console.mjs` (same one-line
   route pattern as `/api/state`), reading the project store read-only: recent entries (18),
   lessons namespace, counts, and a per-day growth histogram. File reads only — no model or
   API calls (billing-safety invariant of ADR-0015 holds).
5. **Ship as v3.1.0** — its own commit, its own version bump/update signal; explicitly NOT
   entangled with the v3.0.x stream or the second session's uncommitted work in this tree.

Prototype: `scratchpad/glass-brain-panel.html` (Fable 5-built, per the visualization model
routing order), rendered inside a mock console frame for review before wiring.

## Consequences

- The invisible differentiators (memory persistence across compaction/sessions, audit runs,
  routing) become a glanceable, teachable surface — the console stops being config-only.
- Known gap made explicit: `access_count` is schema-real but write-path-cold; "recalled N×"
  stays honest (shows 0 until recall increments are wired — a separate, small change).
- Curation rule inherited from `lesson-telemetry-drowns-signal`: the feed prioritizes lessons
  and named events over raw session telemetry.
- Deferred (recorded, not planned): full-screen cinematic mode, universe/cross-project view
  (machinery proven in the v2 prototype), star-brightness-by-usage.
