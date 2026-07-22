#!/usr/bin/env node
// learn-flush.mjs — SessionEnd. Reads this session's learning queue (the workflow you just performed)
// and feeds the distinct steps into the GLOBAL per-user SONA learner — ruflo hooks run with cwd=$HOME
// so learnings accumulate in ONE store (~/.claude-flow), shared across ALL your projects. Project FACTS
// never come here (the queue holds command verbs + file basenames, no content). Each installed RuvNet
// Brain does this for its own user → everyone's brain gets recursively smarter about how THEY work. ADR-0017.
//
// Non-blocking, best-effort. Bounded (distinct actions, short timeouts). `--sync` waits (for tests);
// the hook default backgrounds so SessionEnd never stalls.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const SID = process.env.CLAUDE_SESSION_ID || 'default';
const QUEUE = process.env.LEARN_QUEUE || path.join(HOME, '.cache/ruvnet-brain/learn', `session-${SID}.jsonl`);
const RUFLO = path.join(HOME, '.npm-global/bin/ruflo');
const MAX_ACTIONS = 8; // bound the work so SessionEnd stays fast

let lines = [];
try { lines = fs.readFileSync(QUEUE, 'utf8').split('\n').filter(Boolean); } catch { process.exit(0); }
if (!lines.length) process.exit(0);

// Distinct workflow actions this session (dedupe → a session has only a handful of real patterns).
//
// COLLECT ALL, FEED SOME, KEEP THE REST (fixed 2026-07-22). This used to `break` at MAX_ACTIONS and
// then delete the ENTIRE queue, so a session with 30 distinct actions fed 8 and destroyed 22 —
// permanently, silently, while reporting success. Measured on the owner's machine the same day: the
// queue stood at 491 raw captures, every one of which would have been discarded after feeding 8.
//
// The cap exists for a good reason (SessionEnd must stay fast) but a work LIMIT is not a licence to
// destroy the work you didn't do. Now the remainder is written back and drains on the next flush,
// so a deep queue converges instead of being truncated.
const allDistinct = [];
const seen = new Set();
for (const line of lines) {
  let s; try { s = JSON.parse(line); } catch { continue; }
  const key = `${s.tool}|${(s.action || '').slice(0, 60)}`;
  if (!s.action || seen.has(key)) continue;
  seen.add(key);
  allDistinct.push(s);
}
const actions = allDistinct.slice(0, MAX_ACTIONS);
const deferred = allDistinct.slice(MAX_ACTIONS);

let fed = 0;
for (const s of actions) {
  const args = s.tool === 'Bash'
    ? ['hooks', 'post-command', '-c', s.action, '-s', 'true']
    : ['hooks', 'post-edit', '-f', s.action, '-s', 'true', '-o', 'session edit'];
  try {
    // cwd: HOME → writes the GLOBAL per-user learner (cross-project), not a project-local one.
    execFileSync(RUFLO, args, { cwd: HOME, stdio: 'ignore', timeout: 6000 });
    fed++;
  } catch { /* best-effort — one slow/failed record must not stall session end */ }
}

// DERIVED, not asserted (F14, 2026-07-18): the queue is EVIDENCE, and it may only be destroyed when
// its contents were actually fed. The old line deleted it unconditionally — a session where every
// `ruflo hooks` call failed (fed=0) silently discarded the whole learning queue with nothing learned
// and no trace. Now: nothing fed + something to feed ⇒ the queue survives for the next session-end
// to retry. An empty queue (nothing to feed) is safe to remove.
if (fed > 0 || allDistinct.length === 0) {
  if (deferred.length) {
    // Work remains. Write back ONLY what was not fed, so the next flush continues where this one
    // stopped. Deleting here is what turned a rate limit into data loss.
    try {
      fs.writeFileSync(QUEUE, deferred.map((s) => JSON.stringify(s)).join('\n') + '\n');
    } catch { /* if we cannot rewrite it, leaving the full queue is strictly safer than removing it */ }
  } else {
    try { fs.rmSync(QUEUE); } catch { /* leave it if we can't remove */ }
  }
} else if (process.argv.includes('--sync')) {
  console.log(`learn-flush: 0/${actions.length} fed (ruflo hooks failing?) — queue KEPT for retry next session-end`);
}
if (process.argv.includes('--sync')) {
  console.log(`learn-flush: fed ${fed}/${actions.length} distinct actions to the global learner`
    + (deferred.length ? `; ${deferred.length} distinct action(s) deferred to the next flush (queue kept, nothing discarded)` : ''));
}
process.exit(0);
