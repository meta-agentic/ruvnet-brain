import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PLUGIN = path.join(ROOT, 'plugin');
const CODEX = process.env.RUVNET_CODEX_BIN || 'codex';

function run(home, args) {
  return spawnSync(CODEX, args, {
    cwd: ROOT,
    env: { ...process.env, CODEX_HOME: home },
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 20 * 1024 * 1024,
  });
}

describe('installed Codex skill discovery', () => {
  const available = spawnSync(CODEX, ['--version'], { encoding: 'utf8' }).status === 0;
  const test = available ? it : it.skip;

  test('exposes self-contained native Console and What is New skills through the real plugin loader', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ruvnet-codex-skills-'));
    try {
      const market = run(home, ['plugin', 'marketplace', 'add', PLUGIN, '--json']);
      expect(market.status, market.stderr || market.stdout).toBe(0);
      const install = run(home, ['plugin', 'add', 'ruvnet-brain@ruvnet-brain', '--json']);
      expect(install.status, install.stderr || install.stdout).toBe(0);

      const prompt = run(home, ['debug', 'prompt-input', 'List available Brain skills only.']);
      expect(prompt.status, prompt.stderr || prompt.stdout).toBe(0);
      const rendered = prompt.stdout;

      expect(rendered).toContain('ruvnet-brain:rvbc');
      expect(rendered).toContain('ruvnet-brain:brain-console');
      expect(rendered).toContain('ruvnet-brain:whats-new');
      expect(rendered).toContain('Configure RuvNet Brain');
      expect(rendered).not.toMatch(
        /source-command-(?:brain-console|rvcb)[\s\S]{0,1600}rvbc\.md[\s\S]{0,120}same directory/,
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
