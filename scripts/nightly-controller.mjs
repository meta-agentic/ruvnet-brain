// nightly-controller.mjs — a thin adapter around the installer's one scheduler implementation.
//
// It does not write a plist, call launchctl, or invent platform behavior. Both the installer and the
// console reach the same `bin/install.mjs --enable-nightly/--disable-nightly` door; this adapter only
// supplies structured status and captures its exit result for the console.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');
const LABEL = 'com.ruvnet.brain-update';

export function nightlyArtifact({ env = process.env, platform = process.platform } = {}) {
  const home = env.HOME || os.homedir();
  return {
    supported: platform === 'darwin',
    platform,
    path: path.join(home, 'Library', 'LaunchAgents', `${LABEL}.plist`),
    label: LABEL,
  };
}

export function nightlyStatus(options = {}) {
  const artifact = nightlyArtifact(options);
  if (!artifact.supported) {
    return { state: 'unsupported', evidence: `No reversible scheduler adapter is implemented for ${artifact.platform}.`, artifact };
  }
  const present = fs.existsSync(artifact.path);
  return {
    state: present ? 'on' : 'off',
    evidence: present ? `LaunchAgent plist exists at ${artifact.path}` : `No LaunchAgent plist at ${artifact.path}`,
    artifact,
  };
}

export function applyNightlyChoice(enabled, options = {}) {
  if (typeof enabled !== 'boolean') return { ok: false, log: 'nightly must be true or false' };
  const env = options.env || process.env;
  const before = nightlyStatus({ ...options, env });
  if (!before.artifact.supported) return { ok: false, state: before, log: before.evidence };
  const run = spawnSync(process.execPath, [
    options.installer || INSTALLER,
    enabled ? '--enable-nightly' : '--disable-nightly',
  ], {
    env: { ...env, RUVNET_BRAIN_IMPORT_ONLY: '0' },
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeout || 30_000,
  });
  const after = nightlyStatus({ ...options, env });
  const desired = enabled ? 'on' : 'off';
  const ok = !run.error && run.status === 0 && after.state === desired;
  return {
    ok,
    before,
    after,
    log: ok
      ? `Nightly refresh is ${desired}; verified from ${after.artifact.path}.`
      : `Nightly refresh did not reach ${desired}: ${run.error?.message || run.stderr?.trim() || run.stdout?.trim() || `exit ${run.status}`}`,
  };
}
