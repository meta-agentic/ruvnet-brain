#!/usr/bin/env node
/**
 * detach.mjs — launch one long-running maintenance job OUT of the hook's process group, with an
 * explicit lifetime and a written receipt.
 *
 * ── THE DEFECT THIS EXISTS TO CLOSE (measured, not reasoned) ────────────────────────────────────
 * `scripts/selfcheck.mjs` fires every registration with the child in its OWN process group and then
 * asks, at exit and again after SIGTERM, whether ANYTHING in that group is still alive
 * (`kill(-pgid, 0)`). session-start.sh backgrounded three jobs with a bare `&`. A bare `&` in a
 * non-interactive `sh` does NOT change the process group — the job stays a member of the hook's
 * group — so the answer was "yes, descendants alive": the `orphan` violation the stranger-matrix
 * reported on all five images. The failure is real and not cosmetic: on a stranger's machine those
 * are `node` and `claude` processes still running after Claude Code has moved on, invisible to the
 * user and multiplied by every session start.
 *
 * ── WHY THE JOBS ARE NOT SIMPLY KILLED AT EXIT ─────────────────────────────────────────────────
 * "Kill the group on the way out" is the obvious fix and it is wrong for this workload. The three
 * jobs are a spine seed, a signed-bundle freshness check, and a plugin auto-update; each is seconds
 * to minutes of work, and session-start.sh exits in ~200ms. Killing them on exit would mean the
 * update NEVER completes on any machine — trading a hygiene violation for a permanently broken
 * updater. So the honest answer is the third one ADR-023 already implies: these jobs do not belong
 * to the session's lifetime at all. They are machine maintenance, like a package manager's
 * background install, and they are moved out of the session's process group ON PURPOSE.
 *
 * "On purpose" has to be worth something, so it comes with two obligations this file discharges:
 *
 *   1. AN EXPLICIT LIFETIME. Every job carries a TTL in seconds. A supervisor — itself detached —
 *      holds a timer and SIGTERMs the job's whole group at the deadline (SIGKILL 3s later). A
 *      detached job with no deadline is exactly the invisible-forever process this file is fixing;
 *      moving it to a new process group without a clock would only hide it better.
 *   2. A RECEIPT. Every start, exit and TTL-kill appends one line to
 *      ~/.cache/ruvnet-brain/detached-jobs.jsonl. "Invisible and unkillable-by-the-user" was half
 *      the complaint; a user who wants to know what is running, or wants to kill it, has a pid and
 *      a command to look at rather than a mystery in `ps`.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────────────────────────
 *   node detach.mjs <ttlSeconds> <logPath|-> <cmd> [args...]
 * Returns in ~40ms having spawned nothing the caller must wait for. Exit code is always 0: a
 * maintenance job that cannot be launched must never fail a session start.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const SUPERVISOR = process.env.RUVNET_DETACH_SUPERVISOR === '1';
const GRACE_MS = 3000; // SIGTERM → this long → SIGKILL. Matches selfcheck's own watchdog shape.

const [ttlRaw, logPath, ...cmd] = process.argv.slice(2);
const ttlSec = Number(ttlRaw);
if (!cmd.length || !Number.isFinite(ttlSec) || ttlSec <= 0) {
  process.stderr.write('usage: detach.mjs <ttlSeconds> <logPath|-> <cmd> [args...]\n');
  process.exit(0); // never fail a hook over a bad maintenance invocation
}

const receiptPath = () => path.join(
  process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'ruvnet-brain', 'detached-jobs.jsonl',
);

/** Best-effort, fail-silent. A receipt that throws would defeat the point of writing one. */
function receipt(row) {
  try {
    const p = receiptPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, `${JSON.stringify({ ts: new Date().toISOString(), ...row })}\n`);
  } catch { /* a maintenance job must not die because its log directory is read-only */ }
}

/** Open the job's log, or /dev/null. Never throws — an unwritable log is not a reason to skip work. */
function openLog() {
  if (!logPath || logPath === '-') return 'ignore';
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    return fs.openSync(logPath, 'w');
  } catch { return 'ignore'; }
}

if (!SUPERVISOR) {
  // ── FOREGROUND HALF. Re-exec self, detached, and return immediately. This process IS still in the
  // hook's process group, which is correct and is the whole trick: it is short-lived and finishes
  // before the hook does, so the group is empty at exit. Everything with a real duration is on the
  // far side of the setsid boundary below.
  try {
    const child = spawn(process.execPath, [SELF, ...process.argv.slice(2)], {
      detached: true, // POSIX setsid() — the child leads its OWN process group, not the session's
      stdio: 'ignore',
      // On Windows, detached:true allocates a separate console unless this is set. That console
      // kept the hook's inherited process handles alive after session-start.sh itself had finished
      // (~0.9s body, 7.1s watchdog verdict on run 30423673957). A hidden independent console plus
      // ignored stdio is the documented no-handle-inheritance launch shape.
      windowsHide: true,
      env: { ...process.env, RUVNET_DETACH_SUPERVISOR: '1' },
    });
    child.on('error', () => {});
    child.unref();
  } catch { /* nothing to report — the session must start regardless */ }
  process.exit(0);
}

// ── SUPERVISOR HALF (already outside the session's process group). Runs the real job, holds the
// clock, and is the only thing that can end it early.
const out = openLog();
const job = spawn(cmd[0], cmd.slice(1), {
  detached: true, // its own group again, so the TTL kill reaches ITS children too (npm, git, node)
  stdio: ['ignore', out, out],
  windowsHide: true,
  env: process.env,
});

let killedAtTtl = false;
receipt({ state: 'started', pid: job.pid ?? null, ttlSec, cmd });

const deadline = setTimeout(() => {
  killedAtTtl = true;
  try { process.kill(-job.pid, 'SIGTERM'); } catch { /* already gone */ }
  setTimeout(() => {
    try { process.kill(-job.pid, 'SIGKILL'); } catch { /* already gone */ }
    receipt({ state: 'killed-at-ttl', pid: job.pid ?? null, ttlSec, cmd });
    process.exit(0);
  }, GRACE_MS).unref();
}, ttlSec * 1000);

job.on('error', (e) => {
  clearTimeout(deadline);
  receipt({ state: 'spawn-failed', pid: null, ttlSec, cmd, detail: e.message });
  process.exit(0);
});
job.on('exit', (code, signal) => {
  clearTimeout(deadline);
  if (killedAtTtl) return; // the TTL path writes its own, more specific receipt
  receipt({ state: 'exited', pid: job.pid ?? null, code, signal, cmd });
  process.exit(0);
});
