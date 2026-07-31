import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const HOOK = path.join(ROOT, 'plugin/scripts/ground-ruvnet.sh');
const temporary = [];

afterEach(() => {
  for (const dir of temporary.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function temp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

function seedStack(dir) {
  fs.mkdirSync(path.join(dir, '.claude-flow'), { recursive: true });
}

function seedDb(file, minutesOld = 0) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  const when = new Date(Date.now() - minutesOld * 60_000);
  fs.utimesSync(file, when, when);
}

function fire(cwd, home, prompt = 'status') {
  const cache = path.join(home, '.cache', 'ruvnet-brain');
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, '.stack-versions-checked'), new Date().toISOString());
  return spawnSync('bash', [HOOK], {
    cwd,
    encoding: 'utf8',
    input: JSON.stringify({ prompt }),
    env: {
      ...process.env,
      HOME: home,
      RUVNET_BRAIN_HOME: cache,
      RUVNET_BRAIN_METER: '0',
      RUVNET_BRAIN_OFF: '0',
    },
  });
}

describe('issue #66 — memory detection uses every legitimate store', () => {
  it('accepts a fresh home AgentDB store from a project subdirectory', () => {
    const home = temp('rvb-66-home-');
    const project = temp('rvb-66-project-');
    seedStack(project);
    seedDb(path.join(home, '.swarm', 'memory.db'));

    const result = fire(project, home);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('persistent project memory is NOT set up');
    expect(result.stdout).not.toContain('has NOT been written in over 90 minutes');
  });

  it('does not let a stale local store shadow a fresh home store', () => {
    const home = temp('rvb-66-home-');
    const project = temp('rvb-66-project-');
    seedStack(project);
    seedDb(path.join(project, '.swarm', 'memory.db'), 120);
    seedDb(path.join(home, '.swarm', 'agentdb-memory.db'));

    const result = fire(project, home);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('persistent project memory is NOT set up');
    expect(result.stdout).not.toContain('has NOT been written in over 90 minutes');
  });

  it('stays silent for a stale store instead of interrupting an unrelated prompt', () => {
    const home = temp('rvb-66-home-');
    const project = temp('rvb-66-project-');
    seedStack(project);
    seedDb(path.join(project, '.swarm', 'memory.db'), 120);

    const result = fire(project, home);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('has NOT been written in over 90 minutes');
    expect(result.stdout).not.toContain('memory hooks may be miswired');
  });

  it('still reports absence when no legitimate store exists', () => {
    const home = temp('rvb-66-home-');
    const project = temp('rvb-66-project-');
    seedStack(project);

    const result = fire(project, home);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('persistent project memory is NOT set up');
  });

  it('injects the exact-path write-proof contract on a memory diagnosis turn', () => {
    const home = temp('rvb-66-home-');
    const project = temp('rvb-66-project-');
    seedStack(project);
    seedDb(path.join(project, '.swarm', 'memory.db'));

    const result = fire(project, home, 'Why is ruflo memory store not capturing this session?');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ruflo memory store --path <project>/.swarm/memory.db');
    expect(result.stdout).toContain('exact-key `ruflo memory retrieve --path ...`');
    expect(result.stdout).toContain('never infer a broken write from DB/WAL mtime, semantic-search misses, daemon startup');
  });
});
