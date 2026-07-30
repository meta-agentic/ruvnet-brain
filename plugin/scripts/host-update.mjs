#!/usr/bin/env node
// Host-neutral automatic updater. The published installer is the single coordinator for Claude
// Code and Codex, so lifecycle updates cannot drift into host-specific shell pipelines again.
import { spawnSync } from 'node:child_process';

const CHILD_ENV_KEYS = new Set([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL',
  'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA',
  'TEMP', 'TMP', 'TMPDIR', 'SystemRoot', 'ComSpec', 'PATHEXT',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'NO_COLOR', 'FORCE_COLOR',
  'CODEX_HOME', 'CLAUDE_CONFIG_DIR',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
  'RUVNET_BRAIN_HOME', 'RUVNET_BRAIN_KB', 'RUVNET_BRAIN_MODEL_CACHE',
  'RUVNET_BRAIN_NO_UPDATE_FALLBACK', 'RUVNET_BRAIN_TEST',
]);

export function childEnvironment(source = process.env) {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => CHILD_ENV_KEYS.has(key)),
  );
}

if (process.argv.includes('--check')) {
  try {
    const response = await fetch('https://registry.npmjs.org/ruvnet-brain/latest', {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) process.exit(1);
    const metadata = await response.json();
    if (typeof metadata.version !== 'string' || !metadata.version) process.exit(1);
    process.stdout.write(`${metadata.version}\n`);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, [
  '--yes',
  'ruvnet-brain@latest',
  '--update',
  '--no-nightly-prompt',
], {
  // The downloaded package must not inherit unrelated API keys, cloud credentials, or tokens from
  // the interactive host. npm's registry integrity protects the package bytes; this boundary
  // limits what those bytes can observe when they execute.
  env: childEnvironment(),
  stdio: 'inherit',
  timeout: Number(process.env.RUVNET_HOST_UPDATE_TIMEOUT_MS || 9 * 60_000),
});

if (result.error) {
  process.stderr.write(`[ruvnet-brain] host update failed: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
