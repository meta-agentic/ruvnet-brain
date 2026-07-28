#!/usr/bin/env node
// scripts/ci/stranger-scenario.mjs — the shared driver behind .github/workflows/stranger-matrix.yml
// (ADR-058 §D8). ONE portable script so all five images (ubuntu, windows Git-Bash, windows
// PowerShell, macos, hostile container) run the IDENTICAL scenario logic — only the zip/unzip
// mechanics are OS-native (shelled out to per-platform below), matching the reasoning
// scripts/selfcheck.mjs's own header states for shellInvocation(): the platform-specific step is
// isolated to one small, explicit branch rather than duplicated across five YAML files.
//
// Runs against the PACKED, INSTALLED copy — the caller is expected to have already run
// `npm pack` + `npm install <tarball>` and pass --installed pointing at
// <scratch>/node_modules/ruvnet-brain. This script never touches the checkout's own bin/install.mjs
// (the whole point of D8: never install from the checkout, the checkout is the thing that always
// works and is why #42/#43 shipped broken).
//
// SCENARIOS:
//   healthy           — a complete fixture bundle. Asserts exit 0, then runs --doctor --hooks and
//                        asserts AT LEAST ONE hook fired through the INSTALLED registration, and
//                        that no author-local ~/.claude/settings.json exists in this virgin image.
//   seeded-broken     — forge-mcp-all.mjs deleted from the fixture (M-D8a). Asserts exit NON-ZERO.
//   strict-ungrounded — a healthy-shaped fixture (already never ships forge-ask-all.mjs — see
//                        buildKbFixture below) with RUVNET_STRICT_INSTALL=1: grounding can never be
//                        proven in this hermetic run, and strict mode makes that FATAL. Asserts
//                        exit NON-ZERO — proving the strict path is real even though it is never the
//                        default (the SAME fixture, no strict flag, is the `healthy` scenario above
//                        and stays exit 0).
//
// Usage:
//   node scripts/ci/stranger-scenario.mjs --scenario <name> --installed <dir> --home <dir> --plugin-src <dir>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (flag, def = null) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const SCENARIO = arg('--scenario');
const INSTALLED = arg('--installed'); // <scratch>/node_modules/ruvnet-brain
const HOME_DIR = arg('--home'); // virgin HOME for this run
const PLUGIN_SRC = arg('--plugin-src'); // the checkout's plugin/ dir, at the candidate SHA

if (!SCENARIO || !INSTALLED || !HOME_DIR || !PLUGIN_SRC) {
  console.error('usage: node stranger-scenario.mjs --scenario <healthy|seeded-broken|strict-ungrounded> --installed <dir> --home <dir> --plugin-src <dir>');
  process.exit(2);
}

function log(msg) { console.log(`[stranger-scenario:${SCENARIO}] ${msg}`); }
function fail(msg) { console.error(`[stranger-scenario:${SCENARIO}] FAIL: ${msg}`); process.exit(1); }

/**
 * PATH with every directory holding a `ruflo`/`claude-flow`/`claude` executable removed — same
 * safety net tests/mutation/install-selfcheck-consumption-mutation.test.mjs uses (bin/install.mjs's
 * OWN detectEnvironment() checks `have('ruflo') || have('claude-flow')` for the exact same tools —
 * confirmed live via search_ruvnet: rUv's published orchestration CLI ships bins `claude-flow`,
 * `cli`, `claude-flow-mcp` from the `claude-flow` / `@claude-flow/cli` npm packages), so a developer
 * reproducing a CI failure locally does not risk their own machine's real Claude Code plugin
 * marketplace or a real orchestration binary. On a hosted CI runner these binaries are already
 * absent, so this is a no-op there.
 */
function safePath() {
  const sep = path.delimiter;
  const risky = ['claude', 'ruflo', 'claude-flow'];
  return (process.env.PATH || '').split(sep).filter((dir) => {
    if (!dir) return true;
    try { return !risky.some((exe) => fs.existsSync(path.join(dir, exe))); } catch { return true; }
  }).join(sep);
}

/** One top-level `ruvnet-brain/` dir zipped natively per platform (unzipInto()'s expected shape). */
function zipDir(stageParent, destZip) {
  if (process.platform === 'win32') {
    const cmd = `Compress-Archive -Path (Join-Path '${stageParent}' 'ruvnet-brain') -DestinationPath '${destZip}' -Force`;
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd]);
  } else {
    execFileSync('zip', ['-q', '-r', destZip, 'ruvnet-brain'], { cwd: stageParent });
  }
}

