#!/usr/bin/env node
// scripts/issue-fix.mjs — GitHub-issues AUTO-FIXER.
//
// Stuart's mandate: "look for any open issues and fix as soon as they hit." scripts/issue-watch.mjs
// already DETECTS and ALERTS on SLA breaches (>4h no owner response). This script is the FIX path:
// on every new open issue, it spawns ONE bounded headless `claude -p` child in a disposable git
// WORKTREE, has it verify the claim against real repo code, and either (a) implement + gate + push a
// review branch + comment, or (b) post an honest triage comment. It NEVER touches the shared live
// tree, NEVER pushes to main, and NEVER closes an issue — a human always reviews and merges.
//
// House patterns followed (read before touching this file):
//   - State file: scripts/issue-watch.mjs's ~/.claude/ruvnet-brain/issue-watch-state.json, EXTENDED
//     with a namespaced sub-key ("__issueFix") so this script's records can never collide with the
//     watcher's per-issue keys (which are bare issue numbers) — one shared file, two disjoint
//     namespaces, neither script can corrupt the other's state.
//   - ntfy: same resolveTopic()/pushNtfy() shape as issue-watch.mjs (env -> ~/.cache/ruvnet-brain/
//     ntfy-topic -> repo .env; fail-silent — alerting must never break the job).
//   - Positive confirmation: meant to run WRAPPED by scripts/job-heartbeat.sh from a launchd plist
//     (see deploy/com.ruvnet.issue-fix.plist), registered in config/scheduled-jobs.json, so a crash
//     still leaves a receipt and the nightly-watchdog can see it.
//   - Claude Code headless-adapter contract (docs/research/metaharness/ruv-gist-meta-wrapper.md
//     §"Claude Code"): one process per job in the job's own workspace; structured output; explicit
//     --max-turns, wall-clock timeout, and tool allowlist; SIGTERM then force-kill after a grace
//     period; subscription auth, never a stray API key (see BILLING SAFETY below); never
//     --dangerously-skip-permissions — least-privilege --allowedTools instead.
//   - BILLING SAFETY (the $1,600 / issue-#557 lesson, scripts/calibrate-router.mjs /
//     scripts/goldie-weekly.sh): every spawned `claude -p` strips ANTHROPIC_API_KEY / CLAUDE_API_KEY /
//     ANTHROPIC_AUTH_TOKEN from its environment first. LIVE-VERIFIED during this build (2026-07-16):
//     this machine's ambient ANTHROPIC_API_KEY is stale/invalid — an unstripped headless run failed
//     outright with "401 API key is invalid" instead of riding the Claude Max subscription login.
//     Stripping the key is not optional here; it is the difference between "runs for free on the
//     subscription" and "fails" (best case) or "bills the API key" (worst case).
//
// Outcome verification is PROVE-IT, not self-report (Stuart mandate, Rule 20): after the child exits
// we independently check git (does origin/issue-fix/<N> now exist?) and gh (did a new issue comment
// land?) rather than trusting whatever the agent's own transcript claims.
//
// Usage:
//   node scripts/issue-fix.mjs                       # find new open issues, fix or triage each
//   node scripts/issue-fix.mjs --dry-run              # print the plan for each candidate; NOTHING
//                                                      # is spawned, pushed, commented, or written
//   node scripts/issue-fix.mjs --dry-run --simulate 16
//       # TEST-ONLY: force-fetch issue #16 (even though it's closed) and run it through the dry-run
//       # planning path so Stuart can see exactly what WOULD launch. --simulate is REFUSED outside
//       # --dry-run — it must never be able to touch a real issue.
//   node scripts/issue-fix.mjs --json                 # machine-readable summary on stdout

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'stuinfla/ruvnet-brain';
const GH_BIN = process.env.GH_BIN || 'gh';
const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(os.homedir(), '.npm-global', 'bin', 'claude');

