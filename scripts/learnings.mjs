#!/usr/bin/env node
// scripts/learnings.mjs — reads the per-user GLOBAL learner state for the console's "What I've learned"
// panel. This is the showable, delightful face of the recursive learning loop (ADR-0017): honest counts
// from ~/.claude-flow/neural/stats.json + the workflow actions recently observed by learn-capture. It is
// read-only. Learnings = how YOU work (shared across all your projects); project facts stay isolated.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();

/** @param {{statsPath?:string, queueDir?:string, now?:number}} [opts] */
export function learnings({ statsPath, queueDir, now = Date.now() } = {}) {
  const sp = statsPath || path.join(HOME, '.claude-flow/neural/stats.json');
  const qd = queueDir || path.join(HOME, '.cache/ruvnet-brain/learn');

  let stats = {};
  try { stats = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch { /* no learner yet */ }
  const trajectories = Number(stats.trajectoriesRecorded) || 0;
  const patterns = Number(stats.patternsLearned) || 0;
  const lastMs = Number(stats.lastAdaptation) || 0;
  const daysSince = lastMs ? Math.floor((now - lastMs) / 86400000) : null;

  // Recently observed workflow actions (what it's currently learning from) — the learn-capture queues.
  const recentWorkflow = [];
  const seen = new Set();
  try {
    const files = fs.readdirSync(qd)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({ f, m: fs.statSync(path.join(qd, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m)
      .slice(0, 5);
    for (const { f } of files) {
      for (const line of fs.readFileSync(path.join(qd, f), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let s; try { s = JSON.parse(line); } catch { continue; }
        const a = String(s.action || '').trim();
        if (!a || seen.has(a)) continue;
        seen.add(a);
        recentWorkflow.push(a);
        if (recentWorkflow.length >= 12) break;
      }
      if (recentWorkflow.length >= 12) break;
    }
  } catch { /* no queue yet */ }

  return {
    active: trajectories > 0 || patterns > 0,
    trajectories,
    patterns,
    lastAdaptation: lastMs ? new Date(lastMs).toISOString() : null,
    daysSinceLastAdaptation: daysSince,
    recentWorkflow,
    note: 'Learnings are how you work — shared across all your projects and getting smarter over time. Project facts stay isolated per project; nothing here is project data.',
  };
}

export function printLearnings(l) { console.log(JSON.stringify(l, null, 2)); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) printLearnings(learnings());
