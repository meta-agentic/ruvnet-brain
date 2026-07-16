import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The v3.1.0 lesson (2026-07-16): version STRINGS were gated, but the page's STORY was not —
// the public explainer said "What's new in 2.0" through three releases, and the README sat on
// 2.5 while 3.1 shipped. Prose is a version surface. This gate fails the build whenever any
// public narrative names a non-current version, because nobody's eyes are a gate.
const ROOT = process.cwd();
const current = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'plugin/.claude-plugin/plugin.json'), 'utf8'),
).version;
const mm = current.split('.').slice(0, 2).join('.');

const SURFACES = ['README.md', 'explainer/index.html', 'primer/ruvnet-primer.md'];

describe(`narrative version claims match the shipping version (${current})`, () => {
  for (const f of SURFACES) {
    it(`${f} — every "What's new in X" says ${mm}`, () => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const hits = [...src.matchAll(/what[’']?s new in (\d+\.\d+)/gi)].map((m) => m[1]);
      const stale = hits.filter((v) => v !== mm);
      expect(stale, `${f} still claims "What's new in ${stale.join(', ')}" while ${current} is shipping`).toEqual([]);
    });
  }

  it('public surfaces never teach retired command names (the /configure→/rvbc rename, told 4×)', () => {
    const BANNED = [/run <code>\/configure<\/code>/, /\/ruvnet-brain:configure/, /run `\/configure`/];
    for (const f of ['README.md', 'explainer/index.html']) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const hits = BANNED.filter((re) => re.test(src)).map(String);
      expect(hits, `${f} still teaches a retired command: ${hits.join(', ')}`).toEqual([]);
    }
  });

  it('explainer social meta tags carry no version number (versioned og tags rot silently)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'explainer/index.html'), 'utf8');
    const metas = src.split('\n').filter((l) => /property="og:(title|description|image:alt)"|name="twitter:(title|description)"/.test(l));
    const versioned = metas.filter((l) => /\b\d+\.\d+(\.\d+)?\b/.test(l));
    expect(versioned, `versioned social meta lines:\n${versioned.join('\n')}`).toEqual([]);
  });
});
