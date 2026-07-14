#!/usr/bin/env node
// stack-sync.mjs — THE one rule for the RuvNet stack. One global copy. Correct. Provable.
//
// WHY THIS EXISTS (found live 2026-07-14, because Stuart noticed an update nag pointing BACKWARDS):
//
//   TWO installers were fighting on this machine:
//     com.stuartkerr.ruflo-autoupdate   nightly 03:30   npm install -g <38 pkgs>, core on @alpha
//     io.ruv.auto-subscribe             HOURLY          npm install -g <4 pkgs>  on @latest
//   The moment rUv publishes an alpha ahead of latest — the entire point of an alpha track — the
//   nightly puts you on alpha and the hourly drags you back down. Every hour. Forever.
//
//   Meanwhile ~190 hook invocations across 16 projects call `npx <pkg>@latest` on every Edit, Bash
//   and prompt. npx runs its OWN private copy from ~/.npm/_npx, which can be badly stale (rvf sat
//   at 0.1.9 in that cache while the global was 0.2.3). npx does not merely fail to catch drift —
//   it MANUFACTURES THE ILLUSION OF CURRENCY: every command works, every --version prints the new
//   number, and the binary the MCP server actually executes quietly rots.
//
// THE ROOT CAUSE, stated once: currency is an ORDERING question, not an EQUALITY one.
// Three separate files compared installed vs latest with `!=`, which fires in EITHER direction:
//     plugin/scripts/ground-ruvnet.sh              -> advised a DOWNGRADE every prompt (fixed 2.7.2)
//     ~/.claude/hooks/ruflo-upgrade-awareness.sh   -> same bug, same bad advice
//     ~/.claude/scripts/ruvnet-auto-subscribe.sh   -> same bug, but it EXECUTES npm install -g
// `!=` only ever LOOKS right because installed is normally <= latest. Nothing asserted direction.
//
// So this file has exactly ONE comparator, and it is the only place ordering is decided.
// A downgrade is not "policy-forbidden" here — it is STRUCTURALLY UNREACHABLE: the only install
// gate is isBehind(), and AHEAD is an explicitly allowed, untouched state.
//
// GROUNDING (search_ruvnet across 37 repos): rUv ships no machine-wide package updater. His docs
// present `npm install -g` and `npx` as equally valid with no ruling on which wins — which is
// exactly where the drift lives. Closest precedent: ruflo/plugins/ruflo-ruvector ADR-0001
// (ACCEPTED) — pin, verify against a smoke test, bump deliberately. This is OUR operator script
// honoring that discipline. It is not an rUv product and does not wear rUv's name.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const PREFIX = path.join(HOME, '.npm-global');
const GLOBAL_LIB = path.join(PREFIX, 'lib/node_modules');
const NPX_CACHE = path.join(HOME, '.npm/_npx');
const RECEIPT = path.join(HOME, '.cache/ruvnet-brain/stack-sync-receipt.json');

// The tag policy. ONE table — the single source of truth for "what SHOULD be installed".
// The orchestration core tracks alpha (rUv ships fast: 3.26 -> 3.28 inside one 18-hour window).
// Everything else tracks latest. Unlisted packages get DEFAULT_TAG.
export const TAG_POLICY = { ruflo: 'alpha', '@claude-flow/cli': 'alpha' };
export const DEFAULT_TAG = 'latest';

// What counts as "the stack": an explicit allow-list pattern, not a loose scope match, so a stray
// package can never be swept into a global install by accident.
export const FAMILY = /^(ruflo|ruvector|ruvector-extensions|ruvi|ruvbot|qudag|flow-nexus|agent-browser|agent-browser-mcp|agentic-flow|agentic-qe|agentic-robotics|agentic-payments|ruv-swarm|@ruvector\/|@claude-flow\/|@metaharness\/|@agentic-robotics\/)/;

const log = (m) => console.log(m);
const die = (m) => { console.error(`\n  FAILED: ${m}`); process.exit(1); };

