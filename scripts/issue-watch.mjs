#!/usr/bin/env node
// scripts/issue-watch.mjs — GitHub-issues SLA watcher.
//
// Stuart's mandate: no open issue on stuinfla/ruvnet-brain may sit >4h without a response, or an
// ntfy alert must reach his phone. "Response" = a comment from the repo owner (stuinfla) — a
// contributor's comment (see issue #12, commented by @sparkling) does NOT satisfy the SLA.
//
// Follows the house positive-confirmation pattern established 2026-07-13 (scripts/job-heartbeat.sh,
// scripts/nightly-watchdog.mjs, config/scheduled-jobs.json): this script is meant to run WRAPPED by
// job-heartbeat.sh from a launchd plist, so a crash still leaves a receipt and a failed run still
// pages the phone via the wrapper's own "SCHEDULED JOB FAILED" alert. This script's own exit code is
// therefore reserved for real execution failures (gh unreachable, bad JSON) — finding an SLA breach
// is the job working correctly, not a failure, so it always exits 0 on a clean run.
//
// Dedup: alerts for a given issue repeat at most once per SLA window (4h), tracked in a small state
// file, so a still-breaching issue doesn't re-page every hourly run.
//
// Usage:
//   node scripts/issue-watch.mjs             # check + alert on breaches
//   node scripts/issue-watch.mjs --dry-run   # check + print what WOULD be sent; no ntfy push, no state write

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'stuinfla/ruvnet-brain';
const OWNER_LOGIN = 'stuinfla';
const SLA_HOURS = 4;
const STATE_PATH = process.env.ISSUE_WATCH_STATE
  || path.join(os.homedir(), '.claude', 'ruvnet-brain', 'issue-watch-state.json');
// A compact, always-current snapshot the SessionStart hook surfaces (2026-07-17). ntfy alerts are
// easy to miss — issues stacked unseen for 29h precisely because the only channel was the phone.
// The session banner is a channel the maintainer cannot miss; this file is how it learns the count.
const STATUS_PATH = path.join(os.homedir(), '.cache', 'ruvnet-brain', 'open-issues.json');
const GH_BIN = process.env.GH_BIN || 'gh';

function ghJson(args) {
  // Retry ONCE on a transient network-shaped failure (2026-07-19, same class as issue-fix's 1am
  // "TLS handshake timeout" page): 20s of patience absorbs a blip; a second failure still fails
  // LOUD. Bounded, logged, never silent.
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = spawnSync(GH_BIN, args, { encoding: 'utf8' });
    if (res.status === 0) return JSON.parse(res.stdout);
    const err = (res.stderr || res.stdout || '').trim();
    lastErr = new Error(`gh ${args.join(' ')} failed (exit ${res.status}): ${err}`);
    const transient = /TLS handshake|unexpected EOF|timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|connection refused|temporarily unavailable/i.test(err);
    if (attempt === 1 && transient) {
      console.error(`issue-watch: transient gh/network failure (${err.slice(0, 90)}) — retrying once in 20s`);
      spawnSync('sleep', ['20']);
      continue;
    }
    break;
  }
  throw lastErr;
}

/** Resolve the ntfy topic the same way the rest of the repo does: env, then the machine-wide
 * cache file, then the repo .env — see scripts/notify.sh / scripts/job-heartbeat.sh / scripts/nightly-watchdog.mjs. */
