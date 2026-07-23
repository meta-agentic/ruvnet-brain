// tests/unit/wired-check.test.mjs — the gate that had no test.
//
// Until 2026-07-22 nothing in tests/ referenced wired-check at all. It reported 62/62 wired, exit 0,
// and had never failed on this repo — which reads as health and was actually silence. Its allowlist
// was an uninjectable `const`, so it COULD NOT be tested against a known-bad input even in
// principle.
//
// ADR-037 §7: "A gate that has never failed has not been proven correct. It has been proven silent."
// Every test below is written to FAIL if the guard it covers is broken — the v1 predicate is used as
// the known-bad, so these tests would have failed against the shipped gate.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { audit, callerPattern } from '../../scripts/wired-check.mjs';

let repo;
const w = (rel, body) => {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
};
const stateOf = (res, rel) => res.rows.find((r) => r.rel === rel)?.state;

beforeEach(() => {
  repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wired-check-')));
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe('the predicate — a mention is not a caller', () => {
  it('FAILS a module referenced only by a comment (the v1 bug that wired 6 of 7 founding failures)', () => {
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('scripts/other.mjs', '// widget.mjs was written last week and is great\nexport const y = 2;\n');
    // v1 substring-matched the basename, so this comment made `widget` "wired".
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('unwired');
  });

  it('accepts a real import (quoted string)', () => {
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('scripts/other.mjs', "import { x } from './widget.mjs';\n");
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('wired');
  });

  it('accepts an npm script in package.json', () => {
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('package.json', JSON.stringify({ scripts: { go: 'node scripts/widget.mjs' } }));
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('wired');
  });

  it('accepts a YAML workflow `run:` — the case ADR-037 draft 1 would have missed', () => {
    // Draft 1 said "add .github/ to the search roots" but not `*.yml`; every workflow is YAML, so
    // its own fix would have matched exactly zero workflow files.
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('.github/workflows/ci.yml', 'jobs:\n  a:\n    steps:\n      - run: node scripts/widget.mjs\n');
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('wired');
  });

  it('does NOT match a substring of a longer word (prove/proven, version/"version")', () => {
    w('scripts/prove.mjs', 'export const x = 1;\n');
    w('scripts/other.mjs', '// this is proven behaviour, approved and improved\n');
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/prove.mjs')).toBe('unwired');
  });

  // The regrade (2026-07-23) found correction-detect-measure.mjs "wired" by a `node scripts/…measure.mjs`
  // usage example living in a header comment — the invocation branch of callerPattern matched prose.
  it('an INVOCATION-shaped usage example in a whole-line // comment is NOT a caller', () => {
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('scripts/other.mjs', '// run it by hand: node scripts/widget.mjs --flag\nexport const y = 2;\n');
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('unwired');
  });

  it('a backticked path inside a whole-line // comment is NOT a caller', () => {
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('scripts/other.mjs', '// see `scripts/widget.mjs` for the details\nexport const y = 2;\n');
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('unwired');
  });

  it('a REAL caller between a // that contains /* and a later */ STILL counts — the over-strip regression', () => {
    // The exact bug an early comment-strip introduced and this guards against forever: a global
    // /*…*/ regex span-matched from the `/*` sitting inside a line-comment across real code to the next
    // `*/`, eating a genuine caller (it hid sign-bundle.mjs's execFileSync in self-update.mjs). The
    // line-scoped strip blanks only the whole-line // comment and leaves the invocation intact.
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('scripts/caller.mjs',
      '// turn this off /* flaky, see the notes below\n'
      + "execFileSync(NODE, ['scripts/widget.mjs']);\n"
      + 'const z = 1; /* a real block comment */\n');
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('wired');
  });
});

describe('a test is not a caller — the exclusion that is the entire point', () => {
  it('ignores tests/ directories', () => {
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('tests/unit/widget.test.mjs', "import { x } from '../../scripts/widget.mjs';\n");
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('unwired');
  });

  it('ignores a *.test.mjs sitting NEXT TO the source — in-tree v1 bug', () => {
    // scripts/console-engine.test.mjs counted as a caller under v1: the filter checked for a
    // `/tests/` path, never the filename. A test beside its source silently wired it.
    w('scripts/widget.mjs', 'export const x = 1;\n');
    w('scripts/widget.test.mjs', "import { x } from './widget.mjs';\n");
    expect(stateOf(audit({ repo, standalone: [], held: {} }), 'scripts/widget.mjs')).toBe('unwired');
  });

  it('does not put the test file itself in the inventory', () => {
    w('scripts/widget.test.mjs', 'export const x = 1;\n');
    expect(audit({ repo, standalone: [], held: {} }).rows.some((r) => r.rel.includes('.test.'))).toBe(false);
  });
});

describe('the inventory — invisible is worse than unwired', () => {
  it('audits plugin/scripts/*.sh — founding failure #4 (anticipate.sh) was structurally invisible to v1', () => {
    w('plugin/scripts/anticipate.sh', '#!/usr/bin/env bash\necho hi\n');
    const res = audit({ repo, standalone: [], held: {} });
    expect(stateOf(res, 'plugin/scripts/anticipate.sh')).toBe('unwired');
  });

  it('audits nested scripts/*/ and bin/', () => {
    w('scripts/proxy/thing.sh', '#!/usr/bin/env bash\n');
    w('bin/install.mjs', 'export const i = 1;\n');
    const res = audit({ repo, standalone: [], held: {} });
    expect(stateOf(res, 'scripts/proxy/thing.sh')).toBe('unwired');
    expect(stateOf(res, path.join('bin', 'install.mjs'))).toBe('unwired');
  });

  it('counts every module in exactly one state (DDD-0010 WiringAudit invariant)', () => {
    w('scripts/a.mjs', 'x');
    w('scripts/b.mjs', 'x');
    w('scripts/c.mjs', 'x');
    const res = audit({ repo, standalone: [['b', 'human runs it']], held: { c: 'held' } });
    const sum = ['wired', 'exempt', 'held', 'unwired']
      .reduce((n, s) => n + res.rows.filter((r) => r.state === s).length, 0);
    expect(sum).toBe(res.inventory);
    expect(res.inventory).toBe(3);
  });
});

describe('exemptions', () => {
  it('detects a duplicate name (v1 had memory-doctor twice; object last-wins hid it)', () => {
    w('scripts/widget.mjs', 'x');
    const res = audit({ repo, standalone: [['widget', 'first'], ['widget', 'second']], held: {} });
    expect(res.dupes).toContain('widget');
  });

  it('an exempt module is reported as exempt, not silently skipped', () => {
    // v1 dropped exemptions from the audit entirely, so 3 false reasons rotted unseen.
    w('scripts/widget.mjs', 'x');
    const res = audit({ repo, standalone: [['widget', 'launchd nightly']], held: {} });
    const row = res.rows.find((r) => r.rel === 'scripts/widget.mjs');
    expect(row.state).toBe('exempt');
    expect(row.why).toBe('launchd nightly');
  });
});

describe('callerPattern', () => {
  it('is anchored to the filename, not the basename', () => {
    expect(callerPattern('widget.mjs').test("import x from './widget.mjs'")).toBe(true);
    expect(callerPattern('widget.mjs').test('the widget module')).toBe(false);
    expect(callerPattern('widget.mjs').test('run: node scripts/widget.mjs')).toBe(true);
  });
});
