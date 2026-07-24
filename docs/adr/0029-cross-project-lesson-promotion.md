---
id: ADR-029
title: Cross-project lesson promotion — a lesson learned twice is a lesson that should be global
status: Proposed
date: 2026-07-22
updated: 2026-07-23
authors: [Stuart Kerr, Claude Code]
tags: [learning, agentdb, memory, compounding, L5, 4.0]
supersedes: []
relates: [ADR-027, ADR-028]
---

**Status**: Proposed (2026-07-22)

Implements **L5 (Compounding)** from ADR-028's proactivity ladder. L5 is one of the three levels
that define 4.0.

## The failure, measured — not hypothesized

Run on the owner's own machine, 2026-07-22, by `scripts/lesson-promote.mjs`:

```
736 lessons across 41 project memory stores.
284 of them are `type: feedback` — "how I want you to WORK" — spread across 33 stores.

  Prove it works before calling it done        88 lessons · 19 projects
  Versioning and release discipline            52 lessons · 14 projects
  Never fabricate, never assume, never inflate 37 lessons · 14 projects
  Route work to the cheapest capable model     15 lessons ·  6 projects
  Keep docs and README current                 13 lessons ·  7 projects
  How to communicate with people               10 lessons ·  6 projects
  Use the real tool; never hand-roll           5 lessons ·  3 projects
```

**The owner has taught "prove it works before calling it done" 88 times, in 19 projects that cannot
see each other.** His words, and they are the requirement: *"I shouldn't ever have to tell you
twice."*

He did not repeat himself because he forgot. He repeated himself because the lesson **physically
cannot travel**: Claude Code scopes memory to `~/.claude/projects/<project>/memory/`, and nothing
promotes upward. Every project starts from zero on processes that were settled years of sessions ago.

This is not a theoretical gap. It fired during the very session that discovered it: six
behaviour-changing commits shipped at patch level with no version bump, and the owner had to catch
it — a lesson he has recorded 52 times across 14 projects.

## The tier that already exists, and the step that does not

There are already two tiers, and the promotion path between them is entirely manual:

| Tier | Location | Contents | How things get there |
|---|---|---|---|
| **User / global** | `~/.claude/CLAUDE.md` | 21 hand-written rules | the owner notices, and types it |
| **Project** | `~/.claude/projects/<p>/memory/` | 736 lessons | written automatically, all session long |

The bottom tier fills itself. The top tier fills only when a human notices a pattern across projects
he can no longer see all of. That asymmetry *is* the bug — the system automates the cheap half of
learning and leaves the valuable half to human memory.

## Decision

### 1. Independent rediscovery is the promotion evidence — the rule is rUv's, not ours

A lesson the user has taught in **two or more separate projects** is universal *by evidence*. This
is ruflo's **ADR-G008 "Win Twice to Promote"** (Accepted, implemented) applied to the strongest
signal available here: a human independently needed the same instruction in places that could not
see each other. It has already won twice, in the only arena that counts.

This is deliberately **not** a similarity score and **not** an LLM judgment. It is a count. Cheap,
explainable, and impossible to fudge — which matters enormously, because promotion writes to the
file governing every project the user owns, and *a bad global rule is far more expensive than a
missing one*. The predicate is `distinctProjects >= 2`, and the floor is clamped: a caller may
demand more evidence, never less.

**Repetition inside one project is explicitly NOT evidence.** Ten lessons about testing in one
project means that project was hard, not that the lesson is global. Promoting on raw count would
flood the constitution with local noise, and a constitution nobody reads governs nothing. This
distinction has its own test, verified to fail when the predicate is weakened to a raw count.

### 2. Only `type: feedback` is eligible

`type: project` lessons are, by their own declared type, about one codebase. Promoting them is a
category error and would leak one client's specifics into every other project's context.
Classification reads **name + description only, never the body** — bodies hold paths, client names,
and URLs, and dragging those into a global rule is the one outcome promotion must never produce.

### 3. Promote the PROCESS, not the files

Promoting 88 near-identical "test first" lessons verbatim would be worse than promoting none. We
cluster to the process and promote one canonical statement, citing the projects that independently
discovered it as evidence the user can audit and disagree with.

