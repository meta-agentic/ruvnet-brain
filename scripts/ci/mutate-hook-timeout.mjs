#!/usr/bin/env node
// scripts/ci/mutate-hook-timeout.mjs — M-D8c (ADR-058 §D8): register ONE additional hook in the
// PACKED, INSTALLED hooks.json whose body sleeps past its declared timeout, then run
// `--doctor --hooks` again against the SAME installed surface and assert the battery goes RED.
// Proves the hook-FIRE assertion is real (a genuine watchdog catch), not manifest-present —
// tests/integration/install-smoke.mjs's own `--doctor --hooks goes RED when a registered hook
// sleeps past its declared timeout` test is the fast local rehearsal of this exact mechanism
// against a synthetic surface; this runs it against the REAL packed-and-installed plugin tree a
// stranger's machine actually has, right after the `healthy` scenario's install.
//
//   node scripts/ci/mutate-hook-timeout.mjs --installed <dir> --home <dir>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; };
const INSTALLED = arg('--installed');
const HOME_DIR = arg('--home'); // the SAME home the `healthy` scenario already installed into

if (!INSTALLED || !HOME_DIR) {
  console.error('usage: node mutate-hook-timeout.mjs --installed <dir> --home <dir>');
  process.exit(2);
}

const pluginRoot = path.join(HOME_DIR, '.claude', 'plugins', 'marketplaces', 'ruvnet-brain', 'plugin');
const hooksFile = path.join(pluginRoot, 'hooks', 'hooks.json');
if (!fs.existsSync(hooksFile)) {
  console.error(`[mutate-hook-timeout] FAIL: no installed hooks.json at ${hooksFile} — run the healthy scenario first`);
  process.exit(1);
}

// The REAL held-open-stdin hang fixture this repo already uses to prove the watchdog
// (tests/fixtures/selfcheck-hooks/hang.mjs) — a synchronous stdin read freezes the event loop, so
// only an EXTERNAL watchdog (never an in-process timer) can catch it.
fs.copyFileSync(
  path.join(REPO_ROOT, 'tests', 'fixtures', 'selfcheck-hooks', 'hang.mjs'),
  path.join(pluginRoot, 'scripts', 'ci-hang-fixture.mjs'),
);

const doc = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
doc.hooks ??= {};
doc.hooks.UserPromptSubmit ??= [];
doc.hooks.UserPromptSubmit.push({
  matcher: '*',
  hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/ci-hang-fixture.mjs"', timeout: 1 }],
});
fs.writeFileSync(hooksFile, JSON.stringify(doc, null, 2));
console.log(`[mutate-hook-timeout] registered a 1s-timeout sleeping hook in ${hooksFile}`);

const r = spawnSync(process.execPath, [path.join(INSTALLED, 'bin', 'install.mjs'), '--doctor', '--hooks'], {
  env: { ...process.env, HOME: HOME_DIR, USERPROFILE: HOME_DIR, RUVNET_BRAIN_TEST: '1' },
  input: '',
  encoding: 'utf8',
  timeout: 120_000,
});
console.log(r.stdout);
if (r.stderr) console.error(r.stderr);

if (r.status === 0) {
  console.error('[mutate-hook-timeout] FAIL: expected --doctor --hooks to go RED with a sleeping hook registered, got exit 0');
  process.exit(1);
}
if (!/\bhang\b/.test(r.stdout || '')) {
  console.error('[mutate-hook-timeout] FAIL: exited non-zero, but no "hang" violation was named — some OTHER check may have failed instead');
  process.exit(1);
}
console.log(`[mutate-hook-timeout] PASS — the battery went RED (exit ${r.status}) with a real "hang" violation`);
