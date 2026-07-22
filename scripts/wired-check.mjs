#!/usr/bin/env node
/**
 * wired-check.mjs — refuses to let a module ship with zero callers.
 *
 * THE FAILURE THIS EXISTS TO END. On 2026-07-22 this project shipped built-tested-unwired code
 * SEVEN times in a single session:
 *
 *   capability-registry.mjs   zero call sites; the console referenced it only in comments
 *   capability-audit.mjs      zero call sites
 *   lesson-gate.mjs           five triggers "enforcing", nothing invoked them
 *   anticipate.sh             invoked by zero hooks
 *   advocacy-outcomes.mjs     fed by zero callers, so precision had no denominator
 *   lesson-promote.mjs        zero references to `demoted`, so demotion was theatre
 *   continuation-gate.mjs     global hook pointed at a path not yet shipped
 *
 * Each was found by a human or a reviewer running `grep`. Each time the fix took minutes and the
 * discovery took hours. Every one of them passed its own tests, because a test imports the module
 * directly — the one caller that proves nothing about whether the product uses it.
 *
 * The owner's principle, P7: "Built is not shipped; shipped is not wired. A feature exists only
 * when a real caller invokes it on a real user path."
 *
 * Seven repetitions of one mistake is not a discipline problem. Discipline is what failed. So this
 * is a gate, and gates in this repo run 8/8 while prose runs 0/6.
 *
 *   node scripts/wired-check.mjs            report
 *   node scripts/wired-check.mjs --check    exit 1 if any shippable module has no caller
 *
 * WHAT COUNTS AS A CALLER: an import or invocation from non-test, non-self source. A test is
 * explicitly NOT a caller — that exclusion is the entire point, because every one of the seven
 * above had passing tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);

/**
 * Modules that are legitimately standalone: a human runs them, so a call site would be wrong to
 * demand. Each entry needs a REASON, so the allowlist cannot quietly become the place unwired code
 * goes to hide — which is the obvious way a gate like this dies.
 */
const STANDALONE = {
  'wired-check': 'this gate; run by CI and by hand',
  'lesson-seed': 'one-shot seeding, run deliberately by a human',
  'lesson-ratify': 'the human control surface — a CLI is its entire purpose',
  'lesson-promote': 'run by a human or the nightly; surfaced to the user by the capability registry',
  'memory-doctor': 'diagnostic CLI',
  'token-report': 'diagnostic CLI',
  'health-repair': 'invoked by the console via runNode, which this scanner cannot see as an import',
  'capability-audit': 'invoked by the console via the capability surface',
  'release': 'the ship path, run by a human',
  'self-update': 'run by the nightly cron',
  'sync-version': 'run by gates and by hand',
  'claims-verify': 'run by CI',
  'build-bundle': 'run by the release path',
  'count-chunks': 'run by the nightly',
  'brain-stamp': 'run by the nightly',
  // Diagnostics and one-shots a human invokes deliberately. Each reason is real; an allowlist
  // without reasons is just where unwired code goes to hide, which would kill this gate quietly.
  'agentdb-fleet-doctor': 'diagnostic CLI run by hand when a fleet looks wrong',
  'memory-doctor': 'diagnostic CLI',
  'ingest-meeting': 'one-shot ingestion, run by hand',
  'fix-metaharness-memretrieve': 'one-shot historical repair; kept for the record',
  'gen-console-images': 'build-time asset generation, run by hand',
  'behavioral-l1-l4': 'behavioural test harness, invoked by its own test file',
  'check-indexation': 'CI check invoked from the workflow, not from source',
  'check-legibility': 'CI check invoked from the workflow, not from source',
  'status-honesty': 'CI check invoked from the workflow, not from source',
  'doc-currency': 'gate CLI: npm run doc:currency, and the release path',
};

/**
 * DELIBERATELY HELD — built, correct to keep, and knowingly NOT wired yet, each with the bar it
 * must clear before it may ship.
 *
 * This is a separate category from STANDALONE on purpose. Filing held work under "standalone"
 * would be a small lie that hides a real gap, and this gate exists because small lies about
 * wiring cost this project seven incidents in one day. Held work is VISIBLE work.
 */
const HELD = {
  'correction-detect': 'N3 lesson extraction. Measured at ~27% precision against a >=90% shipping '
    + 'floor (ADR-033). Wiring it would feed the lesson store garbage at 3 rejects per 4 hits, and '
    + 'a store full of garbage is worse than an empty one. Ships when precision clears the floor.',
  'lesson-lifecycle': 'retirement + generalization for extracted lessons. Depends on '
    + 'correction-detect; wiring it alone would retire hand-written lessons on evidence that does '
    + 'not exist yet.',
};

/** Every first-party module that is expected to be USED by something. */
function shippableModules() {
  const out = [];
  for (const dir of ['scripts']) {
    const abs = path.join(REPO, dir);
    let names = [];
    try { names = fs.readdirSync(abs); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.mjs')) continue;
      const base = n.replace(/\.mjs$/, '');
      if (STANDALONE[base]) continue;
      if (HELD[base]) continue;   // reported separately, never silently skipped
      out.push({ base, rel: path.join(dir, n) });
    }
  }
  return out;
}

/**
 * Count REAL callers. Tests are excluded deliberately: all seven failures had passing tests, so
 * counting them would make this gate agree with every one of them.
 */
function callersOf(base) {
  let hits = '';
  try {
    hits = execFileSync('grep', [
      '-rl', '--include=*.mjs', '--include=*.js', '--include=*.sh', '--include=*.json', '--include=*.html',
      base, 'scripts', 'plugin', 'console', 'bin', 'kb',
    ], { cwd: REPO, encoding: 'utf8' });
  } catch { return []; }
  return hits.split('\n').filter(Boolean).filter((f) =>
    !f.includes('/tests/') && !f.startsWith('tests/') && !f.endsWith(`${base}.mjs`));
}

export function audit() {
  return shippableModules().map((m) => {
    const callers = callersOf(m.base);
    return { ...m, callers, wired: callers.length > 0 };
  });
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('wired-check.mjs');
if (invokedDirectly) {
  const rows = audit();
  const unwired = rows.filter((r) => !r.wired);

  if (!argv.includes('--quiet')) {
    console.log(`\n  ${rows.length} shippable module(s) checked · ${rows.length - unwired.length} wired · ${unwired.length} with NO caller\n`);
    for (const u of unwired) console.log(`    ✗ ${u.rel}  — built, tested, and invoked by nothing`);
    if (unwired.length) {
      console.log(`\n  A module with no caller is not a feature. Either wire it to a real user path,`);
      console.log(`  or add it to STANDALONE in this file WITH A REASON.\n`);
    } else {
      console.log('  Every shippable module has at least one real caller.\n');
    }
    // Held work is always printed, pass or fail. An unwired feature nobody can see is how a gap
    // becomes permanent.
    const held = Object.entries(HELD);
    if (held.length) {
      console.log(`  ${held.length} module(s) deliberately HELD — built, not wired, and why:\n`);
      for (const [k, why] of held) console.log(`    ⏸ scripts/${k}.mjs\n       ${why}\n`);
    }
  }
  process.exit(argv.includes('--check') && unwired.length ? 1 : 0);
}
