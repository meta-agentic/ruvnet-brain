import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK = path.join(ROOT, 'scripts', 'git-hooks', 'pre-push');
const temps = [];

afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('pre-push gate worktree routing', () => {
  it('validates the repository being pushed even when the hook file lives in another checkout', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-push-repo-'));
    const foreign = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-push-foreign-'));
    temps.push(repo, foreign);
    const foreignHook = path.join(foreign, 'scripts', 'git-hooks', 'pre-push');
    fs.mkdirSync(path.dirname(foreignHook), { recursive: true });
    fs.copyFileSync(HOOK, foreignHook);
    fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'scripts', 'verify-channels.mjs'),
      'process.stdout.write(`verified:${process.cwd()}`);',
    );
    fs.writeFileSync(path.join(repo, 'scripts', 'doc-currency.mjs'), 'process.exit(0);');

    expect(spawnSync('git', ['init', '-q'], { cwd: repo }).status).toBe(0);
    fs.writeFileSync(path.join(repo, 'tracked.txt'), 'fixture\n');
    expect(spawnSync('git', ['add', 'tracked.txt'], { cwd: repo }).status).toBe(0);
    expect(spawnSync('git', [
      '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
      'commit', '-qm', 'fixture',
    ], { cwd: repo }).status).toBe(0);
    const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
    const result = spawnSync('/bin/sh', [foreignHook], {
      cwd: repo,
      input: `refs/heads/main ${sha} refs/heads/main 0000000000000000000000000000000000000000\n`,
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`verified:${fs.realpathSync(repo)}`);
  });
});
