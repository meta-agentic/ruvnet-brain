#!/usr/bin/env node
// One detached first-session lifecycle worker: seed the Stable Spine, then perform the update
// heartbeat the seed used to race. Keeping both operations in one worker preserves ADR-054's
// "Brain OFF still receives fixes" contract without making SessionStart launch two detachers.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [updateApply, hostUpdate, versionLog] = process.argv.slice(2);
if (![updateApply, hostUpdate, versionLog].every((value) => typeof value === 'string' && value)) {
  process.stderr.write('usage: first-session-worker.mjs <update-apply.mjs> <host-update.mjs> <version-log>\n');
  process.exit(2);
}

const seed = spawnSync(process.execPath, [updateApply, '--seed'], {
  env: process.env,
  stdio: 'inherit',
});
if (seed.error || seed.status !== 0) {
  process.stderr.write(`[ruvnet-brain] first-session seed failed: ${seed.error?.message || `exit ${seed.status}`}\n`);
  process.exit(1);
}

const check = spawnSync(process.execPath, [hostUpdate, '--check'], {
  env: process.env,
  encoding: 'utf8',
});
const version = String(check.stdout || '').trim();
if (!check.error && check.status === 0 && /^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/.test(version)) {
  fs.mkdirSync(path.dirname(versionLog), { recursive: true });
  const temporary = `${versionLog}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${version}\n`);
  fs.renameSync(temporary, versionLog);
}

// Network failure must not undo a successful seed. The 15-minute heartbeat stamp lets the normal
// SessionStart path retry later, while the current runtime remains valid and usable.
process.exit(0);