// Same file, same env-var name, as scripts/issue-watch.mjs — pointing ISSUE_WATCH_STATE at a test
// copy redirects BOTH scripts at once. Our records live under FIX_NS so they can never collide with
// the watcher's bare-issue-number keys.
const STATE_PATH = process.env.ISSUE_WATCH_STATE
  || path.join(os.homedir(), '.claude', 'ruvnet-brain', 'issue-watch-state.json');
const FIX_NS = '__issueFix';

const LOG_DIR = process.env.ISSUE_FIX_LOG_DIR
  || path.join(os.homedir(), '.claude', 'ruvnet-brain', 'issue-fix-logs');
const WORKTREE_ROOT = process.env.ISSUE_FIX_WORKTREE_DIR
  || path.join(os.homedir(), '.cache', 'ruvnet-brain', 'issue-fix-worktrees');
const LOCK_PATH = process.env.ISSUE_FIX_LOCK
  || path.join(os.homedir(), '.claude', 'ruvnet-brain', 'issue-fix.lock');

const COOLDOWN_HOURS = Number(process.env.ISSUE_FIX_COOLDOWN_HOURS || 24); // one SUCCESSFUL attempt per issue per 24h
// A FAILED attempt (no branch, no comment — the fixer produced nothing) must NOT hide behind the
// 24h cooldown. It retries within the hour and, until it succeeds, keeps alerting loudly. Silent
// burial of a failed fix under a long cooldown is exactly how 6 real bugs read as "board is clean".
const FAILED_RETRY_HOURS = Number(process.env.ISSUE_FIX_FAILED_RETRY_HOURS || 1);
// The ONLY outcomes that count as a real fix — a verifiable artifact exists. Anything else is a
// failure, recorded as one, retried soon, and alerted. "completed" is never asserted; it is derived.
const SUCCESS_OUTCOMES = new Set(['branch-pushed', 'triage-comment']);
const TIMEOUT_MS = Number(process.env.ISSUE_FIX_TIMEOUT_MS || 15 * 60_000); // 15 min wall-clock
const GRACE_MS = Number(process.env.ISSUE_FIX_GRACE_MS || 20_000); // SIGTERM -> SIGKILL grace
const MAX_TURNS = Number(process.env.ISSUE_FIX_MAX_TURNS || 30);
const MAX_PER_RUN = Number(process.env.ISSUE_FIX_MAX_PER_RUN || 3); // cap a burst; rest picked up next run
const FIX_MODEL = process.env.ISSUE_FIX_MODEL || 'sonnet';

// Least-privilege allowlist: Bash is scoped to exactly the commands the prompt instructs the fixer to
// run (git, gh, the two gate commands) — not a blanket shell. No WebSearch/WebFetch: verification is
// against the repo's own code, not the web. Matches the adapter contract's "explicit tool allowlist" +
// "default-deny MCP/tools" guidance; avoids --dangerously-skip-permissions entirely.
const ALLOWED_TOOLS = [
  'Bash(git *)',
  'Bash(gh *)',
  'Bash(npx vitest*)',
  'Bash(node scripts/sync-version.mjs*)',
  'Read', 'Edit', 'Write', 'Glob', 'Grep',
].join(' ');

function ghJson(args) {
  const res = spawnSync(GH_BIN, args, { encoding: 'utf8' });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim();
    throw new Error(`gh ${args.join(' ')} failed (exit ${res.status}): ${err}`);
  }
  return JSON.parse(res.stdout);
}

/** Same resolution order as issue-watch.mjs / scripts/notify.sh. */
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

async function pushNtfy(topic, { title, body, priority = 'default', tags = 'wrench' }) {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: title, Priority: priority, Tags: tags },
      body,
    });
    return res.ok;
  } catch {
    return false; // alerting must never break the job
  }
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return {}; }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ── Concurrency-1 lock (defense in depth alongside the run loop's own sequential processing: a
// single issue can take up to TIMEOUT_MS, which can outlive the 10-minute poll cadence). ──
function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  if (fs.existsSync(LOCK_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
      process.kill(prev.pid, 0); // throws if the pid is not alive -> stale lock, fall through to reclaim
      return { acquired: false, holder: prev };
    } catch { /* stale lock or unreadable — reclaim it below */ }
  }
  fs.writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return { acquired: true };
}
function releaseLock() {
  try { fs.unlinkSync(LOCK_PATH); } catch { /* already gone */ }
}

