import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const WORKER = path.resolve('plugin/scripts/first-session-worker.mjs');
const roots = [];

function fixture({ seedExit = 0, checkExit = 0, version = '9.8.7' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'first-session-worker-'));
  roots.push(root);
  const seed = path.join(root, 'seed.mjs');
  const check = path.join(root, 'check.mjs');
  const order = path.join(root, 'order.txt');
  const versionLog = path.join(root, 'state', 'version.log');
  fs.writeFileSync(seed, `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(order)}, 'seed\\n'); process.exit(${seedExit});\n`);
  fs.writeFileSync(check, `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(order)}, 'check\\n'); process.stdout.write(${JSON.stringify(`${version}\n`)}); process.exit(${checkExit});\n`);
  return { root, seed, check, order, versionLog };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('first-session lifecycle worker', () => {
  it('seeds first, then records a valid update heartbeat in the same worker', () => {
    const f = fixture();
    const run = spawnSync(process.execPath, [WORKER, f.seed, f.check, f.versionLog], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(fs.readFileSync(f.order, 'utf8')).toBe('seed\ncheck\n');
    expect(fs.readFileSync(f.versionLog, 'utf8')).toBe('9.8.7\n');
  });

  it('does not run the heartbeat when seeding failed', () => {
    const f = fixture({ seedExit: 1 });
    const run = spawnSync(process.execPath, [WORKER, f.seed, f.check, f.versionLog], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(fs.readFileSync(f.order, 'utf8')).toBe('seed\n');
    expect(fs.existsSync(f.versionLog)).toBe(false);
  });

  it('keeps a successful seed usable when the network heartbeat fails', () => {
    const f = fixture({ checkExit: 1 });
    const run = spawnSync(process.execPath, [WORKER, f.seed, f.check, f.versionLog], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(fs.readFileSync(f.order, 'utf8')).toBe('seed\ncheck\n');
    expect(fs.existsSync(f.versionLog)).toBe(false);
  });
});
