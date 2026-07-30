import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const ENGINE = path.join(ROOT, 'plugin/scripts/update-apply.mjs');
const cleanup = [];

afterEach(() => {
  for (const item of cleanup.splice(0)) fs.rmSync(item, { recursive: true, force: true });
});

function payload(version, marker) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-release-payload-'));
  cleanup.push(dir);
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts/runtime.mjs'), `export default ${JSON.stringify(marker)};\n`);
  fs.writeFileSync(path.join(dir, 'hooks/hooks.json'), '{"hooks":{}}\n');
  fs.writeFileSync(path.join(dir, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'ruvnet-brain', version }));
  return dir;
}

function run(home, ...args) {
  return spawnSync(process.execPath, [ENGINE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, RUVNET_BRAIN_HOME: home, CLAUDE_PLUGIN_ROOT: '' },
  });
}

const state = (home) => JSON.parse(fs.readFileSync(path.join(home, 'active.json'), 'utf8'));

describe('stale active installs, retries, and rollback', () => {
  it('replaces a stale active generation, retries idempotently, then rolls back safely', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-release-home-'));
    cleanup.push(home);
    const oldPayload = payload('old-fixture', 'old');
    const newPayload = payload('new-fixture', 'new');

    expect(run(home, '--from-dir', oldPayload).status).toBe(0);
    expect(state(home).version).toBe('old-fixture');
    expect(run(home, '--from-dir', newPayload).status).toBe(0);
    expect(state(home).version).toBe('new-fixture');

    const retry = run(home, '--from-dir', newPayload);
    expect(retry.status).toBe(0);
    expect(state(home).version).toBe('new-fixture');
    expect(fs.existsSync(path.join(home, state(home).codeRoot, 'scripts/runtime.mjs'))).toBe(true);

    expect(run(home, '--rollback').status).toBe(0);
    expect(state(home).version).toBe('old-fixture');
    expect(state(home).previous.version).toBe('new-fixture');
  });

  it('a failed candidate preserves the currently active install', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-release-home-'));
    cleanup.push(home);
    const good = payload('good-fixture', 'good');
    const bad = payload('bad-fixture', 'bad');
    fs.writeFileSync(path.join(bad, 'scripts/broken.mjs'), 'const = invalid(\n');

    expect(run(home, '--from-dir', good).status).toBe(0);
    const before = state(home);
    expect(run(home, '--from-dir', bad).status).not.toBe(0);
    expect(state(home)).toEqual(before);
  });

  it('rejects different bytes that reuse the active version', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-release-home-'));
    cleanup.push(home);
    const first = payload('collision-fixture', 'original');
    const collision = payload('collision-fixture', 'different');

    expect(run(home, '--from-dir', first).status).toBe(0);
    const before = state(home);
    const retried = run(home, '--from-dir', collision);
    expect(retried.status).not.toBe(0);
    expect(retried.stdout + retried.stderr).toMatch(/same version|different bytes|collision/i);
    expect(state(home)).toEqual(before);
  });
});