// THE COMPARATOR. The only place ordering is decided anywhere in this system.
// Prerelease-aware per semver: a prerelease sorts BEFORE its release (3.28.0-alpha.1 < 3.28.0),
// and numeric identifiers compare numerically — alpha.9 < alpha.10, which a string compare gets
// backwards, and a string compare is precisely the bug this whole file exists to kill.
export function cmpVersion(a, b) {
  const split = (v) => {
    const [core, pre] = String(v).split('-');
    return [core.split('.').map((n) => parseInt(n, 10) || 0), pre ? pre.split('.') : null];
  };
  const [ac, ap] = split(a);
  const [bc, bp] = split(b);
  for (let i = 0; i < 3; i++) {
    const d = (ac[i] || 0) - (bc[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  if (!ap && !bp) return 0;
  if (ap && !bp) return -1;
  if (!ap && bp) return 1;
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const x = ap[i], y = bp[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) { const d = parseInt(x, 10) - parseInt(y, 10); if (d) return d < 0 ? -1 : 1; }
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
export const isBehind = (installed, target) => cmpVersion(installed, target) < 0;

export function installedVersion(pkg, lib = GLOBAL_LIB) {
  const pj = path.join(lib, pkg, 'package.json');
  if (!fs.existsSync(pj)) return null;
  try { return JSON.parse(fs.readFileSync(pj, 'utf8')).version || null; } catch { return null; }
}

function listInstalled() {
  const out = [];
  const scan = (dir, scope = '') => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir)) {
      if (e.startsWith('.')) continue;
      if (e.startsWith('@') && !scope) { scan(path.join(dir, e), e + '/'); continue; }
      const name = scope + e;
      if (FAMILY.test(name)) out.push({ name, installed: installedVersion(name) });
    }
  };
  scan(GLOBAL_LIB);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function registryTags(pkg) {
  const r = spawnSync('npm', ['view', pkg, 'dist-tags', '--json'], { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0 || !r.stdout) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// A second copy of a stack package in the npx cache can only ever SHADOW the global one.
// It is never useful. This is how "two ruflos" happens.
export function findShadows(npxCache = NPX_CACHE, lib = GLOBAL_LIB) {
  const shadows = [];
  if (!fs.existsSync(npxCache)) return shadows;
  for (const d of fs.readdirSync(npxCache)) {
    const nm = path.join(npxCache, d, 'node_modules');
    if (!fs.existsSync(nm)) continue;
    const scan = (dir, scope = '') => {
      for (const e of fs.readdirSync(dir)) {
        if (e.startsWith('.')) continue;
        if (e.startsWith('@') && !scope) { scan(path.join(dir, e), e + '/'); continue; }
        const name = scope + e;
        if (!FAMILY.test(name)) continue;
        try {
          const v = JSON.parse(fs.readFileSync(path.join(dir, e, 'package.json'), 'utf8')).version;
          shadows.push({ name, version: v, dir: path.join(npxCache, d), global: installedVersion(name, lib) });
        } catch { /* unreadable copy: still a shadow, but we cannot name its version */ }
      }
    };
    try { scan(nm); } catch { /* unreadable cache dir */ }
  }
  return shadows;
}

function audit() {
  const pkgs = listInstalled();
  if (!pkgs.length) die(`no stack packages under ${GLOBAL_LIB} — is the npm prefix right?`);

  // A BLIND TOOL MUST NOT REPORT HEALTH. (Adversarial review, 2026-07-14 — a real bug in the first
  // version of this file.) If the registry is unreachable, EVERY package resolves UNRESOLVED, the
  // drift count is 0+0+0, and --audit used to print "all current" and exit 0 — a currency claim
  // that was never measured. That is the exact failure this whole file exists to kill, reproduced
  // inside the fix for it. Silence is not health.
  const rows = pkgs.map((p) => {
    const want = TAG_POLICY[p.name] || DEFAULT_TAG;
    const tags = registryTags(p.name);
    // A package may legitimately have no alpha tag: fall back to latest rather than invent one.
    const tag = tags && tags[want] ? want : DEFAULT_TAG;
    const target = tags ? (tags[tag] ?? null) : null;
    let state;
    if (!p.installed) state = 'BROKEN';
    else if (!target) state = 'UNRESOLVED';
    else if (isBehind(p.installed, target)) state = 'BEHIND';
    else if (cmpVersion(p.installed, target) > 0) state = 'AHEAD';
    else state = 'CURRENT';
    return { ...p, tag, target, state };
  });
  const unresolved = rows.filter((r) => r.state === 'UNRESOLVED');
  if (unresolved.length === rows.length) {
    die(`could not reach the npm registry for ANY of ${rows.length} packages.\n` +
        `   This tool refuses to report on a stack it could not measure. Check the network and re-run.`);
  }

  const shadows = findShadows();
  return { rows, unresolved, shadows, stale: shadows.filter((s) => s.global && s.version !== s.global) };
}

function report({ rows, shadows, stale }) {
  const w = Math.max(...rows.map((r) => r.name.length));
  log(`\n  RuvNet stack — ${rows.length} packages in ${GLOBAL_LIB}\n`);
  for (const r of rows) {
    const mark = { CURRENT: '  ok  ', BEHIND: 'BEHIND', AHEAD: ' ahead', BROKEN: 'BROKEN', UNRESOLVED: '  ??  ' }[r.state];
    const detail = r.state === 'BEHIND' ? `${r.installed} -> ${r.target}  (@${r.tag})`
      : r.state === 'AHEAD' ? `${r.installed}  (ahead of @${r.tag} ${r.target} — alpha track; left alone)`
      : r.state === 'BROKEN' ? `no readable version on disk; registry has ${r.target ?? '?'}`
      : r.installed;
    log(`  [${mark}] ${r.name.padEnd(w)}  ${detail}`);
  }
  if (shadows.length) {
    log(`\n  npx shadow copies:`);
    for (const s of shadows) {
      log(`    ${s.name}@${s.version}${s.global && s.version !== s.global ? `   STALE — global is ${s.global}` : ''}`);
    }
  }
  log('');
  return { behind: rows.filter((r) => r.state === 'BEHIND'), broken: rows.filter((r) => r.state === 'BROKEN'), stale };
}

function writeReceipt(a, installed, purged) {
  fs.mkdirSync(path.dirname(RECEIPT), { recursive: true });
  fs.writeFileSync(RECEIPT, JSON.stringify({
    at: new Date().toISOString(), installed, purged,
    packages: a.rows.map((r) => ({ name: r.name, version: r.installed, state: r.state })),
  }, null, 2));
}

// EXCLUSIVE LOCK. (Adversarial review, 2026-07-14.) Nothing stopped the nightly job and a manual
// run (or two Claude Code windows) from both running `npm install -g` on the same package at the
// same instant. Two concurrent installs interleaving in one node_modules dir is how you get a
// half-written package — which is almost certainly how @ruvector/edge-net ended up present-but-
// versionless with an orphaned `sharp` inside it. O_EXCL is atomic; a stale lock from a crashed
// run is reclaimed after 20 minutes (longer than the npm timeout).
const LOCK = path.join(HOME, '.cache/ruvnet-brain/stack-sync.lock');
function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  try {
    fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: Date.now() }), { flag: 'wx' });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let held = {};
    try { held = JSON.parse(fs.readFileSync(LOCK, 'utf8')); } catch { /* unparseable = stale */ }
    const ageMin = (Date.now() - (held.at ?? 0)) / 60000;
    if (ageMin < 20) {
      die(`another stack-sync is running (pid ${held.pid}, started ${ageMin.toFixed(1)}m ago).\n` +
          `   Refusing to run two installers at once — that is how packages get half-written.`);
    }
    fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: Date.now() }));
  }
  const release = () => { try { fs.unlinkSync(LOCK); } catch { /* already gone */ } };
  process.on('exit', release);
  process.on('SIGINT', () => { release(); process.exit(130); });
  process.on('SIGTERM', () => { release(); process.exit(143); });
}

