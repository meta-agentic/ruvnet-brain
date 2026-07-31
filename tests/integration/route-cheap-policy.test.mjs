import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'route-cheap.mjs');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(routing) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvb-route-policy-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const config = path.join(root, 'config.json');
  const calls = path.join(root, 'calls.jsonl');
  const binary = path.join(home, '.npm-global', 'bin', 'agentic-flow');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.ROUTE_CALLS, JSON.stringify({
  argv: process.argv.slice(2),
  key: process.env.OPENROUTER_API_KEY || null
}) + '\\n');
console.log('bounded result');
`);
  fs.chmodSync(binary, 0o755);
  fs.writeFileSync(config, JSON.stringify({ routing }));
  return {
    root,
    calls,
    env: {
      ...process.env,
      HOME: home,
      RUVNET_BRAIN_CONFIG_FILE: config,
      RUVNET_SETTINGS_FILE: path.join(root, 'settings.json'),
      RUVNET_BRAIN_PROJECT_SETTINGS_FILE: path.join(root, 'absent-project-settings.json'),
      RUVNET_BRAIN_SECRETS_FILE: path.join(root, 'absent-secrets.json'),
      OPENROUTER_API_KEY: 'sk-or-test-sentinel',
      METAHARNESS_RECEIPTS: path.join(root, 'receipts.jsonl'),
      ROUTE_CALLS: calls,
    },
  };
}

describe('route-cheap runtime policy', () => {
  it('refuses before process creation and leaves no receipt when routing is off', () => {
    const f = fixture('off');
    const run = spawnSync(process.execPath, [SCRIPT, '--task', 'summarize this'], {
      cwd: ROOT,
      env: f.env,
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/routing is off/i);
    expect(fs.existsSync(f.calls)).toBe(false);
    expect(fs.existsSync(f.env.METAHARNESS_RECEIPTS)).toBe(false);
  });

  it('uses the global agentic-flow binary and injects the key only into its child environment', () => {
    const f = fixture('auto');
    const run = spawnSync(process.execPath, [SCRIPT, '--task', 'summarize this'], {
      cwd: ROOT,
      env: f.env,
      encoding: 'utf8',
    });
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain('sk-or-test-sentinel');
    expect(run.stderr).not.toContain('sk-or-test-sentinel');
    const call = JSON.parse(fs.readFileSync(f.calls, 'utf8').trim());
    expect(call.key).toBe('sk-or-test-sentinel');
    expect(call.argv).toContain('summarize this');
    expect(fs.readFileSync(f.env.METAHARNESS_RECEIPTS, 'utf8')).toMatch(/"source":"agentic-flow"/);
  });
});
