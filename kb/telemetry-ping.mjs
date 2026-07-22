#!/usr/bin/env node
// telemetry-ping.mjs — OPT-IN, count-only, daily-batched usage pings for RuvNet Brain.
//
// THE PRIVACY CONTRACT (everything transmitted is visible in this one file):
//   • OPT-IN ONLY. Nothing is ever sent unless ~/.cache/ruvnet-brain/.telemetry-consent contains
//     the literal word "yes" — written only by the installer's explicit consent prompt. No file,
//     "no", or anything else → this module is a pure no-op.
//   • COUNTS ONLY. The payload is { event, v, n }: an event NAME (search|session), the installed
//     bundle version, and a count. Query text, repo names, file paths, code, usernames, machine
//     IDs — none of it is ever read by this module, let alone transmitted.
//   • DAILY-BATCHED. At most ONE flush per machine per day: events accumulate in a local queue
//     file and go out on the first event of a new day. No streaming, no per-query network I/O.
//   • NEVER BLOCKS, NEVER BREAKS. The flush is fire-and-forget (no await in the query path),
//     every fs/network error is swallowed, and RUVNET_BRAIN_TEST=1 or RUVNET_BRAIN_TELEMETRY=0
//     hard-disables everything. A telemetry failure must never cost a query a millisecond.
//
// State files (all under ~/.cache/ruvnet-brain — the same state dir the plugin hooks use):
//   .telemetry-consent     "yes"/"no" — the user's answer at install time
//   .telemetry-queue.json  { day, lastSent, counts: { search, session } }

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Honors RUVNET_BRAIN_PING_URL, matching the convention bin/install.mjs:1825 already uses. The
// default is unchanged, so this is a no-op for every existing install — it exists so the endpoint
// can be repointed by configuration instead of by shipping a new bundle.
//
// Why that mattered enough to change (2026-07-22): the hardcoded default was found DEAD. DNS for
// ruvnet-brain.vercel.app resolves to Vercel IPs, but the hostname is attached to no project in the
// account (absent from both `vercel alias ls` and `vercel domains ls`) and refuses TCP on 443, while
// the very same app answers 405 on `isovision.ai/ruvnet-brain/api/ping` and on its direct deployment
// URL. Every ping this module sent was therefore discarded at the last hop — invisibly, because
// sendPing swallows all network errors by design (a lost count must never break a user's session).
// A single hardcoded const with no override made that a code-and-release fix instead of a config one.
export const PING_URL = process.env.RUVNET_BRAIN_PING_URL || 'https://ruvnet-brain.vercel.app/api/ping';

export function defaultStateDir() {
  return path.join(os.homedir(), '.cache', 'ruvnet-brain');
}

// The single gate. Consent must be an explicit "yes" on disk; test mode and the kill-switch win.
export function telemetryEnabled({ stateDir = defaultStateDir(), env = process.env } = {}) {
  try {
    if (env.RUVNET_BRAIN_TEST === '1') return false;
    if (env.RUVNET_BRAIN_TELEMETRY === '0') return false;
    const consent = fs.readFileSync(path.join(stateDir, '.telemetry-consent'), 'utf8').trim().toLowerCase();
    return consent === 'yes';
  } catch {
    return false; // no consent file = never opted in = silence
  }
}

// Best-effort read of the installed bundle version (SOURCE.json releaseTag) — a label, never an ID.
export function bundleVersion(kbDir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(kbDir, 'SOURCE.json'), 'utf8'));
    const v = String(j.releaseTag || j.version || 'unknown');
    return /^[A-Za-z0-9._-]{1,32}$/.test(v) ? v : 'unknown';
  } catch {
    return 'unknown';
  }
}

function readQueue(stateDir) {
  try {
    const q = JSON.parse(fs.readFileSync(path.join(stateDir, '.telemetry-queue.json'), 'utf8'));
    if (q && typeof q === 'object' && q.counts && typeof q.counts === 'object') return q;
  } catch { /* fresh queue below */ }
  return { day: null, lastSent: null, counts: { search: 0, session: 0 } };
}

function writeQueue(stateDir, q) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, '.telemetry-queue.json'), JSON.stringify(q));
  } catch { /* losing a count is fine; breaking a query is not */ }
}

// Record one event ("search" | "session"). Increments the local queue; if nothing has been sent
// yet today, flushes the accumulated counts (fire-and-forget) and marks today as sent.
// Returns what it did — { enabled, flushed, sent } — so tests can assert without a network.
export function recordEvent(event, {
  stateDir = defaultStateDir(),
  env = process.env,
  version = 'unknown',
  now = new Date(),
  fetchFn = globalThis.fetch,
  pingUrl = env.RUVNET_BRAIN_PING_URL || PING_URL,
} = {}) {
  try {
    if (event !== 'search' && event !== 'session') return { enabled: false, flushed: false, sent: [] };
    if (!telemetryEnabled({ stateDir, env })) return { enabled: false, flushed: false, sent: [] };

    const today = now.toISOString().slice(0, 10);
    const q = readQueue(stateDir);
    q.day = today;
    q.counts[event] = (q.counts[event] || 0) + 1;

    let sent = [];
    const flushed = q.lastSent !== today;
    if (flushed) {
      // One flush per day: send everything accumulated (including this event), then zero out.
      sent = ['search', 'session']
        .filter((e) => (q.counts[e] || 0) > 0)
        .map((e) => ({ event: e, v: version, n: q.counts[e] }));
      for (const p of sent) {
        try {
          // Fire-and-forget: not awaited, all failures swallowed. keepalive-free plain POST.
          Promise.resolve(fetchFn(pingUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          })).catch(() => {});
        } catch { /* even a synchronous fetch throw must not surface */ }
      }
      q.lastSent = today;
      q.counts = { search: 0, session: 0 };
    }
    writeQueue(stateDir, q);
    return { enabled: true, flushed, sent };
  } catch {
    return { enabled: false, flushed: false, sent: [] }; // absolute backstop
  }
}

// Local-only stamp (no network, no consent needed — it never leaves the machine): records that
// the brain has successfully grounded at least once. session-start.sh uses it to time the
// once-ever "star us / leave feedback" line so it only appears after the brain proved useful.
export function stampGroundedOnce(stateDir = defaultStateDir()) {
  try {
    const p = path.join(stateDir, '.grounded-once');
    if (fs.existsSync(p)) return false;
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(p, new Date().toISOString() + '\n');
    return true;
  } catch {
    return false;
  }
}