function resolveTopic() {
  if (process.env.NTFY_TOPIC) return process.env.NTFY_TOPIC;
  try {
    const t = fs.readFileSync(path.join(os.homedir(), '.cache', 'ruvnet-brain', 'ntfy-topic'), 'utf8').trim();
    if (t) return t;
  } catch { /* fall through */ }
  try {
    const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const m = env.match(/^NTFY_TOPIC=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  return null;
}

async function pushNtfy(topic, { title, body, priority = 'urgent', tags = 'rotating_light' }) {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: title, Priority: priority, Tags: tags },
      body,
    });
    return res.ok;
  } catch {
    return false; // alerting must never break the job — fail-silent, matching scripts/notify.sh
  }
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function fmtAge(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/** Judge one issue. Comments are re-fetched per-issue via `gh issue view` (not trusted from the
 * list call) so owner-comment presence is computed off the authoritative per-issue payload. */
export function judgeIssue(issue, comments, now) {
  const ageHours = (now - new Date(issue.createdAt).getTime()) / 3_600_000;
  const ownerComment = comments.find((c) => c.author?.login === OWNER_LOGIN);
  const breach = ageHours > SLA_HOURS && !ownerComment;
  return { ageHours, ownerComment: !!ownerComment, breach };
}

export async function run({ dryRun = false, now = Date.now(), repo = REPO } = {}) {
  const issues = ghJson(['issue', 'list', '--repo', repo, '--state', 'open', '--json',
    'number,title,createdAt,comments,updatedAt']);

  const state = loadState();
  const results = [];
  const alertsSent = [];

  for (const issue of issues) {
    const detail = ghJson(['issue', 'view', String(issue.number), '--repo', repo, '--json', 'comments']);
    const { ageHours, ownerComment, breach } = judgeIssue(issue, detail.comments || [], now);
    const url = `https://github.com/${repo}/issues/${issue.number}`;
    const key = String(issue.number);
    const last = state[key]?.lastAlertAt ? Date.parse(state[key].lastAlertAt) : null;
    const dueForAlert = breach && (!last || (now - last) / 3_600_000 >= SLA_HOURS);

    results.push({ number: issue.number, title: issue.title, ageHours, ownerComment, breach, dueForAlert, url });

    if (dueForAlert) {
      const title = `SLA breach: issue #${issue.number}`;
      const body = `${issue.title}\nopen ${fmtAge(ageHours)}, no response from ${OWNER_LOGIN}\n${url}`;
      if (dryRun) {
        alertsSent.push({ number: issue.number, sent: false, reason: 'dry-run' });
      } else {
        const topic = resolveTopic();
        let sent = false;
        if (topic) sent = await pushNtfy(topic, { title, body, priority: 'urgent', tags: 'rotating_light,warning' });
        // DERIVED, not asserted (F5, 2026-07-18): lastAlertAt may only be written when the page was
        // actually DELIVERED (sent===true). The old line stamped it unconditionally, so a breach whose
        // push failed (ntfy down, no topic) was suppressed for the whole 4h cooldown — the alert ledger
        // asserted a delivery it never verified. A failed attempt records itself as failed and the next
        // hourly run retries; the ledger can no longer claim a page that didn't happen.
        if (sent) state[key] = { lastAlertAt: new Date(now).toISOString(), title: issue.title, url };
        else state[key] = { ...(state[key] || {}), lastAttemptAt: new Date(now).toISOString(), sent: false, title: issue.title, url };
        alertsSent.push({ number: issue.number, sent, reason: topic ? null : 'no ntfy topic configured' });
      }
    }
  }

  if (!dryRun) saveState(state);

  return { results, alertsSent, checkedAt: new Date(now).toISOString() };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const asJson = process.argv.includes('--json');

  let output;
  try {
    output = await run({ dryRun });
  } catch (err) {
    console.error(`issue-watch: FAILED — ${err.message}`);
    process.exit(1);
  }

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`GitHub issue SLA watch — ${REPO} (SLA: ${SLA_HOURS}h to first owner (@${OWNER_LOGIN}) response)${dryRun ? '  [DRY-RUN]' : ''}\n`);
    for (const r of output.results) {
      const icon = r.breach ? '\u{1F534}' : '✅';
      console.log(`${icon} #${r.number}  ${r.title}`);
      console.log(`   age: ${fmtAge(r.ageHours)} · owner comment: ${r.ownerComment ? 'yes' : 'no'} · breach: ${r.breach ? 'YES' : 'no'}`);
      if (r.dueForAlert) {
        const alert = output.alertsSent.find((a) => a.number === r.number);
        console.log(`   ${dryRun ? '[DRY-RUN] would push ntfy alert' : alert?.sent ? 'ntfy alert pushed' : `ntfy alert NOT sent (${alert?.reason})`}`);
      } else if (r.breach) {
        console.log(`   already alerted within the last ${SLA_HOURS}h — not repeating`);
      }
      console.log('');
    }
    const breaches = output.results.filter((r) => r.breach).length;
    console.log(breaches
      ? `${breaches} of ${output.results.length} open issue(s) are in SLA breach.`
      : `All ${output.results.length} open issue(s) are within the ${SLA_HOURS}h SLA.`);
    if (dryRun) console.log('(dry-run: no ntfy pushed, no state file written)');
  }

  // Write the snapshot the SessionStart hook reads. Best-effort — a status-file failure must never
  // fail the watcher (whose real job, alerting, already succeeded above).
  if (!dryRun) {
    try {
      const issues = output.results.map((r) => ({
        number: r.number, title: r.title, ageHours: Math.round(r.ageHours),
        breach: !!r.breach, url: `https://github.com/${REPO}/issues/${r.number}`,
      }));
      fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
      fs.writeFileSync(STATUS_PATH, JSON.stringify({
        at: new Date().toISOString(), repo: REPO,
        open: issues.length, breaches: issues.filter((i) => i.breach).length, issues,
      }, null, 2));
    } catch { /* status file is best-effort; never break the watcher */ }
  }

  // Finding a breach is the watcher doing its job — exit 0. But a due alert that FAILED TO DELIVER
  // is an execution failure (Sol amendment to F5, 2026-07-18): this watcher's one real job is the
  // page, and if the page didn't go out, "ok" would be asserted, not derived. Exit 1 so the
  // heartbeat records the failure and the wrapper's own channel escalates — that duplicate-looking
  // page IS the correct behavior when the primary page provably never left the building.
  const undeliveredAlert = !dryRun && (output.alertsSent || []).some((a) => !a.sent && a.reason !== 'dry-run');
  process.exit(undeliveredAlert ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
