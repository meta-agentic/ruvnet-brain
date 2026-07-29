import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const probeUrl = new URL('../ux/command-probe.mjs', import.meta.url).href;

describe('command UX probe lifecycle', () => {
  it('isolates the home directory on both POSIX and Windows host contracts', async () => {
    const { isolatedHomeEnv } = await import(probeUrl);
    const env = isolatedHomeEnv('fixture-home', { KEEP: 'yes', HOME: 'old-home', USERPROFILE: 'old-profile' });
    expect(env).toMatchObject({ KEEP: 'yes', HOME: 'fixture-home', USERPROFILE: 'fixture-home' });
  });

  it('releases its timeout handle after the live signal without requiring process.exit', () => {
    const script = [
      `const { runCommandProbe } = await import(${JSON.stringify(probeUrl)});`,
      'const result = await runCommandProbe({ timeoutMs: 60000 });',
      'console.log(JSON.stringify({ completionSignalPresent: result.completionSignalPresent }));',
    ].join('\n');
    const started = Date.now();
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
      encoding: 'utf8',
      timeout: 15000,
    });
    const elapsedMs = Date.now() - started;

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"completionSignalPresent":true');
    expect(elapsedMs).toBeLessThan(10000);
  }, 20000);
});