/** Clear a worktree/branch left behind by a crashed prior run for this issue, if any. Never touches
 * main. Safe to call even when nothing is stale. */
function reclaimStale(branch) {
  spawnSync('git', ['-C', ROOT, 'worktree', 'prune'], { encoding: 'utf8' });
  const list = spawnSync('git', ['-C', ROOT, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' }).stdout || '';
  for (const block of list.split('\n\n')) {
    const p = block.match(/^worktree (.+)$/m);
    const b = block.match(/^branch refs\/heads\/(.+)$/m);
    if (p && b && b[1] === branch) {
      spawnSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', p[1]], { encoding: 'utf8' });
    }
  }
  spawnSync('git', ['-C', ROOT, 'branch', '-D', branch], { encoding: 'utf8' }); // no-op if absent
}

/** True if origin/issue-fix/<N> already exists — a prior attempt is awaiting human review; don't
 * re-run and don't create a second branch for the same issue. */
function remoteBranchExists(branch) {
  const r = spawnSync('git', ['-C', ROOT, 'ls-remote', '--heads', 'origin', branch], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function prepareWorktree(issue) {
  const branch = `issue-fix/${issue.number}`;
  if (remoteBranchExists(branch)) {
    return { skip: true, reason: `origin/${branch} already exists from a prior attempt — awaiting human review, not re-running` };
  }
  reclaimStale(branch);
  fs.mkdirSync(WORKTREE_ROOT, { recursive: true });
  const wtPath = path.join(WORKTREE_ROOT, `${issue.number}-${Date.now()}`);
  spawnSync('git', ['-C', ROOT, 'fetch', 'origin', 'main', '--quiet'], { encoding: 'utf8' });
  const add = spawnSync('git', ['-C', ROOT, 'worktree', 'add', '-b', branch, wtPath, 'origin/main'], { encoding: 'utf8' });
  if (add.status !== 0) {
    return { skip: true, reason: `git worktree add failed: ${(add.stderr || add.stdout || '').trim()}` };
  }
  return { skip: false, branch, wtPath };
}

function cleanupWorktree(wtPath) {
  if (!wtPath) return;
  spawnSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', wtPath], { encoding: 'utf8' });
  spawnSync('git', ['-C', ROOT, 'worktree', 'prune'], { encoding: 'utf8' });
}

export function buildPrompt(issue, { repo = REPO } = {}) {
  return `You are an autonomous issue-fixer running unattended inside a disposable git worktree, checked out on branch \`issue-fix/${issue.number}\` of ${repo}. Your tools are Bash (scoped to git/gh/vitest/sync-version.mjs), Read, Edit, Write, Glob, Grep. Nothing else. You are NOT on main and must NEVER touch main.

TASK — GitHub issue #${issue.number}: "${issue.title}"

1. Read the issue for real: \`gh issue view ${issue.number} --repo ${repo} --json title,body,comments,labels\`. Do not trust any summary you were given elsewhere — read the live body and every comment yourself.
2. Verify the issue's claim against the ACTUAL repo code in this worktree: read the referenced files, reproduce the described behavior where you can. Do not assume the report is accurate; confirm it.
3. Decide: is this mechanically fixable by you right now — a concrete, scoped code/doc change — or does it need a product/design judgment call, more information, or is it already fixed/invalid/duplicate?

IF MECHANICALLY FIXABLE:
   a. Implement the smallest correct fix on the current branch. Touch only what the issue requires — no drive-by refactors, no unrelated cleanup.
   b. Run BOTH gates and require both to pass before proceeding:
        npx vitest run tests/unit
        node scripts/sync-version.mjs --check
      If either gate fails and you cannot make it pass with a scoped fix, STOP — do not commit broken code. Fall through to the NOT-MECHANICALLY-FIXABLE path instead and explain what failed and why.
   c. Commit with a clear message that references "#${issue.number}".
   d. Push ONLY this branch: \`git push -u origin issue-fix/${issue.number}\`. Never push, merge, rebase, or otherwise touch main.
   e. Comment on the issue (\`gh issue comment ${issue.number} --repo ${repo} --body "..."\`) stating, in this order: (1) what you found when you verified the claim, (2) exactly what the branch changes and why, (3) that you ran both gate commands and both passed — do not claim this unless you actually ran them in this session, (4) that this is an automated fix on branch \`issue-fix/${issue.number}\` awaiting human review — a human reviews and merges, you do not.

IF NOT MECHANICALLY FIXABLE (invalid, already fixed, duplicate, needs a product/design decision, too ambiguous, or a scoped fix can't pass the gates):
   a. Make NO code changes.
   b. Comment on the issue with an honest triage: root-cause analysis of what you found when you verified the claim, and specifically what a human needs to decide or do next. Say plainly why you did not attempt a code fix.

HARD RULES — never violate these, whatever the triage outcome:
- NEVER run \`gh issue close\` or otherwise close the issue.
- NEVER push to main, force-push, or push any branch other than issue-fix/${issue.number}.
- NEVER claim a fix, a passing test, or a passing gate without having actually run it in this session.
- Prefix every issue comment you post with "🤖 Automated issue-fix run (issue-fix.mjs) — a human reviews before anything merges." so it reads clearly as automation.
- Stay inside this worktree; do not modify files outside it.
`;
}

function buildArgs(issue) {
  return [
    '-p', buildPrompt(issue),
    '--max-turns', String(MAX_TURNS),
    '--output-format', 'stream-json',
    '--verbose',
    '--model', FIX_MODEL,
    '--allowedTools', ALLOWED_TOOLS,
  ];
}

/** Render the exact command line for --dry-run display / the run report. Not used to actually spawn
 * (spawn takes an argv array directly — no shell involved, so no injection risk there). */
function renderInvocation(issue, wtPath) {
  const args = buildArgs(issue).map((a) => (/[\s"$`\\]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a));
  return `(cd ${wtPath} && env -u ANTHROPIC_API_KEY -u CLAUDE_API_KEY -u ANTHROPIC_AUTH_TOKEN \\\n  ${CLAUDE_BIN} ${args.join(' ')})`;
}

function spawnFixer(issue, wtPath, logPath) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDE_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const logFd = fs.openSync(logPath, 'a');
    fs.writeSync(logFd, `===== issue-fix #${issue.number} — started ${new Date().toISOString()} =====\n`);

    const child = spawn(CLAUDE_BIN, buildArgs(issue), { cwd: wtPath, env, stdio: ['ignore', 'pipe', 'pipe'] });
    CURRENT.child = child;

    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      fs.writeSync(logFd, `\n===== WALL-CLOCK TIMEOUT (${TIMEOUT_MS}ms) — sending SIGTERM =====\n`);
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already dead */ } }, GRACE_MS);
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => fs.writeSync(logFd, d));
    child.stderr.on('data', (d) => fs.writeSync(logFd, d));
    child.on('close', (code, signal) => {
      clearTimeout(killTimer);
      fs.writeSync(logFd, `\n===== issue-fix #${issue.number} — ended ${new Date().toISOString()} (exit ${code}, signal ${signal}, timedOut ${timedOut}) =====\n`);
      try { fs.closeSync(logFd); } catch { /* noop */ }
      CURRENT.child = null;
      resolve({ code, signal, timedOut });
    });
  });
}

