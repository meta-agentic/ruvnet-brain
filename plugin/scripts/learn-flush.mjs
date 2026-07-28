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
import { readStdinBounded } from './hook-input.mjs';

const HOME = os.homedir();

// THE SESSION ID COMES OFF THE PAYLOAD, exactly as it does in learn-capture.sh (fixed 2026-07-27).
//
// This used to be `process.env.CLAUDE_SESSION_ID || 'default'`. Claude Code does not set that
// variable, so every session on the machine read and rewrote ONE shared session-default.jsonl —
// measured live at 147 lines, appended by several concurrent sessions. Both halves of this pipeline
// have to agree about which file they mean, so both now read `session_id` from the payload the hook
// is already handed, sanitise it the same way, and fall back the same way.
//
// The read is bounded: SessionEnd hands us a small JSON object and closes, but an unbounded
// readFileSync(0) on a stdin that never closes is a hang with no upper bound. A payload we cannot
// read in time simply yields no id, which lands on the same fallback as no payload at all.
async function payloadSessionId() {
  if (process.stdin.isTTY) return '';
  try {
    const raw = (await readStdinBounded()).toString('utf8');
    const v = JSON.parse(raw)?.session_id;
    return typeof v === 'string' ? v : '';
  } catch { return ''; }
}
// A filename COMPONENT, never a path — the payload is untrusted input.
const SID = ((await payloadSessionId()) || process.env.CLAUDE_SESSION_ID || '').replace(/[^A-Za-z0-9_-]/g, '') || 'default';
const QUEUE = process.env.LEARN_QUEUE || path.join(HOME, '.cache/ruvnet-brain/learn', `session-${SID}.jsonl`);
const RUFLO = path.join(HOME, '.npm-global/bin/ruflo');
const MAX_ACTIONS = 8; // bound the work so SessionEnd stays fast

// THE DEADLINE. SessionEnd's registered timeout is 30s (plugin/hooks/hooks.json) and this hook fires
// on EVERY session end — including every `/clear`. Measured on the owner's machine 2026-07-27, in all
// four stdin regimes: 48–50s wall, killed at the cap every single time.
//
// The arithmetic was never survivable. MAX_ACTIONS is 8 and a real `ruflo hooks` call measured 3.83s,
// so the feed queued ~31s of work into a 30s budget and was killed part-way through it. Worse, the
// kill lands BEFORE the write-back that preserves the remainder, so the queue never shrinks and never
// drains — a cap that guarantees the work it defers can never be done.
//
// A work limit has to be expressed in the currency the budget is denominated in. MAX_ACTIONS bounds
// COUNT; this bounds TIME, and the two together mean the hook stops cleanly, keeps what it did not
// feed, and exits well inside the cap. 20s leaves a full third of the budget for the write-back, the
// process teardown, and a slow machine. Measured with a 4s-per-call stub and a 147-entry queue: 22.5s
// wall at a 20s deadline (execFileSync's own kill handling costs a couple of seconds on top of the
// budget), so the number is set at 18s to keep the real worst case around 20s — a third of the cap in
// hand. The budget is the thing being bounded; the constant is chosen from the measurement, not from
// how round it looks.
const DEADLINE_MS = Number(process.env.LEARN_FLUSH_DEADLINE_MS) || 18_000;
const DEADLINE = Date.now() + DEADLINE_MS;

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
let stoppedAt = actions.length;   // how far the feed actually got before the deadline
for (let i = 0; i < actions.length; i++) {
  const remaining = DEADLINE - Date.now();
  // STOP CLEANLY, and stop BEFORE starting work that cannot finish inside the budget. A call begun
  // at 19.9s with a 6s timeout would run to 25.9s, which is the whole failure in miniature — the
  // budget has to bound the call, not just the decision to make it.
  if (remaining <= 0) { stoppedAt = i; break; }
  const s = actions[i];
  const args = s.tool === 'Bash'
    ? ['hooks', 'post-command', '-c', s.action, '-s', 'true']
    : ['hooks', 'post-edit', '-f', s.action, '-s', 'true', '-o', 'session edit'];
  try {
    // cwd: HOME → writes the GLOBAL per-user learner (cross-project), not a project-local one.
    execFileSync(RUFLO, args, { cwd: HOME, stdio: 'ignore', timeout: Math.min(6000, remaining) });
    fed++;
  } catch { /* best-effort — one slow/failed record must not stall session end */ }
}
// Whatever the deadline cut off is WORK, not waste: it goes back on the front of the queue so the
// next flush continues from there. Dropping it would turn a time limit into the same silent data
// loss the count limit used to cause.
if (stoppedAt < actions.length) deferred.unshift(...actions.slice(stoppedAt));

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
    // Say the deadline out loud when it fires. A budget that silently truncates reads as "that was
    // all there was", which is the same lie as the count cap that preceded it.
    + (stoppedAt < actions.length ? `; STOPPED at ${stoppedAt}/${actions.length} on the ${DEADLINE_MS}ms deadline` : '')
    + (deferred.length ? `; ${deferred.length} distinct action(s) deferred to the next flush (queue kept, nothing discarded)` : ''));
}
process.exit(0);