Clustering is keyword-based rather than embedding-based, on purpose: an embedding cluster is a black
box, and this writes the rules that govern everything. The user must be able to read the rule that
decided. **Legibility beats cleverness when the blast radius is total.**

### 4. Read-only by default; the write is fenced, backed up, and idempotent

`lesson-promote.mjs` reports by default and writes only under `--apply`. The write takes a backup
first, lives inside a `BEGIN/END` fence so regeneration replaces exactly one block, and preserves
everything outside it. Running twice does not duplicate. Nothing meeting the bar writes nothing —
no empty block, no backup churn.

### 5. Surviving updates is part of the definition

A promoted lesson that a nightly refresh clobbers was never global. The fence exists for this: the
brain's own update path must treat the promoted block as user data, not generated content. **This is
the open item** — see Verification #3. Until it is proven across a real refresh, L5 is not complete.

## Deliberately NOT in this round

- **Writing promoted lessons into AgentDB as well as CLAUDE.md.** The owner asked where user-level
  lessons should live — AgentDB or brain settings. Honest answer: `~/.claude/CLAUDE.md` is the tier
  that is *already loaded into every session on every project*, so it is where a promoted rule
  actually changes behaviour today. An AgentDB copy is the right second home for semantic recall,
  but writing to two stores before either is proven is how the two-disconnected-stores failure of
  2026-05-31 happened. One store first, proven, then the second.
- **Demotion.** A promoted rule that stops being useful should fall back out. ADR-G008 has a
  demotion path (a failed evaluation resets the win count). We have no outcome signal yet, so we
  cannot honestly implement it — and a promotion system with no demotion accumulates cruft forever.
  Tracked, not pretended.
- **Auto-apply.** Promotion currently requires an explicit `--apply`. Making it automatic is the
  obvious next step and is exactly what the owner asked for ("the settings need to update, I
  shouldn't have to go through that learning tree every time"), but auto-writing a user's global
  instructions without a proven outcome signal is not something to ship on its first night.

## Consequences

- A process learned once is available everywhere, and the 88×-in-19-projects failure becomes
  structurally impossible to repeat silently.
- New projects inherit settled process from their first session instead of relearning it.
- **New risk:** a wrongly-promoted rule misdirects every project at once. Mitigated by the
  independent-rediscovery bar, feedback-only eligibility, name+description-only classification, the
  backup, and the fence — and it remains the single most dangerous thing this repo can do.

## Verification (what must be true before this is Accepted)

1. ✅ Runs on a real machine and produces evidence-cited output — 736 lessons, 41 projects, 7
   promotable processes, each naming the projects that taught it.
2. ✅ Tested at all five classes ADR-028 requires (low/medium/high/numeric/qualitative), 14 tests,
   with the central guard proven to FAIL when the predicate is weakened to a raw lesson count.
3. ⚠️ **A promoted lesson survives a nightly refresh and a `--update`.** Demonstrated by ISOLATION on
   2026-07-23 (7 lessons promoted live; `~/.claude/CLAUDE.md` 37510→39903 bytes, backup
   `CLAUDE.md.bak-promote-2026-07-23`), not yet by live execution. The promotion lives between unique
   markers `<!-- BEGIN ruvnet-brain: promoted-lessons -->`; the ONLY writer of `CLAUDE.md`
   (`bin/install.mjs`, on `--update`/`--uninstall`/`--enhance`) surgically edits a DIFFERENTLY-marked
   block (`ruvnet-brain:start`) and physically cannot touch the promotion block; `scripts/update-apply.mjs`
   has ZERO `CLAUDE.md` references; re-applying is idempotent (delta 0). A live end-to-end `--update` was
   NOT run — it installs the published version, not the branch — so this is proof-by-isolation (falsifiable:
   matching markers, or an update-path write to `CLAUDE.md`, would break it), not proof-by-execution.
4. ❌ **The proactive loop closes**: the console offers the promotion unprompted ("7 processes you
   taught in multiple projects are trapped at project level — promote them?"), rather than the user
   having to know this script exists. Currently it is a CLI nobody would think to run, which is the
   exact failure mode ADR-027 was written about.
5. ❌ Adversarial cross-model review recorded, per ADR-027 principle 6.
