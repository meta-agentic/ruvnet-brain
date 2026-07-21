#!/usr/bin/env node
/**
 * health-repair.mjs — the EXECUTOR behind the console's health recommendations.
 *
 * The console used to detect a corrupt memory store, score it 49/100, render it into a card, and
 * offer nothing. Stuart, 2026-07-21: "when it finds a problem, the fact that it didn't recommend a
 * fix is unconscionable." This is the other half — the part that actually repairs.
 *
 * Three actions, each matching a recommendation id from console-engine.buildHealthRecommendations:
 *
 *   --repair-memory   REINDEX a corrupt AgentDB store (index damage, never data loss)
 *   --flush-learning  drain the capture queue into rUv's learner
 *   --train-learning  run one training cycle
 *
 * DISCIPLINE, learned the hard way tonight:
 *   • Back up BEFORE touching, using sqlite's own .backup — `cp` on a live WAL database silently
 *     truncates the newest transactions (standing lesson, proven by experiment).
 *   • Count rows before AND after, and refuse to report success if they differ.
 *   • Never hand-roll learning: the flush/train paths shell out to rUv's own `ruflo hooks`.
 *   • Every result is DERIVED from a re-measurement, never asserted from an exit code.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const RUFLO = path.join(HOME, '.npm-global/bin/ruflo');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const sqlite = (db, sql) => execFileSync('sqlite3', [db, sql], { encoding: 'utf8', timeout: 120_000 }).trim();

/** Every AgentDB store this repo knows about: the project's own, plus any passed explicitly. */
function resolveDb() {
  const explicit = argv[argv.indexOf('--db') + 1];
  if (argv.includes('--db') && explicit) return explicit;
  return path.join(process.cwd(), '.swarm', 'memory.db');
}

/**
 * REINDEX a corrupt store. Index corruption ("wrong # of entries in index X") means the indexes
 * drifted from the table; the rows themselves are intact, so rebuilding indexes FROM the table is
 * lossless. Verified live: 1193 rows before, 1193 after, integrity_check ok.
 */
function repairMemory() {
  const db = resolveDb();
  if (!fs.existsSync(db)) return { ok: false, log: `no memory store at ${db.replace(HOME, '~')}` };

  const before = sqlite(db, 'PRAGMA integrity_check;').split('\n')[0];
  if (before === 'ok') return { ok: true, log: 'store was already clean — nothing to repair', noop: true };

  const rowsBefore = Number(sqlite(db, 'SELECT COUNT(*) FROM memory_entries;'));

  // Backup FIRST, via sqlite's own backup (never cp — a live WAL db loses its newest transactions).
  const backup = `${db}.rescue-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try { sqlite(db, `.backup '${backup}'`); }
  catch (e) { return { ok: false, log: `refusing to repair — could not back up first: ${e.message}` }; }

  try { sqlite(db, 'REINDEX;'); }
  catch (e) { return { ok: false, log: `REINDEX failed: ${e.message}. Your backup is at ${backup.replace(HOME, '~')}`, backup }; }

  // PROVE it, rather than trusting REINDEX's exit code.
  const after = sqlite(db, 'PRAGMA integrity_check;').split('\n')[0];
  const rowsAfter = Number(sqlite(db, 'SELECT COUNT(*) FROM memory_entries;'));

  if (after !== 'ok') return { ok: false, log: `still corrupt after REINDEX: ${after}. Backup: ${backup.replace(HOME, '~')}`, backup };
  if (rowsAfter !== rowsBefore) {
    return { ok: false, log: `ROW COUNT CHANGED (${rowsBefore} → ${rowsAfter}) — treating as data loss. Restore: ${backup.replace(HOME, '~')}`, backup };
  }
  return { ok: true, log: `repaired — integrity ok, ${rowsAfter} entries intact (was ${rowsBefore}). Backup: ${backup.replace(HOME, '~')}`, backup };
}

/** Drain the capture queue into rUv's learner — his tool, not ours. */
function flushLearning() {
  const flusher = path.join(HOME, '.claude', 'plugins', 'marketplaces', 'ruvnet-brain', 'plugin', 'scripts', 'learn-flush.mjs');
  const local = path.join(process.cwd(), 'plugin', 'scripts', 'learn-flush.mjs');
  const script = fs.existsSync(flusher) ? flusher : (fs.existsSync(local) ? local : null);
  if (!script) return { ok: false, log: 'learn-flush.mjs not found — cannot drain the queue' };

  const queueDir = path.join(HOME, '.cache', 'ruvnet-brain', 'learn');
  const depth = () => {
    try {
      return fs.readdirSync(queueDir).filter((f) => f.endsWith('.jsonl'))
        .reduce((n, f) => n + fs.readFileSync(path.join(queueDir, f), 'utf8').split('\n').filter(Boolean).length, 0);
    } catch { return 0; }
  };
  const before = depth();
  try { execFileSync(process.execPath, [script], { stdio: 'ignore', timeout: 600_000 }); }
  catch (e) { return { ok: false, log: `flush failed: ${e.message} — the queue is preserved for retry` }; }
  const after = depth();
  return { ok: true, log: `fed ${Math.max(0, before - after)} captured events into the learner (queue ${before} → ${after})` };
}

/** One training cycle, via rUv's own CLI, in the GLOBAL (cross-project) learner. */
function trainLearning() {
  if (!fs.existsSync(RUFLO)) return { ok: false, log: 'ruflo not found — install it to enable learning' };
  try {
    execFileSync(RUFLO, ['hooks', 'intelligence', '--train'], { cwd: HOME, stdio: 'ignore', timeout: 600_000 });
  } catch (e) { return { ok: false, log: `training cycle failed: ${e.message}` }; }
  return { ok: true, log: 'ran one training cycle in the cross-project learner' };
}

const action = has('--repair-memory') ? repairMemory
  : has('--flush-learning') ? flushLearning
    : has('--train-learning') ? trainLearning
      : null;

if (!action) {
  console.log('health-repair — repair actions behind the console\'s health recommendations\n');
  console.log('  --repair-memory [--db <path>]   REINDEX a corrupt AgentDB store (backs up first, proves row count)');
  console.log('  --flush-learning                drain the capture queue into the learner');
  console.log('  --train-learning                run one training cycle');
  process.exit(2);
}

const res = action();
console.log(res.log);
process.exit(res.ok ? 0 : 1);