/** PROVE-IT, not self-report: independently check git + gh for what actually happened, rather than
 * trusting the child's own transcript. */
function verifyOutcome(issue, beforeCommentCount, timedOut) {
  const branch = `issue-fix/${issue.number}`;
  if (remoteBranchExists(branch)) return { outcome: 'branch-pushed', branch };

  let afterCommentCount = beforeCommentCount;
  try {
    const detail = ghJson(['issue', 'view', String(issue.number), '--repo', REPO, '--json', 'comments']);
    afterCommentCount = (detail.comments || []).length;
  } catch { /* leave as before; verification is best-effort, never fatal */ }
  if (afterCommentCount > beforeCommentCount) return { outcome: 'triage-comment' };

  return { outcome: timedOut ? 'timeout-failed' : 'no-action' };
}

const CURRENT = { child: null, wtPath: null };

export async function run({ dryRun = false, simulate = [], now = Date.now(), repo = REPO } = {}) {
  if (simulate.length && !dryRun) {
    throw new Error('--simulate is only permitted with --dry-run — refusing to touch a real issue outside a dry run');
  }

  const state = loadState();
  const fixState = state[FIX_NS] || {};
  const results = [];

  let issues;
  if (simulate.length) {
    issues = simulate.map((n) => {
      const v = ghJson(['issue', 'view', String(n), '--repo', repo, '--json', 'number,title,createdAt,comments,state']);
      return { number: v.number, title: v.title, createdAt: v.createdAt, comments: (v.comments || []).length, state: v.state };
    });
  } else {
    issues = ghJson(['issue', 'list', '--repo', repo, '--state', 'open', '--json', 'number,title,createdAt,comments,updatedAt']);
  }

  const candidates = issues.filter((issue) => {
    const rec = fixState[String(issue.number)];
    if (!rec) return true;
    const last = Date.parse(rec.attemptedAt);
    if (!Number.isFinite(last)) return true;
    // A real success gets the full 24h cooldown; a FAILED (or legacy hardcoded-'completed' with a
    // non-success outcome) attempt retries within the hour. This is what stops a broken fix from
    // being buried — an unfixed issue comes back around fast, loudly, until an artifact exists.
    const isRealSuccess = rec.status === 'completed' && SUCCESS_OUTCOMES.has(rec.outcome);
    const cooldown = isRealSuccess ? COOLDOWN_HOURS : FAILED_RETRY_HOURS;
    return (now - last) / 3_600_000 >= cooldown;
  });

  const queue = dryRun ? candidates : candidates.slice(0, MAX_PER_RUN);
  const deferred = dryRun ? [] : candidates.slice(MAX_PER_RUN);

  for (const issue of queue) {
    if (dryRun) {
      const plan = prepareWorktreePlan(issue);
      results.push({ number: issue.number, title: issue.title, dryRun: true, ...plan });
      continue;
    }

    // Mark the attempt BEFORE running, so a crash mid-run still counts against the 24h cooldown
    // instead of hammering the same issue every 10 minutes.
    fixState[String(issue.number)] = { attemptedAt: new Date(now).toISOString(), status: 'running' };
    state[FIX_NS] = fixState;
    saveState(state);

    const prep = prepareWorktree(issue);
    if (prep.skip) {
      fixState[String(issue.number)] = { attemptedAt: new Date(now).toISOString(), status: 'skipped', reason: prep.reason };
      state[FIX_NS] = fixState;
      saveState(state);
      results.push({ number: issue.number, title: issue.title, outcome: 'skipped', reason: prep.reason });
      continue;
    }

    const { branch, wtPath } = prep;
    CURRENT.wtPath = wtPath;
    const ts = new Date(now).toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(LOG_DIR, `issue-${issue.number}-${ts}.log`);

    let beforeCommentCount = issue.comments ?? 0;
    try {
      const detail = ghJson(['issue', 'view', String(issue.number), '--repo', repo, '--json', 'comments']);
      beforeCommentCount = (detail.comments || []).length;
    } catch { /* fall back to list-view count */ }

    let outcome;
    try {
      const { code, signal, timedOut } = await spawnFixer(issue, wtPath, logPath);
      const verified = verifyOutcome(issue, beforeCommentCount, timedOut);
      outcome = { ...verified, exitCode: code, signal, timedOut, branch, logPath };
    } finally {
      cleanupWorktree(wtPath);
      CURRENT.wtPath = null;
    }

    // status is DERIVED from a verifiable artifact, never asserted. verifyOutcome() already checked
    // reality (does origin/issue-fix/<N> exist? did a new comment post?). If neither, this attempt
    // FAILED — say so, so the cooldown retries it soon and the alert screams instead of whispering.
    // (2026-07-17: this line used to hardcode 'completed' regardless of outcome — it marked 6 issues
    // done while producing zero branches/comments/logs. That is faking, not fixing. Never again.)
    const succeeded = SUCCESS_OUTCOMES.has(outcome.outcome);
    fixState[String(issue.number)] = {
      attemptedAt: new Date(now).toISOString(),
      status: succeeded ? 'completed' : 'failed',
      outcome: outcome.outcome,
      branch: succeeded ? (outcome.branch || null) : null,
      logPath,
    };
    state[FIX_NS] = fixState;
    saveState(state);

    results.push({ number: issue.number, title: issue.title, ...outcome, logPath });

    const topic = resolveTopic();
    if (topic) {
      const { title, body, priority, tags } = summarize(issue, outcome, logPath);
      await pushNtfy(topic, { title, body, priority, tags });
    }
  }

  return { results, checkedAt: new Date(now).toISOString(), candidateCount: candidates.length, deferredCount: deferred.length };
}

