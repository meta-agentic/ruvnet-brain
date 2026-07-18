#!/usr/bin/env node
// hook-shim.mjs — the Stable Spine's hook dispatcher (ADR-023, docs/INTELLIGENT-UPDATING.md §3).
//
// THE ONE JOB: make hook BEHAVIOR update without a Claude Code restart. CC freezes
// ${CLAUDE_PLUGIN_ROOT} at boot (a version-named cache dir), so any hook command pointing there is
// trapped at the boot-time version. This shim is the only thing hooks.json points at; it resolves
// the ACTIVE generation from ~/.cache/ruvnet-brain/active.json ONCE per invocation and executes the
// hook body from that immutable versions/<v>/ tree. Update = rewrite active.json (atomic, by
// scripts/update-apply.mjs) → the very next hook fire runs the new code. No restart.
//
// SHELL CONTRACT (this file is boot-frozen — treat as near-frozen ABI, per DDD-0003):
//   • Self-contained: node:fs/path/child_process only, no imports from the body.
//   • Typed dispatch table (red-team findings 15/16/30): each hook declares its file, interpreter,
//     and mode. `blocking` hooks propagate their exact exit code (route-dispatch's deliberate
//     exit-2 wall survives by CONTRACT); `advisory` hooks can never block a turn — any failure,
//     including a missing file, exits 0.
//   • Containment (finding 13): a codeRoot is honored ONLY if it resolves under
//     ~/.cache/ruvnet-brain/versions/ — or is the explicit dev-mode checkout declared in
//     ~/.cache/ruvnet-brain/dev.json (finding 24).
//   • Loud fallback (finding 25): no spine / broken spine / missing body file → run the sibling in
//     ${CLAUDE_PLUGIN_ROOT} AND emit one stderr line naming the frozen fallback, so a broken spine
//     can never masquerade as health. First-install (spine never seeded) stays quiet.
//   • Per-invocation consistency (finding 14, accepted middle): active.json is read once; the whole
//     invocation runs from one immutable tree — a hook never straddles two generations.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const BRAIN_HOME = process.env.RUVNET_BRAIN_HOME || path.join(os.homedir(), '.cache', 'ruvnet-brain');
const ACTIVE = path.join(BRAIN_HOME, 'active.json');
const DEV = path.join(BRAIN_HOME, 'dev.json');
const VERSIONS = path.join(BRAIN_HOME, 'versions');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// The dispatch table — hook id → { file (relative to <codeRoot>/plugin/scripts), interpreter, mode }.
// Adding a hook here is a SHELL change (requiresRestart); changing a hook's BODY never is.
const TABLE = {
  'session-start':    { file: 'session-start.sh',    interpreter: 'bash', mode: 'advisory' },
  'ground-ruvnet':    { file: 'ground-ruvnet.sh',    interpreter: 'bash', mode: 'advisory' },
  'hijack-ruvnet':    { file: 'hijack-ruvnet.sh',    interpreter: 'bash', mode: 'advisory' },
  'route-dispatch':   { file: 'route-dispatch.sh',   interpreter: 'bash', mode: 'blocking' },
  'verify-interface': { file: 'verify-interface.sh', interpreter: 'bash', mode: 'blocking' },
  'design-wall':      { file: 'design-wall.sh',      interpreter: 'bash', mode: 'blocking' },
  'learn-capture':    { file: 'learn-capture.sh',    interpreter: 'bash', mode: 'advisory' },
  'learn-flush':      { file: 'learn-flush.mjs',     interpreter: 'node', mode: 'advisory' },
};

const hookId = process.argv[2];
const entry = TABLE[hookId];
if (!entry) {
  process.stderr.write(`[hook-shim] unknown hook id: ${JSON.stringify(hookId)} — known: ${Object.keys(TABLE).join(', ')}\n`);
  process.exit(0); // an unknown id is a shell bug, but it must never block the user's turn
}

/** Resolve the active code root. Returns { root, source } or null (→ fallback). */
function resolveCodeRoot() {
  // Dev mode wins when explicitly declared and the target still looks like the checkout it names.
  try {
    const dev = JSON.parse(fs.readFileSync(DEV, 'utf8'));
    if (dev && dev.codeRoot && fs.existsSync(path.join(dev.codeRoot, 'scripts'))) {
      return { root: dev.codeRoot, source: 'dev' };
    }
  } catch { /* no dev mode */ }
  try {
    const active = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
    if (!active || typeof active.codeRoot !== 'string') return null;
    const root = path.isAbsolute(active.codeRoot) ? active.codeRoot : path.join(BRAIN_HOME, active.codeRoot);
    const real = fs.realpathSync(root);
    // Containment: only ever execute from the immutable version store.
    if (!real.startsWith(fs.realpathSync(VERSIONS) + path.sep)) return null;
    return { root: real, source: `gen ${active.generation ?? '?'}` };
  } catch { return null; }
}

// Run one hook body. No shell is ever involved: spawnSync with an argument array, interpreter
// chosen from the typed table — never from input.
function runHook(file) {
  if (!fs.existsSync(file)) return 0; // nothing to run — never invent a failure
  const cmd = entry.interpreter === 'node' ? process.execPath : '/bin/bash';
  const r = spawnSync(cmd, [file], { stdio: 'inherit', env: process.env });
  if (r.error) {
    process.stderr.write(`[hook-shim] ${entry.file}: ${r.error.message}\n`);
    return entry.mode === 'blocking' ? 1 : 0;
  }
  // Blocking hooks: the exit code IS the contract (route-dispatch's exit-2 wall). Advisory: always 0.
  return entry.mode === 'blocking' ? (r.status ?? 0) : 0;
}

const FALLBACK_FILE = path.join(PLUGIN_ROOT, 'scripts', entry.file);
const spine = resolveCodeRoot();
if (spine) {
  // codeRoot IS a plugin-payload root (versions/<v>/ mirrors the plugin dir: scripts/, hooks/, mcp/).
  const spineFile = path.join(spine.root, 'scripts', entry.file);
  if (fs.existsSync(spineFile)) {
    process.exit(runHook(spineFile));
  }
  // Spine resolved but the body file is missing — fall back LOUDLY (finding 25).
  process.stderr.write(`[hook-shim] spine (${spine.source}) missing ${entry.file} — falling back to frozen plugin\n`);
  process.exit(runHook(FALLBACK_FILE));
} else {
  // No spine at all. First-install is the normal quiet case; a previously-seeded-but-broken spine
  // still lands here — the seed marker distinguishes them so breakage is loud, first-run silent.
  if (fs.existsSync(path.join(BRAIN_HOME, '.spine-seeded'))) {
    process.stderr.write(`[hook-shim] spine unreadable — running frozen plugin fallback (run: node scripts/update-apply.mjs --doctor)\n`);
  }
  process.exit(runHook(FALLBACK_FILE));
}
