#!/usr/bin/env node
// reflexion.mjs — lessons in, lessons out, through AgentDB's REAL learning machinery.
//
// WHY (2026-07-14): 84 memory stores on this machine held 7,396 "episodes" — and ZERO critiques,
// ZERO episode embeddings, ZERO promoted skills. AgentDB's ReflexionMemory (the Reflexion-paper
// implementation: store what happened WITH what failed and why, retrieve it before trying again)
// was instantiated everywhere and fed nowhere: `memory distill` raw-INSERTs reward-0 shells that
// bypass storeEpisode(), and the retrieval INNER-JOINs episode_embeddings — an empty table — so
// getCritiqueSummary() answered "No prior failures found" on every project, forever.
//
// DISCLOSED, NOT HAND-ROLLED: the ruflo CLI exposes NO episode/critique command (read from the
// 3.30.2 binary, not docs). This wrapper therefore calls the REAL controller —
// agentdb/dist/src/controllers/ReflexionMemory.ts via the AgentDB class — against the project's
// own .swarm/memory.db. Nothing is imitated; if upstream ships a CLI for this (#2677 part B),
// this file retires.
//
// SAFETY: opens the live db with native better-sqlite3 + WAL (multi-process safe — proven by
// experiment today, unlike three disproven corruption theories). Same embedding model ruflo uses
// (Xenova/all-MiniLM-L6-v2, 384-dim), so vectors are compatible with everything else in the store.
//
// USAGE (cwd = the project, or --db <path>):
//   node reflexion.mjs store --task "..." --critique "what failed + the rule" \
//        [--output "..."] [--reward 0..1] [--success true|false] [--tags a,b]
//   node reflexion.mjs recall --task "..." [--k 5]        # similar past episodes
//   node reflexion.mjs lessons --task "..."               # getCritiqueSummary: prior failures
//   node reflexion.mjs stats  --task "..."                # am I getting better? (improvementTrend)

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';

const require_ = createRequire(path.join(os.homedir(), '.npm-global/lib/node_modules/@claude-flow/memory/package.json'));

function arg(name, dflt = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
}
const cmd = process.argv[2];
const dbPath = path.resolve(arg('db', path.join(process.cwd(), '.swarm/memory.db')));
if (!fs.existsSync(dbPath)) { console.error(`no memory store at ${dbPath}`); process.exit(1); }

// Silence the embedder/backend chatter; keep OUR output clean. (The suppressed upstream line
// "[AgentDB] Initialized with better-sqlite3" is exactly how the engine truth was hidden all day —
// so we print the engine ourselves, honestly, at the end.)
const origLog = console.log;
console.log = (...a) => { if (!/Transformers\.js|\[AgentDB\]|RuVector backend/.test(String(a[0] ?? ''))) origLog(...a); };

// CROSS-PROCESS CORRECTNESS (found by this file's own first test, 2026-07-14): the AgentDB class
// wires ReflexionMemory to a RuVector backend whose in-memory index starts EMPTY in every new
// process and is never rehydrated from the episode_embeddings rows it dual-wrote. Result: the
// storing process can retrieve, every later process gets zero rows — "No

const sessionId = process.env.CLAUDE_SESSION_ID || `session-${new Date().toISOString().slice(0, 10)}`;

if (cmd === 'store') {
  const task = arg('task'); const critique = arg('critique');
  if (!task || !critique) { console.error('store requires --task and --critique (a lesson without a critique is a diary entry)'); process.exit(1); }
  const id = await reflexion.storeEpisode({
    sessionId,
    task,
    output: arg('output', ''),
    critique,
    reward: parseFloat(arg('reward', '0.5')),
    success: arg('success', 'true') === 'true',
    tags: (arg('tags', 'lesson') || '').split(',').filter(Boolean),
  });
  console.log(`stored episode ${id} (with embedding — retrievable)`);
} else if (cmd === 'recall') {
  const eps = await reflexion.retrieveRelevant({ task: arg('task', ''), k: parseInt(arg('k', '5'), 10) });
  if (!eps.length) console.log('no relevant episodes');
  for (const e of eps) console.log(`- [${(e.similarity ?? 0).toFixed(2)}] ${e.task.slice(0, 90)}\n    critique: ${(e.critique || '(none)').slice(0, 140)}`);
} else if (cmd === 'lessons') {
  console.log(await reflexion.getCritiqueSummary({ task: arg('task', ''), k: 3 }));
} else if (cmd === 'stats') {
  const s = reflexion.getTaskStats(arg('task', ''));
  console.log(`attempts=${s.totalAttempts} successRate=${(s.successRate * 100).toFixed(0)}% avgReward=${s.avgReward.toFixed(2)} improvementTrend=${(s.improvementTrend * 100).toFixed(1)}%`);
} else {
  console.error('commands: store | recall | lessons | stats');
  process.exit(1);
}
await db.close();
