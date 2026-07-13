// tests/unit/install-telemetry-consent.test.mjs — the installer half of the telemetry contract.
//
// bin/install.mjs exports (under RUVNET_BRAIN_IMPORT_ONLY=1, same pattern as offerNightly):
//   parseTelemetryAnswer — default-YES parser (ENTER/y accept; only explicit n/no declines)
//   offerTelemetry       — the decision matrix (suppressed in test mode; asked once ever;
//                          fail-PRIVATE when there is no TTY to ask on)
//   sendInstallPing      — fire-and-forget { event: "install", v } and NOTHING else
//
// Env-sensitive module state (TEST_MODE, flags) is baked at import time, so each case imports a
// fresh copy via a unique file-URL query string. HOME is pointed at a temp dir before any call
// that could touch ~/.cache — the real machine's consent state is never read or written.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');

const savedEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, TEST: process.env.RUVNET_BRAIN_TEST };
const savedArgv = process.argv;
afterEach(() => {
  process.env.HOME = savedEnv.HOME;
  if (savedEnv.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedEnv.USERPROFILE;
  if (savedEnv.TEST === undefined) delete process.env.RUVNET_BRAIN_TEST; else process.env.RUVNET_BRAIN_TEST = savedEnv.TEST;
  delete process.env.RUVNET_BRAIN_IMPORT_ONLY;
  process.argv = savedArgv;
});

let seq = 0;
async function freshInstaller({ testMode = false, argv = [] } = {}) {
  process.env.RUVNET_BRAIN_IMPORT_ONLY = '1';
  if (testMode) process.env.RUVNET_BRAIN_TEST = '1'; else delete process.env.RUVNET_BRAIN_TEST;
  process.argv = [process.execPath, INSTALLER, ...argv];
  // unique query → unique module instance → module-level flags re-read the env we just set
  return import(pathToFileURL(INSTALLER).href + `?telemetry-case=${++seq}`);
}

const tempHome = () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-install-home-'));
  // os.homedir() reads HOME on POSIX but USERPROFILE on Windows — set both, or every test on a
  // Windows runner shares the runner's REAL profile dir and consent state bleeds between tests.
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return home;
};
const consentPath = (home) => path.join(home, '.cache', 'ruvnet-brain', '.telemetry-consent');

describe('parseTelemetryAnswer — default YES, only an explicit no declines', () => {
  it('holds the same contract as the nightly prompt', async () => {
    const mod = await freshInstaller();
    expect(mod.parseTelemetryAnswer('')).toBe(true);      // ENTER
    expect(mod.parseTelemetryAnswer('y')).toBe(true);
    expect(mod.parseTelemetryAnswer('YES')).toBe(true);
    expect(mod.parseTelemetryAnswer('  yes ')).toBe(true);
    expect(mod.parseTelemetryAnswer('n')).toBe(false);
    expect(mod.parseTelemetryAnswer('No')).toBe(false);
    expect(mod.parseTelemetryAnswer('whatever')).toBe(true); // unrecognized → the stated default
  });
});

describe('offerTelemetry — the decision matrix', () => {
  it('RUVNET_BRAIN_TEST=1 → suppressed: no prompt, no file, no ping', async () => {
    const mod = await freshInstaller({ testMode: true });
    const home = tempHome();
    await expect(mod.offerTelemetry('/nonexistent-cache')).resolves.toBe('suppressed');
    expect(fs.existsSync(consentPath(home))).toBe(false);
  });

  it('an existing answer is respected forever — asked once, never re-asked', async () => {
    const mod = await freshInstaller();
    const home = tempHome();
    fs.mkdirSync(path.dirname(consentPath(home)), { recursive: true });
    fs.writeFileSync(consentPath(home), 'no\n');
    await expect(mod.offerTelemetry('/nonexistent-cache')).resolves.toBe('already-set');
    expect(fs.readFileSync(consentPath(home), 'utf8').trim()).toBe('no'); // untouched
  });

  it('--no-telemetry declines without prompting and records the "no"', async () => {
    const mod = await freshInstaller({ argv: ['--no-telemetry'] });
    const home = tempHome();
    await expect(mod.offerTelemetry('/nonexistent-cache')).resolves.toBe('declined-flag');
    expect(fs.readFileSync(consentPath(home), 'utf8').trim()).toBe('no');
  });

  it('no TTY to ask on → fail PRIVATE: not asked, no consent written, so nothing can ever fire', async () => {
    const mod = await freshInstaller(); // vitest workers have no TTY on stdin
    const home = tempHome();
    await expect(mod.offerTelemetry('/nonexistent-cache')).resolves.toBe('not-asked');
    expect(fs.existsSync(consentPath(home))).toBe(false);
    // …and the client module treats that absence as a hard OFF:
    const { telemetryEnabled } = await import('../../kb/telemetry-ping.mjs');
    expect(telemetryEnabled({ stateDir: path.dirname(consentPath(home)), env: {} })).toBe(false);
  });
});

describe('sendInstallPing — the one payload the installer may send', () => {
  it('sends exactly { event: "install", v } — two keys, nothing else', async () => {
    const mod = await freshInstaller();
    const calls = [];
    await mod.sendInstallPing({ version: 'v9.9.9-test', fetchFn: (url, opts) => { calls.push({ url, opts }); return Promise.resolve({ ok: true }); } });
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].opts.body);
    expect(Object.keys(body).sort()).toEqual(['event', 'v']);
    expect(body).toEqual({ event: 'install', v: 'v9.9.9-test' });
  });

  it('a dead network can never break the install (rejecting fetch swallowed)', async () => {
    const mod = await freshInstaller();
    await expect(mod.sendInstallPing({ version: 'x', fetchFn: () => Promise.reject(new Error('offline')) })).resolves.toBeUndefined();
  });

  it('a synchronously-throwing fetch is swallowed too', async () => {
    const mod = await freshInstaller();
    await expect(mod.sendInstallPing({ version: 'x', fetchFn: () => { throw new Error('boom'); } })).resolves.toBeUndefined();
  });
});
