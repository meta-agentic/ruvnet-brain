#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const brainHome = process.env.RUVNET_BRAIN_HOME || path.join(os.homedir(), '.cache', 'ruvnet-brain');
const versions = path.join(brainHome, 'versions');

function activeRoot() {
  try {
    const active = JSON.parse(fs.readFileSync(path.join(brainHome, 'active.json'), 'utf8'));
    if (!active || typeof active.codeRoot !== 'string') return null;
    const candidate = path.isAbsolute(active.codeRoot)
      ? active.codeRoot
      : path.join(brainHome, active.codeRoot);
    const real = fs.realpathSync(candidate);
    const versionsReal = fs.realpathSync(versions);
    return real.startsWith(`${versionsReal}${path.sep}`) ? real : null;
  } catch {
    return null;
  }
}

const input = fs.readFileSync(0);
const root = activeRoot();
const adapter = root && path.join(root, 'scripts', 'codex-hook-adapter.mjs');
if (!adapter || !fs.existsSync(adapter)) process.exit(0);

const result = spawnSync(process.execPath, [adapter, ...process.argv.slice(2)], {
  input,
  encoding: 'utf8',
  env: process.env,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 0);