function prepareWorktreePlan(issue) {
  const branch = `issue-fix/${issue.number}`;
  const alreadyPushed = remoteBranchExists(branch);
  const wtPath = path.join(WORKTREE_ROOT, `${issue.number}-<timestamp>`);
  const logPath = path.join(LOG_DIR, `issue-${issue.number}-<timestamp>.log`);
  return {
    branch,
    wtPath,
    logPath,
    wouldSkip: alreadyPushed,
    skipReason: alreadyPushed ? `origin/${branch} already exists from a prior attempt — would NOT re-run` : null,
    invocation: renderInvocation(issue, wtPath),
    timeoutMs: TIMEOUT_MS,
    graceMs: GRACE_MS,
    maxTurns: MAX_TURNS,
    model: FIX_MODEL,
    allowedTools: ALLOWED_TOOLS,
  };
}

function summarize(issue, outcome, logPath) {
  const url = `https://github.com/${REPO}/issues/${issue.number}`;
  switch (outcome.outcome) {
    case 'branch-pushed':
      return {
        title: `✅ Issue fixer — #${issue.number}: branch pushed`,
        body: `${issue.title}\nbranch: ${outcome.branch} (pushed, NOT merged — needs human review)\n${url}\nlog: ${logPath}`,
        priority: 'default', tags: 'white_check_mark,wrench',
      };
    case 'triage-comment':
      return {
        title: `📋 Issue fixer — #${issue.number}: triage posted`,
        body: `${issue.title}\nNot mechanically fixable — an honest triage comment was posted.\n${url}\nlog: ${logPath}`,
        priority: 'default', tags: 'clipboard',
      };
    case 'timeout-failed':
      return {
        title: `🔴 Issue fixer — #${issue.number}: TIMED OUT`,
        body: `${issue.title}\nHit the ${Math.round(TIMEOUT_MS / 60000)}m wall-clock timeout with no verified outcome (no branch pushed, no comment posted). Worktree was cleaned up.\n${url}\nlog: ${logPath}`,
        priority: 'high', tags: 'rotating_light,hourglass',
      };
    default:
      return {
        title: `⚠️ Issue fixer — #${issue.number}: no action taken`,
        body: `${issue.title}\nThe fixer exited without pushing a branch or posting a comment (exit ${outcome.exitCode}, signal ${outcome.signal || 'none'}). Check the log.\n${url}\nlog: ${logPath}`,
        priority: 'high', tags: 'warning',
      };
  }
}

