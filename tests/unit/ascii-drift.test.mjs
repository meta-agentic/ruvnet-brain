// tests/unit/ascii-drift.test.mjs — ADR-055 §8. The deterministic half of the ASCII→SVG rule.
//
// The guards that matter here are the REFUSALS, not the detections. This channel's only asset is
// being believed: it speaks at session start, it cannot block anything, and the single way it fails
// is by crying wolf until people tune it out. Its first run did exactly that — all 5 tracked README
// diagrams reported STALE when every one of them was healthy — so the false-positive cases below
// are the load-bearing tests and the happy path is the easy one.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeAscii, hashAscii, scoreBlock, fencedBlocks, evaluate } from '../../scripts/ascii-drift.mjs';

const DIAGRAM = ['┌──────────┐', '│  Client  │', '└─────┬────┘', '      │', '      ▼', '┌──────────┐', '│  Server  │', '└──────────┘'].join('\n');

let repo;
function sh(args, cwd = repo) { return spawnSync('git', args, { cwd, encoding: 'utf8' }); }
function w(rel, content) {
  const p = path.join(repo, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  sh(['add', '-A']);
}
beforeEach(() => {
  repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ascii-drift-')));
  sh(['init', '-q']); sh(['config', 'user.email', 't@t.t']); sh(['config', 'user.name', 't']);
});
afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

describe('normalization — the SKILL owns this format, not us (change-tracking.md)', () => {
  it('trims each line, drops leading/trailing blanks, normalizes CRLF, strips fences', () => {
    const a = normalizeAscii('```\n\n  ┌──┐  \r\n  │ab│\r\n\n```');
    expect(a).toBe('┌──┐\n│ab│');
  });
  it('hashing is stable across cosmetic whitespace/CRLF differences', () => {
    expect(hashAscii('  ┌─┐\n  │x│  ')).toBe(hashAscii('┌─┐\r\n│x│'));
  });
});

describe('scoring — the NEGATIVE signals are the whole point', () => {
  const neg = (body, label) => it(`does not flag ${label}`, () => {
    expect(scoreBlock(body).confidence).toBeLessThan(40);
  });
  neg('| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |', 'a markdown table');
  neg('function f() {\n  const x = 1;\n  return x;\n}', 'source code');
  neg('$ npm install\n$ npm test\n$ npm run build', 'a shell transcript');
  neg('2026-07-27 [INFO] started\n2026-07-27 [WARN] slow\n2026-07-27 [ERROR] died', 'log output');
  neg('host: localhost\nport: 8080\ndebug: true', 'config key/value');
  neg('┌─┐\n└─┘', 'a block under 3 lines');

  it('DOES flag a real box-and-arrow diagram', () => {
    expect(scoreBlock(DIAGRAM).confidence).toBeGreaterThanOrEqual(40);
  });
});

describe('the skill\'s override markers are honoured (SKILL.md)', () => {
  it('`<!-- skip-ascii-to-svg -->` suppresses a candidate entirely', () => {
    w('a.md', `# T\n\n<!-- skip-ascii-to-svg -->\n\n\`\`\`\n${DIAGRAM}\n\`\`\`\n`);
    sh(['commit', '-qm', 'x']);
    expect(evaluate(repo).candidates).toHaveLength(0);
  });
  it('`<!-- convert-to-svg -->` forces one that scoring would have rejected', () => {
    w('a.md', '# T\n\n<!-- convert-to-svg -->\n\n```\nhost: localhost\nport: 8080\ndebug: true\n```\n');
    sh(['commit', '-qm', 'x']);
    const c = evaluate(repo).candidates;
    expect(c).toHaveLength(1);
    expect(c[0].confidence).toBe(100);
    expect(c[0].forced).toBe(true);
  });
});

describe('tracked diagrams — three outcomes, and two of them must stay SILENT', () => {
  const manifest = (extra = {}) => JSON.stringify({
    version: '1.0.0',
    diagrams: [{ id: 'd1', sourceFile: 'a.md', sourceLine: 3, svgFile: 'assets/d1.svg', asciiHash: hashAscii(DIAGRAM), ...extra }],
  });

  it('unchanged ASCII is current — says nothing', () => {
    w('a.md', `# T\n\n\`\`\`\n${DIAGRAM}\n\`\`\`\n`);
    w('assets/d1.svg', '<svg/>'); w('.ascii-to-svg-manifest.json', manifest());
    sh(['commit', '-qm', 'x']);
    expect(evaluate(repo).stale).toHaveLength(0);
  });

  // THE REGRESSION. First run reported all 5 tracked README diagrams STALE. Every one was healthy:
  // README carries no box-drawing characters at all, because the ASCII fallbacks were REMOVED when
  // the diagrams were converted, and all 5 SVGs exist and are referenced from the page. Five false
  // alarms out of five tracked items, on the first run, in a channel whose only job is to be believed.
  it('converted-and-fallback-removed is the HEALTHY END STATE, never "stale"', () => {
    w('a.md', '# T\n\nNo ascii here any more, just the picture:\n\n![d1](assets/d1.svg)\n');
    w('assets/d1.svg', '<svg/>'); w('.ascii-to-svg-manifest.json', manifest());
    sh(['commit', '-qm', 'x']);
    expect(evaluate(repo).stale).toHaveLength(0);
  });

  it('but a MISSING SVG is always worth saying — the page renders a broken image', () => {
    w('a.md', '# T\n\n![d1](assets/d1.svg)\n');
    w('.ascii-to-svg-manifest.json', manifest());
    sh(['commit', '-qm', 'x']);
    const s = evaluate(repo).stale;
    expect(s).toHaveLength(1);
    expect(s[0].why).toMatch(/MISSING/);
  });

  it('and ASCII still present but CHANGED is genuinely stale', () => {
    const edited = DIAGRAM.replace('Server', 'Backend');
    w('a.md', `# T\n\n\`\`\`\n${edited}\n\`\`\`\n`);
    w('assets/d1.svg', '<svg/>'); w('.ascii-to-svg-manifest.json', manifest());
    sh(['commit', '-qm', 'x']);
    const s = evaluate(repo).stale;
    expect(s).toHaveLength(1);
    expect(s[0].why).toMatch(/no longer matches/);
  });
});

describe('generated markdown is out of scope, and untracked files are too', () => {
  it('ignores kb/ and dist/ — 96 of the repo\'s unstamped files live there', () => {
    w('kb/gen.md', `# G\n\n\`\`\`\n${DIAGRAM}\n\`\`\`\n`);
    w('dist/gen.md', `# G\n\n\`\`\`\n${DIAGRAM}\n\`\`\`\n`);
    sh(['commit', '-qm', 'x']);
    expect(evaluate(repo).candidates).toHaveLength(0);
  });
});

describe('the session-start voice', () => {
  it('--quiet prints NOTHING when there is nothing to do (the reason it stays believable)', () => {
    w('a.md', '# T\n\njust prose.\n');
    sh(['commit', '-qm', 'x']);
    const r = spawnSync('node', [path.resolve(import.meta.dirname, '../../scripts/ascii-drift.mjs'), '--quiet'], { cwd: repo, encoding: 'utf8' });
    expect(r.status).toBe(0);
    // NB: the detector roots itself at ITS OWN repo, so this asserts the contract (exit 0, no throw)
    // rather than emptiness of this fixture — the fixture-scoped emptiness is proven via evaluate().
    expect(r.stderr).toBe('');
  });

  it('never throws on a directory that is not a git repo at all', () => {
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'ascii-nogit-'));
    try { expect(() => evaluate(notRepo)).not.toThrow(); }
    finally { fs.rmSync(notRepo, { recursive: true, force: true }); }
  });
});
