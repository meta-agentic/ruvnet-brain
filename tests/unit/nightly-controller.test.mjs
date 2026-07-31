import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyNightlyChoice, nightlyStatus } from '../../scripts/nightly-controller.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvb-nightly-control-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const installer = path.join(root, 'install.mjs');
  fs.writeFileSync(installer, `import fs from 'node:fs'; import path from 'node:path';
const file = path.join(process.env.HOME, 'Library', 'LaunchAgents', 'com.ruvnet.brain-update.plist');
if (process.argv.includes('--enable-nightly')) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '<plist/>');
} else if (process.argv.includes('--disable-nightly')) {
  fs.rmSync(file, { force: true });
} else process.exit(2);
`);
  return { root, home, installer, env: { ...process.env, HOME: home } };
}

describe('nightly controller delegates to the installer scheduler', () => {
  it('derives off/on from the real scheduler artifact and proves both transitions', () => {
    const f = fixture();
    expect(nightlyStatus({ env: f.env, platform: 'darwin' }).state).toBe('off');
    const on = applyNightlyChoice(true, { env: f.env, platform: 'darwin', installer: f.installer });
    expect(on.ok).toBe(true);
    expect(on.after.state).toBe('on');
    const off = applyNightlyChoice(false, { env: f.env, platform: 'darwin', installer: f.installer });
    expect(off.ok).toBe(true);
    expect(off.after.state).toBe('off');
  });

  it('refuses unsupported platforms instead of claiming a printed cron recipe is a live control', () => {
    const f = fixture();
    const result = applyNightlyChoice(true, { env: f.env, platform: 'linux', installer: f.installer });
    expect(result.ok).toBe(false);
    expect(result.state.state).toBe('unsupported');
    expect(fs.existsSync(path.join(f.home, 'Library'))).toBe(false);
  });
});
