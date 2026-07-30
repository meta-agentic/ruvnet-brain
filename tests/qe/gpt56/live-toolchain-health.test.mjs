import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIVE = process.env.RUVNET_QE_LIVE === '1';
const RUFLO = process.env.RUFLO_BIN || path.join(os.homedir(), '.npm-global', 'bin', 'ruflo');
const AQE = process.env.AGENTIC_QE_BIN || path.join(os.homedir(), '.npm-global', 'bin', 'agentic-qe');
let base;
let projectA;
let projectB;

function run(file, argv, options = {}) {
  return spawnSync(file, argv, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    timeout: options.timeout ?? 180_000,
  });
}

function substantive(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

describe.skipIf(!LIVE)('live RuvNet QE toolchain — substantive health, not exit-code health', () => {
  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'ruvnet-qe-live-'));
    projectA = path.join(base, 'project-a');
    projectB = path.join(base, 'project-b');
    fs.mkdirSync(projectA);
    fs.mkdirSync(projectB);
  });

  afterAll(() => {
    for (const project of [projectA, projectB]) {
      if (project && fs.existsSync(project) && fs.existsSync(RUFLO)) {
        run(RUFLO, ['daemon', 'stop', '--quiet'], { cwd: project, timeout: 30_000 });
      }
    }
    if (base) fs.rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it('Agentic-QE initializes its real memory manager and does not false-green an ABI failure', () => {
    expect(fs.existsSync(AQE), `Agentic-QE is not installed at ${AQE}`).toBe(true);
    const result = run(AQE, ['health', '--format', 'json'], { cwd: projectA });
    const output = substantive(result);

    expect(result.status, output).toBe(0);
    expect(output).not.toMatch(/Failed to (?:auto-)?initialize/i);
    expect(output).not.toMatch(/NODE_MODULE_VERSION|different Node\.js version|better_sqlite3\.node/i);
    expect(output).not.toMatch(/Try running `?aqe init`? manually/i);
    expect(output.trim().length).toBeGreaterThan(2);
  }, 180_000);

  it('the global Ruflo stores and searches in the actual per-project AgentDB path', () => {
    expect(fs.existsSync(RUFLO), `global Ruflo is not installed at ${RUFLO}`).toBe(true);
    const db = path.join(projectA, '.swarm', 'memory.db');
    const marker = `qe-project-a-${Date.now()}-${process.pid}`;

    const init = run(RUFLO, ['memory', 'init', '--path', db, '--backend', 'hybrid'], { cwd: projectA });
    expect(init.status, substantive(init)).toBe(0);
    const store = run(RUFLO, [
      'memory', 'store',
      '-k', marker,
      '--value', `project A durable marker ${marker}`,
      '-n', 'qe-live',
      '--path', db,
    ], { cwd: projectA });
    expect(store.status, substantive(store)).toBe(0);

    const search = run(RUFLO, [
      'memory', 'search',
      '-q', marker,
      '-n', 'qe-live',
      '-t', 'keyword',
      '--path', db,
    ], { cwd: projectA });
    const output = substantive(search);
    expect(search.status, output).toBe(0);
    expect(output).toMatch(/Found\s+1\s+results?|durable marker|qe-project-a/i);
    expect(output).not.toMatch(/No results found/i);
  }, 240_000);

  it('project B cannot see project A through the default per-project path', () => {
    const dbB = path.join(projectB, '.swarm', 'memory.db');
    const marker = `qe-isolation-${Date.now()}-${process.pid}`;
    const dbA = path.join(projectA, '.swarm', 'memory.db');

    expect(run(RUFLO, ['memory', 'init', '--path', dbB, '--backend', 'hybrid'], { cwd: projectB }).status).toBe(0);
    expect(run(RUFLO, [
      'memory', 'store', '-k', marker, '--value', marker, '-n', 'qe-isolation', '--path', dbA,
    ], { cwd: projectA }).status).toBe(0);

    const defaultSearch = run(RUFLO, [
      'memory', 'search', '-q', marker, '-n', 'qe-isolation', '-t', 'keyword',
    ], { cwd: projectB });
    const output = substantive(defaultSearch);
    expect(defaultSearch.status, output).toBe(0);
    expect(output).toMatch(/(?:No results found|Found 0 result\(s\))/i);
    expect(output).not.toMatch(/\|\s*qe-isolation-|\|\s*[^|]+\|\s*[0-9.]+\s*\|\s*qe-isolation\s*\|/i);
  }, 240_000);
});
