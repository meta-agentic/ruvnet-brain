// stack-currency.test.mjs — the update nag must never tell you to DOWNGRADE.
//
// THE BUG THIS EXISTS FOR (found live 2026-07-14, by Stuart noticing the nag looked backwards):
// ground-ruvnet.sh compared installed vs latest with a plain string inequality — `[ "$INST" != "$LATEST" ]`
// — which fires when the two differ IN EITHER DIRECTION. rUv shipped ruflo 3.26→3.28 inside the
// hook's 20h cache window; `npx ruflo@latest` had already pulled 3.28.0; the cache still said 3.25.6.
// So every prompt printed `@claude-flow/cli(3.28.0 -> 3.25.6)` — an instruction to DOWNGRADE.
//
// Currency is an ORDERING question, not an EQUALITY one. `!=` only *looks* right because installed is
// normally <= latest. Nothing asserted the direction, so nothing caught it.
import { describe, it, expect } from 'vitest';

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';

// path.resolve(import.meta.dirname, ...) — NOT `new URL(...).pathname`, which on Windows yields
// "/D:/a/..." and Node then prepends the drive, producing "D:\D:\a\..." (caught by CI's windows-unit
// job; invisible on macOS). This is the repo's existing convention — I should have followed it first.
const HOOK = path.resolve(import.meta.dirname, '../../plugin/scripts/ground-ruvnet.sh');
const SRC = readFileSync(HOOK, 'utf8');
const hasBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

// Pull ver_lt out of the hook and exercise it in a real shell — the one the hook itself runs under.
function verLt(a, b) {
  const fn = SRC.match(/^ver_lt\(\) \{[\s\S]*?^\}/m);
  expect(fn, 'ver_lt() must exist in ground-ruvnet.sh').toBeTruthy();
  const out = execFileSync('bash', ['-c', `${fn[0]}\nif ver_lt "${a}" "${b}"; then echo YES; else echo NO; fi`],
    { encoding: 'utf8' });
  return out.trim() === 'YES';
}

describe.skipIf(!hasBash || process.platform === 'win32')('stack currency — ver_lt ordering', () => {
  it('behind → true (the only case that may nag)', () => {
    expect(verLt('3.25.6', '3.28.0')).toBe(true);
    expect(verLt('3.9.0', '3.10.0')).toBe(true);
    expect(verLt('2.0.0', '10.0.0')).toBe(true);
    expect(verLt('0.2.3', '0.2.4')).toBe(true);
  });

  it('THE REGRESSION — ahead → false (must never advise a downgrade)', () => {
    // This is the exact live failure: installed 3.28.0, cache says 3.25.6.
    expect(verLt('3.28.0', '3.25.6')).toBe(false);
    expect(verLt('3.10.0', '3.9.0')).toBe(false);
    expect(verLt('10.0.0', '2.0.0')).toBe(false);
  });

  it('equal → false (no nag when current)', () => {
    expect(verLt('3.28.0', '3.28.0')).toBe(false);
    expect(verLt('0.2.3', '0.2.3')).toBe(false);
  });

  it('uneven segment counts and pre-release suffixes do not throw or misorder', () => {
    expect(verLt('3.28', '3.28.1')).toBe(true);
    expect(verLt('3.28.1', '3.28')).toBe(false);
    expect(verLt('3.28.0-alpha.1', '3.28.0')).toBe(false);
    expect(verLt('3.27.0', '3.28.0-alpha.1')).toBe(true);
  });
});

describe.skipIf(!hasBash || process.platform === 'win32')('stack currency — the hook end to end', () => {
  // Drive the real hook with a fake HOME so the cache and the "installed" package.json are ours.
  function runHook({ cached, installed }) {
    const home = mkdtempSync(join(tmpdir(), 'sc-'));
    try {
      mkdirSync(join(home, '.cache/ruvnet-brain'), { recursive: true });
      writeFileSync(join(home, '.cache/ruvnet-brain/.stack-latest'), `ruflo ${cached}\n`);
      // Keep the refresh stamp FRESH so the hook doesn't fire a network fetch during the test.
      writeFileSync(join(home, '.cache/ruvnet-brain/.stack-versions-checked'), String(Math.floor(Date.now() / 1000)));
      const pkgDir = join(home, '.npm-global/lib/node_modules/ruflo');
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'ruflo', version: installed }));
      return execFileSync('bash', [HOOK], {
        env: { ...process.env, HOME: home, CLAUDE_USER_PROMPT: 'hello' },
        input: JSON.stringify({ prompt: 'hello' }), encoding: 'utf8', timeout: 15000,
      });
    } finally { rmSync(home, { recursive: true, force: true }); }
  }

  it('installed BEHIND latest → nags, and names the right direction', () => {
    const out = runHook({ cached: '3.28.0', installed: '3.25.6' });
    expect(out).toMatch(/stack updates available/);
    expect(out).toMatch(/ruflo\(3\.25\.6 -> 3\.28\.0\)/);
  });

  it('THE REGRESSION — installed AHEAD of a stale cache → SILENT', () => {
    const out = runHook({ cached: '3.25.6', installed: '3.28.0' });
    expect(out).not.toMatch(/stack updates available/);
  });

  it('installed EQUALS latest → silent', () => {
    const out = runHook({ cached: '3.28.0', installed: '3.28.0' });
    expect(out).not.toMatch(/stack updates available/);
  });
});