function buildKbFixture({ dropMcp, noRvf }) {
  const stageParent = fs.mkdtempSync(path.join(os.tmpdir(), 'stranger-kb-stage-'));
  const root = path.join(stageParent, 'ruvnet-brain');
  const args = [path.join(REPO_ROOT, 'scripts', 'ci', 'build-fixture-kb.mjs'), '--out', root];
  if (dropMcp) args.push('--drop-mcp');
  if (noRvf) args.push('--no-rvf');
  execFileSync(process.execPath, args, { stdio: 'inherit' });
  const zipPath = path.join(stageParent, 'ruvnet-brain.zip');
  zipDir(stageParent, zipPath);
  return zipPath;
}

/**
 * Marketplace-clone-shaped plugin surface, the REAL plugin/ tree at the candidate SHA — never a
 * synthetic fixture — so "at least one hook fired" is a real, meaningful registration.
 */
function seedPluginSurface() {
  const dest = path.join(HOME_DIR, '.claude', 'plugins', 'marketplaces', 'ruvnet-brain', 'plugin');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(PLUGIN_SRC, dest, { recursive: true });
  return dest;
}

function runInstaller(args, extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(INSTALLED, 'bin', 'install.mjs'), ...args], {
    env: {
      ...process.env,
      PATH: safePath(),
      HOME: HOME_DIR,
      USERPROFILE: HOME_DIR,
      RUVNET_BRAIN_TEST: '1',
      ...extraEnv,
    },
    input: '',
    encoding: 'utf8',
    timeout: 120_000,
  });
}

fs.mkdirSync(HOME_DIR, { recursive: true });
seedPluginSurface();

const authorSettings = path.join(HOME_DIR, '.claude', 'settings.json');
if (fs.existsSync(authorSettings)) fail(`author-local settings.json must not exist in a virgin image: ${authorSettings}`);

const dropMcp = SCENARIO === 'seeded-broken';
const zipPath = buildKbFixture({ dropMcp, noRvf: false });
fs.mkdirSync(path.join(INSTALLED, 'dist'), { recursive: true });
fs.copyFileSync(zipPath, path.join(INSTALLED, 'dist', 'ruvnet-brain.zip'));

const strictEnv = SCENARIO === 'strict-ungrounded' ? { RUVNET_STRICT_INSTALL: '1' } : {};
const install = runInstaller(
  ['--local', '--no-stack', '--no-enhance', '--no-statusline', '--no-telemetry', '--no-nightly-prompt'],
  strictEnv,
);
log(`install exit code: ${install.status}`);
console.log(install.stdout);
if (install.stderr) console.error(install.stderr);

if (SCENARIO === 'healthy') {
  if (install.status !== 0) fail(`expected exit 0 on a healthy install, got ${install.status}`);

  const doctor = runInstaller(['--doctor', '--hooks']);
  console.log(doctor.stdout);
  if (doctor.stderr) console.error(doctor.stderr);
  if (doctor.status !== 0) fail(`expected --doctor --hooks to pass on the same healthy install, got exit ${doctor.status}`);
  const firingsMatch = /registrations from marketplace-clone,\s*\d+\s*stdin regimes each\s*\((\d+)\s*firings\)/.exec(doctor.stdout || '');
  if (!firingsMatch) fail('--doctor --hooks output did not name the marketplace-clone registration/firing count at all');
  const firings = Number(firingsMatch[1]);
  if (!(firings > 0)) fail(`expected at least one hook FIRING through the installed registration, got ${firings}`);
  log(`OK — ${firings} real hook firing(s) through the installed marketplace-clone registration`);

  if (fs.existsSync(authorSettings)) fail('installer must never create an author-local settings.json in a virgin image');
  log('OK — no author-local ~/.claude/settings.json in this virgin image');
} else {
  // seeded-broken / strict-ungrounded: the whole point is a non-zero exit.
  if (install.status === 0) fail(`expected a NON-ZERO exit for scenario "${SCENARIO}", got 0`);
  log(`OK — exited non-zero (${install.status}) as required for scenario "${SCENARIO}"`);
}

log('PASS');
