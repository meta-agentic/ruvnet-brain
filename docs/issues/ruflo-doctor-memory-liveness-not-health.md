# `doctor --component memory` asserts existence, not function — it passes a store that is 99.97% empty (and one SQLite calls malformed)

**Component:** `v3/@claude-flow/cli/src/commands/doctor.ts`
**Version:** ruflo 3.28.0 / @claude-flow/cli 3.28.0
**Evidence:** measured on a real 81-store fleet, macOS, 2026-07-14. Happy to supply raw dumps.

---

## The ask, in one line

**`checkStaleSettingsNpx()` (#2448) is exactly the right shape. The memory check never got that treatment.**

`#2448` asserts a real failure, marks it CRITICAL, and names the fix. It caught a genuine
production-killer on my machine today. By contrast, the memory check is:

```
✓ Memory Database: .../.swarm/memory.db (7.27 MB)
Summary: 1 passed
All checks passed! System is healthy.
```

That is `existsSync()` + `statSync().size`. It cannot fail on any database that exists. **A check that
cannot fail protects nothing.**

## What it passes today

**A store that is 99.97% empty:**

```
$ cd ~/Code/AMBUILANCE_INVENTORY && ruflo doctor --component memory
  ✓ Memory Database (7.27 MB) — All checks passed! System is healthy.

$ sqlite3 .swarm/memory.db "
    SELECT count(*),                                                       -- 11133
           sum(CASE WHEN length(trim(coalesce(content,'')))>0 THEN 1 END)  --     3
    FROM memory_entries;"
```

**And a database SQLite itself calls malformed.** This happened live, minutes after I first ran the
doctor on it:

```
$ sqlite3 .swarm/memory.db "PRAGMA integrity_check;"
  *** in database main ***
  Error: database disk image is malformed (11)

$ ruflo doctor --component memory
  ✓ Memory Database (13.09 MB) — All checks passed! System is healthy.
```

The doctor reports a corrupt database as healthy. Note that ADR-174's distill already relies on a
`quick_check` gate before writing — so the primitive is present in the codebase; the doctor just
doesn't use it.

## The deeper defect: reflexion is structurally unreachable on every store

`memory distill` (ADR-174) populates `episodes` with raw INSERTs:

```
session               task                             reward  success  critique
distill:ruvnet-brain  "2026-07-14 SESSION: …"           0.0      0       NULL
```

Every episode: `reward=0`, `success=0`, `critique=NULL`, **and no row in `episode_embeddings`.**

But `agentdb/src/controllers/ReflexionMemory.ts` retrieves with an **INNER JOIN**:

```sql
FROM episodes e JOIN episode_embeddings ee ON e.id = ee.episode_id
```

`episode_embeddings` is empty ⇒ `retrieveRelevant()` returns **zero rows, always** ⇒
`getCritiqueSummary()` answers *"No prior failures found for this task"* on every project, forever,
no matter how many episodes accumulate.

`storeEpisode()` generates the embedding itself. The empty table therefore **proves `storeEpisode()`
has never been called** — distill bypasses the controller.

### Fleet measurement (81 stores)

| | |
|---|---|
| Total episodes | **7,396** |
| Episodes carrying a `critique` | **0** |
| Rows in `episode_embeddings` | **0** |
| Skills promoted | **0** |
| Stores where `retrieveRelevant()` can return anything | **0 of 60** |

Meanwhile `agentdb_controllers` reports 16 of 23 active — `reflexion: enabled`, `skills: enabled`,
`nightlyLearner: enabled` — and `agentdb_health` reports `cacheStats: {hits: 0, misses: 0}`.
**Instantiated, never called.** The engine is built; the fuel line is disconnected.

---

## Proposed fix — the memory check, in the existing `HealthCheck` shape

Same contract as every other check in `doctor.ts` (`{name, status, message, fix}`), so this drops in.
Ordered by where the chain breaks first, so the first red is always the one worth fixing today.

| # | Check | `fail` when | Would have caught |
|---|---|---|---|
| 1 | **Integrity** | `PRAGMA integrity_check != 'ok'` | the malformed DB above (the `quick_check` primitive already exists in distill) |
| 2 | **Content** | <95% of `memory_entries` have non-empty `content` | a schema rename (`value` → `content`) that left ~40k rows with keys and no text |
| 3 | **Embedding coverage** | <95% have a vector | unembedded rows are both unrecallable **and** undistillable — ADR-174 skips rows with no parseable vector |
| 4 | **Recall (functional)** | a probe written to a scratch namespace cannot be found by **paraphrase** in top-k (then deleted) | a store with vectors that still cannot retrieve |
| 5 | **Distillation** | `patterns / real_memories` far below the ~34% ADR-174 measured, or a stale `distill_state` cursor | cursors that advanced without distilling (I have a store at 11,132 processed → **1** pattern, `uses=1`) |
| 6 | **Reflexion** | `count(episode_embeddings) = 0`, or `retrieveRelevant()` returns 0, or no episode carries a `critique` | **currently fails on 100% of stores** |
| 7 | **Skills** | 0 promoted after N successful episodes; report `getTaskStats().improvementTrend` | a system that records outcomes but never improves |
| 8 | **Continuity** | after a compaction/session boundary, a recall for the project does not surface its latest checkpoint | memory written but never read back — indistinguishable from lost |

**Design rules — these matter more than the specific eight:**

- **A check that cannot fail protects nothing.** Every check needs a demonstrable red state.
- **UNKNOWN is never PASS.** If a check can't run (table missing, DB unreadable), report `warn`/`fail`
  — never fold it into a reassuring pass. *(A doctor that cannot distinguish "the patient is dead"
  from "I couldn't find the patient" is worse than none — I shipped that bug myself while writing
  this, and it's why I'm sure it's worth stating.)*
- **Print the measurement, not a checkmark.** `✓ Memory Database (7.27 MB)` communicated nothing.
  `content 3/11133 (0.03%)` communicates everything.
- **Exit non-zero on a failing dimension**, so a scheduled job can never call a dead brain green.

### And close the distill → reflexion gap

Either have distill write episodes **through `ReflexionMemory.storeEpisode()`** (which generates the
embedding), or have it populate `episode_embeddings` directly — it already reuses each row's existing
vector for `pattern_embeddings`, so the same vector would serve. Then expose a supported path to store
an episode **with a critique, reward and success**, so there are real lessons to retrieve rather than
reward-0 shells. Without this, checks 6–8 can never go green and AgentDB's reflexion/skills/learning
subsystems stay shipped-but-starved.

---

## Bonus: a small gap in `#2448` itself

`checkStaleSettingsNpx()` caught a real problem on my machine today (**thank you** — it found the
cause of 72 orphaned `npx` daemons, PPID 1, some running >24h, all executing out of `~/.npm/_npx`).
But its regex requires the literal token `hooks`:

```js
const BROKEN_RE = /npx\s+(?:--?\S+\s+){0,10}@?claude-flow\/cli@latest\s+hooks\s+(?:statusline|\S+)/;
//                                                                     ^^^^^
```

so it misses sibling invocations in the same settings files, e.g.:

```jsonc
"Notification": "… && npx @claude-flow/cli@latest memory store --namespace notifications …"
"SessionStart": "npx @claude-flow/cli@latest daemon start --quiet …"   // ← spawns the orphans
```

Suggest broadening to any `npx …@claude-flow/cli@latest <subcommand>` rather than `hooks`
specifically — the process-storm cost is the same whichever subcommand is invoked.

---

## Reproduction (30 seconds)

```bash
cd <any project with an older .swarm/memory.db>
ruflo doctor --component memory     # -> "All checks passed! System is healthy."

sqlite3 .swarm/memory.db "PRAGMA integrity_check;"
sqlite3 .swarm/memory.db "SELECT count(*), sum(CASE WHEN length(trim(coalesce(content,'')))>0 THEN 1 END) FROM memory_entries;"
sqlite3 .swarm/memory.db "SELECT count(*) FROM episodes e JOIN episode_embeddings ee ON e.id=ee.episode_id;"  # 0 — always
```

## Why it matters

The promise of AgentDB is an agent that gets *smarter* — that remembers what failed, and why, and
doesn't repeat it. Today every store on this machine records thousands of episodes and can retrieve
**none** of them, while every health signal in the stack reports success. The system isn't so much
broken as **unmeasured** — and the measurement is the part that would have told anyone.

**Happy to open a PR** implementing checks 1–8 against the existing `HealthCheck` interface if that's
useful. The `#2448` check is the model; this just applies the same standard to memory.
