#!/usr/bin/env node
// scripts/release.mjs — the DEFINITION OF DONE. The only path to the word "shipped."
//
// WHY (2026-07-17, Stuart): "You should be able to take the applied knowledge and build it into a set
// of criteria that you always use, not a bunch of suggestions you choose to ignore." Every failure
// this session was an ASSUMPTION that survived because the check was a suggestion, not a gate. This
// script turns the checklist into a gate: it runs the criteria in order, STOPS on the first failure,
// and only prints "SHIPPED" when every channel a user touches is proven current and working. There is
// no "I think it's fine" — there is pass or fail.
//
// It is idempotent and safe to re-run. Each step verifies the REAL artifact (registry, live URL, the
// actual command), never the repo state. Repo state != user experience (the whole lesson).
//
// Usage:
//   node scripts/release.mjs --check          # run every gate READ-ONLY (no publish) — the pre-flight
//   node scripts/release.mjs --publish        # sync version, npm publish, then run every gate
//   node scripts/release.mjs                   # same as --check
//
// The gates, in order (fail fast):
//   A. version single-source-of-truth agrees (sync-version --check)
//   B. full test suite green (npm test — the 60/60)
//   C. narrative + unit gates (vitest) incl. the tag/entity-aware "What's new" check
//   D. [--publish only] npm publish + force `latest` to the shipping version
//   E. verify-channels — the LIVE walk of npm / self-update manifest / release bundle+sig / explainer / git

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLISH = process.argv.includes('--publish');
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` };
const V = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/.claude-plugin/plugin.json'), 'utf8')).version;

function step(n, label) { process.stdout.write(`\n${c.b('▸ ' + n)} ${label}\n`); }
function runOrDie(label, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.error || r.status !== 0) {
    console.error(`\n${c.r('✗ GATE FAILED: ' + label)} ${c.dim('(' + cmd + ' ' + args.join(' ') + ' → ' + (r.error ? r.error.message : 'exit ' + r.status) + ')')}`);
    console.error(`${c.r('  NOT shipped. Fix this, then re-run. No assumptions past a red gate.')}\n`);
    process.exit(1);
  }
}

console.log(`\n${c.b('RuvNet Brain — release / definition-of-done')} ${c.dim('· ' + (PUBLISH ? 'PUBLISH' : 'check-only') + ' · shipping ' + V())}\n`);

// A. version single source of truth
step('A', 'version single-source-of-truth agrees across every surface');
runOrDie('version sync', process.execPath, ['scripts/sync-version.mjs', '--check']);

// B. the full brain test suite (the 60/60)
step('B', 'full test suite (npm test)');
runOrDie('npm test', 'npm', ['test']);

// C. unit gates — narrative-version (tag/entity aware), claims, etc.
step('C', 'unit gates (vitest) — narrative version, claims, guards');
runOrDie('vitest unit', 'npx', ['vitest', 'run', 'tests/unit']);

// D. publish to npm (only with --publish) so `npx ruvnet-brain@latest` is never stale
if (PUBLISH) {
  step('D', 'npm publish + force `latest` to the shipping version');
  const v = V();
  let already = '';
  try { already = execFileSync('npm', ['view', `ruvnet-brain@${v}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* not published yet */ }
  if (already === v) console.log(c.dim(`  ${v} already on npm — skipping publish, just re-asserting the tag`));
  else runOrDie('npm publish', 'npm', ['publish']);
  // npm does NOT auto-move `latest` to a prerelease (x.y.z-dev) — force it, or `@latest` stays stale.
  runOrDie('npm dist-tag latest', 'npm', ['dist-tag', 'add', `ruvnet-brain@${v}`, 'latest']);
} else {
  step('D', 'npm publish — SKIPPED (check-only; pass --publish to publish)');
}

// E. the live channel walk — THE gate that would have caught the stale-2.9.1 + 404
step('E', 'verify-channels — the live walk of every user path');
runOrDie('verify-channels', process.execPath, ['scripts/verify-channels.mjs']);

console.log(`\n${c.g(c.b('✓✓✓ SHIPPED'))} — every gate passed and every live channel is current. ${c.dim('A user on any path (npm, npx, explainer, --update) gets the working, current build.')}\n`);