function cleanupOnSignal(sig) {
  return () => {
    try { if (CURRENT.child) CURRENT.child.kill('SIGTERM'); } catch { /* noop */ }
    try { if (CURRENT.wtPath) cleanupWorktree(CURRENT.wtPath); } catch { /* noop */ }
    releaseLock();
    process.exit(sig === 'SIGTERM' ? 143 : 130);
  };
}
process.on('SIGTERM', cleanupOnSignal('SIGTERM'));
process.on('SIGINT', cleanupOnSignal('SIGINT'));

function printReport(output, { dryRun, simulate }) {
  console.log(`Issue auto-fixer — ${REPO}${dryRun ? '  [DRY-RUN]' : ''}${simulate.length ? `  [SIMULATE: ${simulate.join(',')}]` : ''}\n`);

  if (!output.results.length) {
    console.log(dryRun
      ? 'No candidates to fix. Board is clean — nothing would be launched.'
      : 'No new open issues to fix. Board is clean.');
    return;
  }

  for (const r of output.results) {
    if (r.dryRun) {
      console.log(`🛠  #${r.number}  ${r.title}`);
      console.log(`   branch: ${r.branch}`);
      console.log(`   worktree: ${r.wtPath}`);
      console.log(`   log: ${r.logPath}`);
      console.log(`   timeout: ${Math.round(r.timeoutMs / 60000)}m wall-clock (SIGTERM, then SIGKILL after ${Math.round(r.graceMs / 1000)}s grace)`);
      console.log(`   max-turns: ${r.maxTurns} · model: ${r.model}`);
      console.log(`   allowed-tools: ${r.allowedTools}`);
      if (r.wouldSkip) {
        console.log(`   [DRY-RUN] would SKIP — ${r.skipReason}`);
      } else {
        console.log('   [DRY-RUN] would run:');
        console.log(`   ${r.invocation.split('\n').join('\n   ')}`);
      }
      console.log('');
      continue;
    }
    const icon = { 'branch-pushed': '✅', 'triage-comment': '📋', 'timeout-failed': '🔴', 'no-action': '⚠️', skipped: '⏭️' }[r.outcome] || '❓';
    console.log(`${icon} #${r.number}  ${r.title}`);
    console.log(`   outcome: ${r.outcome}${r.branch ? ` · branch: ${r.branch}` : ''}${r.reason ? ` · ${r.reason}` : ''}`);
    if (r.logPath) console.log(`   log: ${r.logPath}`);
    console.log('');
  }
  if (output.deferredCount) {
    console.log(`${output.deferredCount} additional candidate(s) deferred to the next run (ISSUE_FIX_MAX_PER_RUN=${MAX_PER_RUN}).`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const asJson = argv.includes('--json');
  const simIdx = argv.indexOf('--simulate');
  const simulate = simIdx === -1 ? [] : (argv[simIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);

  if (simulate.length && !dryRun) {
    console.error('issue-fix: --simulate is only permitted together with --dry-run. Refusing.');
    process.exit(1);
  }

  let lock = { acquired: true };
  if (!dryRun) {
    lock = acquireLock();
    if (!lock.acquired) {
      console.log(`issue-fix: another run is already in progress (pid ${lock.holder?.pid}, started ${lock.holder?.startedAt}) — exiting (concurrency 1).`);
      // 75 = the reserved skip code: job-heartbeat.sh restores the live run's receipt (F3) instead
      // of overwriting it with ok/0s. launchd still sees success — a skip is not a failure.
      process.exit(75);
    }
  }

  let output;
  try {
    output = await run({ dryRun, simulate });
  } catch (err) {
    console.error(`issue-fix: FAILED — ${err.message}`);
    if (!dryRun) releaseLock();
    process.exit(1);
  }
  if (!dryRun) releaseLock();

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printReport(output, { dryRun, simulate });
  }
  // DERIVED, not asserted (F9, 2026-07-18): the state FILE was already honest, but this exit(0) told
  // the heartbeat/watchdog "ok" even when every attempt failed — a permanently broken fixer looked
  // green on every supervised surface. The exit code now derives from the same artifact-verified
  // outcomes the state file records: any real (non-dry-run) attempt that did not end in a verified
  // SUCCESS_OUTCOME fails the run, so the failure reaches the receipt and the pager.
  const failedAttempt = !dryRun && (output.results || []).some(
    (r) => r && typeof r.outcome === 'string' && !SUCCESS_OUTCOMES.has(r.outcome) && !/^skip/i.test(r.outcome),
  );
  process.exit(failedAttempt ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
