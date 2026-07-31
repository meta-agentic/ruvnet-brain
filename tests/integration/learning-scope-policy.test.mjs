import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CAPTURE = path.join(ROOT, 'plugin', 'scripts', 'learn-capture.sh');
const FLUSH = path.join(ROOT, 'plugin', 'scripts', 'learn-flush.mjs');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvb-learning-scope-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const ruflo = path.join(home, '.npm-global', 'bin', 'ruflo');
  const calls = path.join(root, 'ruflo-calls.jsonl');
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.dirname(ruflo), { recursive: true });
  fs.writeFileSync(ruflo, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.LEARNING_CALLS, JSON.stringify({
  cwd: process.cwd(),
  argv: process.argv.slice(2),
  daemonAutostart: process.env.RUFLO_DAEMON_AUTOSTART
}) + '\\n');
`);
  fs.chmodSync(ruflo, 0o755);
  return {
    root,
    home,
    project,
    calls,
    env: {
      ...process.env,
      HOME: home,
      LEARNING_CALLS: calls,
      RUVNET_BRAIN_PROJECT_DIR: project,
    },
  };
}

const payload = JSON.stringify({
  session_id: 'scope-test',
  tool_name: 'Bash',
  tool_input: { command: 'npm test' },
});

function capture(f, scope) {
  return spawnSync('bash', [CAPTURE], {
    cwd: f.project,
    env: { ...f.env, RUVNET_LEARNING_SCOPE: scope },
    input: payload,
    encoding: 'utf8',
  });
}

describe('learningScope drives the real capture and Ruflo flush paths', () => {
  it('off writes zero bytes', () => {
    const f = fixture();
    expect(capture(f, 'off').status).toBe(0);
    expect(fs.existsSync(path.join(f.project, '.swarm'))).toBe(false);
    expect(fs.existsSync(path.join(f.home, '.cache', 'ruvnet-brain', 'learn'))).toBe(false);
  });

  it('project queues under .swarm and flushes Ruflo with the project cwd', () => {
    const f = fixture();
    expect(capture(f, 'project').status).toBe(0);
    const queue = path.join(f.project, '.swarm', 'ruvnet-brain-learn', 'session-scope-test.jsonl');
    expect(fs.existsSync(queue)).toBe(true);
    const flush = spawnSync(process.execPath, [FLUSH, '--sync'], {
      cwd: f.project,
      env: { ...f.env, RUVNET_LEARNING_SCOPE: 'project' },
      input: payload,
      encoding: 'utf8',
    });
    expect(flush.status).toBe(0);
    const call = JSON.parse(fs.readFileSync(f.calls, 'utf8').trim());
    expect(fs.realpathSync(call.cwd)).toBe(fs.realpathSync(f.project));
    expect(call.argv.slice(0, 2)).toEqual(['hooks', 'post-command']);
    expect(call.daemonAutostart).toBe('0');
  });

  it('user retains the cross-project queue and HOME-scoped Ruflo learner', () => {
    const f = fixture();
    expect(capture(f, 'user').status).toBe(0);
    const queue = path.join(f.home, '.cache', 'ruvnet-brain', 'learn', 'session-scope-test.jsonl');
    expect(fs.existsSync(queue)).toBe(true);
    const flush = spawnSync(process.execPath, [FLUSH, '--sync'], {
      cwd: f.project,
      env: { ...f.env, RUVNET_LEARNING_SCOPE: 'user' },
      input: payload,
      encoding: 'utf8',
    });
    expect(flush.status).toBe(0);
    const call = JSON.parse(fs.readFileSync(f.calls, 'utf8').trim());
    expect(fs.realpathSync(call.cwd)).toBe(fs.realpathSync(f.home));
    expect(call.daemonAutostart).toBe('0');
  });
});
