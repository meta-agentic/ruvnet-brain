/**
 * SECURITY REGRESSION — `-y` must never install a persistent background job.
 *
 * Reported 2026-07-20 by a user on a CORPORATE machine: `npx ruvnet-brain` (invoked by an AI agent,
 * which hit an interactive prompt, could not answer it, and re-ran with `-y`) installed a launchd
 * job that pulls code from GitHub nightly. Their enterprise policy correctly blocked the plugin and
 * MCP installs, but had no rule covering a LaunchAgent — so the single thing that survived the
 * policy was the persistent background daemon. Nothing about that is acceptable.
 *
 * Root cause: `--yes` was documented as "accept every optional offer", and the two changes nobody
 * would call optional — a scheduled daemon, and an edit to a global config file — were swept in
 * with it. rUv's own ADR-302 already forbids exactly this: "accepting the enrollment screen is not
 * blanket authorization... four distinct decisions, each with its own consent."
 *
 * These tests run the real exported decision functions in a child process with a throwaway HOME,
 * under RUVNET_BRAIN_TEST=1 (writes a plist but never calls launchctl), so they assert on actual
 * behaviour and real files rather than on the wording of the source.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALLER = path.join(ROOT, 'bin', 'install.mjs');
const NIGHTLY_PLIST = 'Library/LaunchAgents/com.ruvnet.brain-update.plist';
const SPEND_PLIST = 'Library/LaunchAgents/com.ruvnet.spend-watchdog.plist';

let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'consent-test-')); });
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

/** Call one exported offer function with the given CLI args, in an isolated HOME. */
function callOffer(fnName, args = []) {
  const runner = path.join(home, 'runner.mjs');
  fs.writeFileSync(
    runner,
    `const m = await import(${JSON.stringify(INSTALLER)});\n` +
      `const r = await m.${fnName}();\n` +
      `process.stdout.write('RESULT:' + String(r));\n`,
  );
  const res = spawnSync(process.execPath, [runner, ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      HOME: home,
      RUVNET_BRAIN_IMPORT_ONLY: '1',
      RUVNET_BRAIN_TEST: '1', // write plists, NEVER touch the real launchctl domain
    },
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  return { result: (out.match(/RESULT:(\S+)/) || [])[1], out, status: res.status };
}

const onMac = process.platform === 'darwin';

describe('blanket --yes must not authorize persistent changes (corporate-machine report)', () => {
  it.skipIf(!onMac)('`-y` alone does NOT install the nightly LaunchAgent', () => {
    const { result } = callOffer('offerNightly', ['-y']);

    expect(fs.existsSync(path.join(home, NIGHTLY_PLIST)), 'a launchd job must never come from -y').toBe(false);
    expect(result).not.toBe('enabled');
  });

  it.skipIf(!onMac)('`--yes` alone does NOT install the spend-watchdog LaunchAgent', () => {
    const { result } = callOffer('offerSpendGuard', ['--yes']);

    expect(fs.existsSync(path.join(home, SPEND_PLIST)), 'a launchd job must never come from --yes').toBe(false);
    expect(result).not.toBe('enabled');
  });

  // NOT TESTED HERE, deliberately, and stated rather than quietly omitted: the POSITIVE path
  // (`--enable-nightly` actually installing the job). Exercising it needs RUVNET_BRAIN_TEST unset,
  // and then enableNightly() calls `launchctl bootstrap` against the REAL gui domain — a test that
  // registers a live launchd job on whoever runs it is worse than the bug it checks. With
  // RUVNET_BRAIN_TEST=1 the function returns 'suppressed' before reaching any of it. So the
  // install-still-works direction is covered by the source gate below plus manual verification,
  // and the tests above cover the direction that actually hurt someone.

  it('with no flags and no terminal, nothing persistent is installed', () => {
    const nightly = callOffer('offerNightly', []);
    const spend = callOffer('offerSpendGuard', []);

    expect(fs.existsSync(path.join(home, NIGHTLY_PLIST))).toBe(false);
    expect(fs.existsSync(path.join(home, SPEND_PLIST))).toBe(false);
    for (const r of [nightly.result, spend.result]) expect(r).not.toBe('enabled');
  });

  it('the high-impact gates are not wired to FLAG_YES in source (defence in depth)', () => {
    // Behavioural tests above are the real guard; this catches a future edit that re-introduces
    // the blanket path in a branch the tests above happen not to reach.
    const src = fs.readFileSync(INSTALLER, 'utf8');
    const nightlyGate = src.slice(src.indexOf('export async function offerNightly'), src.indexOf('parseTelemetryAnswer'));
    expect(nightlyGate).toMatch(/FLAG_ENABLE_NIGHTLY/);
    expect(nightlyGate).not.toMatch(/!FLAG_YES/);
  });
});