function sync({ dryRun = false } = {}) {
  if (!dryRun) acquireLock();
  const a = audit();
  const { behind, broken, stale } = report(a);
  const toInstall = [...behind, ...broken.filter((r) => r.target)].map((r) => `${r.name}@${r.target}`);

  if (!toInstall.length && !stale.length) {
    log('  one copy of everything, all current, no shadows. Nothing to do.');
    writeReceipt(a, [], []);
    return;
  }
  if (dryRun) {
    if (toInstall.length) log(`  would install: ${toInstall.join(' ')}`);
    if (stale.length) log(`  would purge ${stale.length} stale npx shadow(s)`);
    return;
  }

  // INSTALL FIRST, PURGE SECOND. (Adversarial review, 2026-07-14.) The first version purged the
  // shadows before installing — so a failed install left the user with their shadows gone AND the
  // global not yet fixed: strictly WORSE than when they started, with no way back. A repair step
  // that can leave you worse off than not running it is not a repair.
  if (toInstall.length) {
    log(`  installing: ${toInstall.join(' ')}`);
    const r = spawnSync('npm', ['install', '-g', '--prefix', PREFIX, ...toInstall],
      { stdio: 'inherit', timeout: 15 * 60 * 1000 });
    if (r.status !== 0) die(`npm install -g exited ${r.status}; the stack is NOT synced. Shadows left untouched.`);
  }

  const purged = [];
  for (const s of stale) {
    // Purge the whole npx dir: it is a disposable resolution cache (npm re-creates it on demand),
    // and a mixed-version dir is exactly how a stale transitive copy survives a targeted delete.
    try { fs.rmSync(s.dir, { recursive: true, force: true }); purged.push(`${s.name}@${s.version}`); } catch { /* best effort */ }
  }
  if (purged.length) log(`  purged ${purged.length} stale shadow(s): ${purged.join(', ')}`);

  // VERIFY AGAINST THE DISK. An installer that trusts its own exit code is a hope, not a guarantee:
  // the old nightly printed "auto-update finished cleanly" from npm's status alone, which is exactly
  // how a stack rots while every log line insists it is healthy.
  const wrong = [];
  for (const r of [...behind, ...broken]) {
    if (!r.target) continue;
    const now = installedVersion(r.name);
    if (now !== r.target) wrong.push(`${r.name}: expected ${r.target}, disk says ${now ?? 'MISSING'}`);
  }
  if (wrong.length) die(`npm reported success but THE DISK DISAGREES:\n   - ${wrong.join('\n   - ')}`);

  writeReceipt(audit(), toInstall, purged);
  log(`\n  synced ${toInstall.length} package(s); purged ${purged.length} shadow(s); verified against disk.`);
}

