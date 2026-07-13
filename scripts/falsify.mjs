#!/usr/bin/env node
// scripts/falsify.mjs — THE ADVERSARY. Ask the questions Stuart has to keep asking me.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WHY (2026-07-13). Stuart: "Why the fuck do you still keep needing me to call you on these things?
// Ru would not miss stuff like this. You are supposed to be acting like Ru."
//
// He is right, and the defect is mechanical, not motivational:
//
//     I VERIFY WHAT I BUILT. I DO NOT VERIFY WHETHER IT SHOULD EXIST.
//
// Tests I wrote passing is circular evidence — I wrote them to pass. Every miss tonight has that
// shape: the router worked (but rUv already shipped one); the jobs were "watched" (but nothing checked
// they ran); the gong was "complete" (but it never covered liveness). In each case my own artifacts
// said green, and the only thing that said otherwise was Stuart.
//
// Look at how rUv actually writes: every ADR carries an "Honest guardrail" and a measured number, and
// ADR-043 literally reports a TIE against the baseline rather than dressing it as a win. He starts from
// "this is probably wrong" and hunts for the thing that would prove it. I start from "this works."
//
// So this file is the missing step: BEFORE declaring done, run the questions an adversary would ask.
// Not a linter for code — a linter for CLAIMS.
//
// Usage:  node scripts/falsify.mjs            # run every check; exit 1 if any claim is unproven
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });

/**
 * Each check is a question Stuart had to ask me, turned into code so he never has to ask it again.
 * A check FAILS when the claim is unproven — not when the code is broken. That distinction is the
 * whole point: "it works" and "it should exist / it actually ran / it is really rUv's" are different
 * claims, and only the first one had any gate on it.
 */
export const CHECKS = [
  {
    id: 'am-i-impersonating-ruv',
    asked: '"You wrote a bunch of code and told me it\'s Ruv\'s code?"',
    why: 'I hand-rolled a router and called it MetaHarness while @metaharness/router sat on npm.',
    run: () => {
      const r = sh('node', ['scripts/no-silent-substitution.mjs']);
      return { ok: r.status === 0, detail: r.status === 0 ? 'no local code wears a rUv tool\'s name' : r.stderr.trim().split('\n').slice(-2).join(' ') };
    },
  },
  {
    id: 'did-the-jobs-actually-run',
    asked: '"Is the nightly actually running, or are you just telling me it is?"',
    why: 'launchd reports exit 0 for a job that NEVER RAN. Silence was being read as health.',
    run: () => {
      const r = sh('node', ['scripts/nightly-watchdog.mjs', '--json']);
      try {
        const { results } = JSON.parse(r.stdout);
        const bad = results.filter((x) => x.state !== 'OK');
        return { ok: bad.length === 0, detail: bad.length ? `${bad.length} job(s) unproven: ${bad.map((b) => `${b.label}=${b.state}`).join(', ')}` : `all ${results.length} jobs produced a fresh successful receipt` };
      } catch { return { ok: false, detail: 'watchdog produced no readable verdict — that is itself a failure' }; }
    },
  },
  {
    id: 'is-the-router-actually-routing',
    asked: '"Why am I still burning my Fable/Opus quota if the router exists?"',
    why: 'The router\'s entire lifetime output was 3 test pings and $0.018 — because the rule was advisory.',
    run: () => {
      const f = path.join(process.env.HOME, '.claude', 'metaharness', 'routing-receipts.jsonl');
      let rows = [];
      try { rows = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* none */ }
      const subagent = rows.filter((r) => r.source === 'claude-subagent');
      const saved = rows.reduce((s, r) => s + (r.saved || 0), 0);
      // The honest bar: routing must be VISIBLY happening, not merely possible.
      return {
        ok: subagent.length > 0,
        detail: subagent.length
          ? `${rows.length} routed task(s), ${subagent.length} subagent, est. $${saved.toFixed(2)} saved`
          : 'ZERO subagent dispatches routed — the router is decorative again',
      };
    },
  },
  {
    id: 'does-the-repo-ship-what-it-claims',
    asked: '"Are people actually getting the current version?"',
    why: 'Version drift across surfaces is a visible, credibility-destroying mistake.',
    run: () => {
      const r = sh('node', ['scripts/sync-version.mjs', '--check']);
      return { ok: r.status === 0, detail: (r.stdout + r.stderr).trim().split('\n').pop() };
    },
  },
  {
    id: 'is-ci-actually-green',
    asked: '"Why am I getting failure notifications from GitHub?"',
    why: 'I declared green from LOCAL gates while CI had never passed — 25 straight failures.',
    run: () => {
      const r = sh('gh', ['run', 'list', '--workflow', 'ci.yml', '--limit', '1', '--json', 'conclusion,status']);
      try {
        const [run] = JSON.parse(r.stdout);
        if (!run) return { ok: false, detail: 'could not read CI status — do not claim green' };
        if (run.status !== 'completed') return { ok: false, detail: `CI is still ${run.status} — "pending" is not "green"` };
        return { ok: run.conclusion === 'success', detail: `latest ci run: ${run.conclusion}` };
      } catch { return { ok: false, detail: 'gh unavailable — CI state UNKNOWN, which is not the same as green' }; }
    },
  },
];

export function runAll(checks = CHECKS) {
  return checks.map((c) => ({ ...c, ...c.run() }));
}

function main() {
  console.log('falsify — the questions Stuart should not have to keep asking\n');
  const results = runAll();
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.asked}`);
    console.log(`   ${r.detail}`);
    if (!r.ok) console.log(`   why this check exists: ${r.why}`);
    console.log('');
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`${failed.length} claim(s) UNPROVEN. Do not report success. Fix or say plainly what is not verified.`);
    process.exit(1);
  }
  console.log('Every claim above is proven by something other than my own opinion.');
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
