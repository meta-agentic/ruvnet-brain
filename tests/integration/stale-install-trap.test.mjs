/**
 * THE STALE-INSTALL TRAP (2026-07-21) — root cause of "users are still on 0.5".
 *
 * The installer decided whether to download the brain with a pure FILE-EXISTENCE check:
 *
 *     const alreadyInstalled = fs.existsSync(path.join(cacheDir, 'forge-mcp-all.mjs'));
 *     if (alreadyInstalled && !FLAG_FORCE) { ...skip the download... }
 *
 * No version anywhere in it. So a June v0.5 brain made that true, the download was skipped, and the
 * installer printed its success banner. Re-running the installer — the fix we ADVERTISE in recovery
 * messages — refreshed the reader and plugin wiring and left the brain untouched, forever. A closed
 * trap: the advertised escape hatch was the thing that failed.
 *
 * The second test here is the more important one. The FIRST version of the fix compared against
 * whatever resolveRelease() returned — but that function does NOT throw when the GitHub API fails;
 * it returns a hardcoded known-good pin (v2.9.0). So a rate-limited lookup reported
 * "installed v3.4.21-dev → latest v2.9.0" and would have DOWNGRADED a perfectly current machine.
 * The fix made a new failure reachable, and only exercising the failure path caught it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');

// A synthetic 'old' tag: the test is about ANY version older than latest, and pinning the real
// historical literal trips the repo's no-hardcoded-version gate without adding coverage.
const ANCIENT = 'v0.0.1-ancient';
const currentVersion = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8')).version;

let home;
let work;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-trap-home-'));
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-trap-work-'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(work, { recursive: true, force: true });
});

/** Seed an installed brain that reports `tag` as its release. */
function seedBrain(tag) {
  const kb = path.join(home, '.cache', 'ruvnet-brain', 'kb');
  fs.mkdirSync(kb, { recursive: true });
  fs.writeFileSync(path.join(kb, 'forge-mcp-all.mjs'), '// stub');
  fs.writeFileSync(path.join(kb, 'SOURCE.json'), JSON.stringify({ releaseTag: tag, stores: { ruvnet: {} } }));
}

/**
 * Run the installer. `breakLookup` copies it with the repo slug pointed at a nonexistent repo so
 * the real GitHub call genuinely 404s — exercising the fallback path rather than simulating it.
 */
function runInstaller({ breakLookup = false } = {}) {
  let script = INSTALLER;
  if (breakLookup) {
    script = path.join(work, 'install.mjs');
    const src = fs.readFileSync(INSTALLER, 'utf8')
      .replace("const REPO = 'stuinfla/ruvnet-brain';", "const REPO = 'stuinfla/definitely-not-a-real-repo-xyz';");
    fs.writeFileSync(script, src);
  }
  const res = spawnSync(process.execPath, [script, '--no-verify'], {
    encoding: 'utf8',
    timeout: 180_000,
    env: { ...process.env, HOME: home, RUVNET_BRAIN_TEST: '1' },
  });
  // eslint-disable-next-line no-control-regex
  return `${res.stdout || ''}${res.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Run until the install/skip DECISION has been printed, then stop.
 *
 * Needed because a correct "this is stale" verdict proceeds to download a ~2 GB bundle — the test
 * only cares about the verdict, and letting it actually fetch would make the suite depend on the
 * network and take minutes. Streams stdout and kills the child the moment the decision appears.
 */
function runUntilDecision(timeoutMs = 90_000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [INSTALLER, '--no-verify'], {
      env: { ...process.env, HOME: home, RUVNET_BRAIN_TEST: '1' },
    });
    let buf = '';
    const done = () => { try { child.kill('SIGKILL'); } catch { /* already gone */ } // eslint-disable-next-line no-control-regex
      resolve(buf.replace(/\x1b\[[0-9;]*m/g, '')); };
    const onData = (d) => {
      buf += String(d);
      if (/out of date|already current|could not check/i.test(buf)) done();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', done);
    setTimeout(done, timeoutMs);
  });
}

describe('stale-install trap', () => {
  it('a STALE brain triggers a download instead of being skipped', async () => {
    seedBrain(ANCIENT); // stands in for the reported June build

    const out = await runUntilDecision();

    expect(out, 'must recognise it is behind').toMatch(/out of date/i);
    expect(out, 'must NOT claim it is current').not.toMatch(/already current/i);
  }, 120_000);

  it('a CURRENT brain still skips — the fix must not force a 2 GB re-download on everyone', () => {
    seedBrain(`v${currentVersion()}`);

    const out = runInstaller();

    expect(out).toMatch(/already current/i);
    expect(out).not.toMatch(/out of date/i);
  });

  it('a FAILED release lookup never downgrades — it skips and says it could not check', () => {
    // The regression the first version of this fix introduced: resolveRelease() returns a hardcoded
    // known-good pin rather than throwing, so comparing against it reported a CURRENT install as
    // "out of date → v2.9.0" and would have replaced it with a years-old bundle.
    seedBrain(`v${currentVersion()}`);

    const out = runInstaller({ breakLookup: true });

    expect(out, 'must not treat the known-good pin as "latest"').not.toMatch(/out of date/i);
    expect(out, 'must be honest that it could not verify').toMatch(/could not check|WITHOUT verifying/i);
  });
});