// Importable as a module by the tests; only acts when run as a CLI.
if (process.argv[1] && path.resolve(process.argv[1]).endsWith('stack-sync.mjs')) {
  const args = process.argv.slice(2);
  if (args.includes('--audit')) {
    const a = audit();
    const { behind, broken, stale } = report(a);
    // UNRESOLVED counts as drift, not as health: a package we could not measure is a package we
    // cannot vouch for. Reporting "current" for something we never checked is the lie this tool exists to stop.
    const unres = a.unresolved.length;
    const bad = behind.length + broken.length + stale.length + unres;
    if (bad) {
      log(`  DRIFT: ${behind.length} behind, ${broken.length} broken, ${stale.length} stale shadow(s)` +
          (unres ? `, ${unres} UNMEASURED (registry unreachable)` : '') + '.');
      log(`  Fix:   node scripts/stack-sync.mjs --sync\n`);
      process.exit(1); // non-zero: a watchdog must never call a drifted stack "green"
    }
    log('  one copy of everything, all current, no shadows.\n');
  } else if (args.includes('--sync')) {
    sync({ dryRun: args.includes('--dry-run') });
  } else {
    log(`
  stack-sync — one global copy of the RuvNet stack. Correct. Provable.

    --audit     report drift; exit 1 if anything is behind, broken, or shadowed
    --sync      install what is BEHIND (never downgrades), purge npx shadows, verify against disk
    --dry-run   with --sync: say what it would do, change nothing

  Tag policy: ${JSON.stringify(TAG_POLICY)}; everything else @${DEFAULT_TAG}
  Receipt:    ${RECEIPT}
`);
  }
}
