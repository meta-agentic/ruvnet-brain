// forge-corpus.test.mjs — pins the real filesystem-to-corpus boundary independently
// of model loading and RVF writes.
//
// Breaks caught:
// - filesystem traversal or category-pass ordering changes;
// - skipped build/vendor directories leak into the corpus;
// - paragraph-aligned 400-character overlap changes;
// - chunk IDs fall back to traversal-position integers or include the absolute checkout path.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCorpus, FORGE_CHUNKER_VERSION } from '../../kb/forge-corpus.mjs';

let repo;

function write(rel, content) {
  const file = path.join(repo, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-corpus-'));

  write('README.md', '# Fixture\n\n' + 'A'.repeat(2600) + '\n\n' + 'B'.repeat(2000));
  write('package.json', JSON.stringify({
    name: 'fixture-package',
    version: '1.2.3',
    description: 'fixture manifest',
    scripts: { test: 'vitest run' },
  }));
  write('src/documented.js', '// Public module summary\nconst implementation = 1;\n');
  write('src/undocumented.js', 'const intentionallyLowSignal = true;\n');
  write('page.html', '<style>.hidden{}</style><h1>Visible</h1><script>secret()</script>');
  write('settings.yml', 'enabled: true\n');
  write('target/generated.md', '# Must never be indexed\n');
  write('v2/legacy.md', '# Globally skipped unless kept\n');
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe('buildCorpus — deterministic enumeration and chunking over a real repo fixture', () => {
  it('preserves category-pass order, skip rules, source shaping, and paragraph overlap', () => {
    const result = buildCorpus({
      repo,
      name: 'fixture-kb',
      fullPrefixes: [],
      keepNames: [],
    });

    expect(FORGE_CHUNKER_VERSION).toBe('forge-corpus-v1');
    expect(result.chunks.map(({ path, chunk, of }) => ({ path, chunk, of }))).toEqual([
      { path: 'README.md', chunk: 1, of: 2 },
      { path: 'README.md', chunk: 2, of: 2 },
      { path: 'package.json', chunk: 1, of: 1 },
      { path: 'src/documented.js', chunk: 1, of: 1 },
      { path: 'page.html', chunk: 1, of: 1 },
      { path: 'settings.yml', chunk: 1, of: 1 },
    ]);

    const [readme1, readme2] = result.chunks;
    expect(readme1.text).toBe('# Fixture\n\n' + 'A'.repeat(2600));
    expect(readme2.text.slice(0, 400)).toBe(readme1.text.slice(-400));
    expect(readme2.text.endsWith('B'.repeat(2000))).toBe(true);

    expect(result.chunks.find((c) => c.path === 'src/documented.js').text)
      .toBe('Module src/documented.js — doc comment:\nPublic module summary');
    expect(result.chunks.find((c) => c.path === 'page.html').text)
      .toBe('UI page page.html full text content:\nVisible');
    expect(result.intentionallySkipped).toEqual(['src/undocumented.js']);
    expect(result.excluded.dirs).toEqual(new Set(['target', 'v2']));
    expect(result.chunks.some((c) => c.path.includes('generated.md') || c.path.includes('legacy.md')))
      .toBe(false);
  });

  it('uses the KB name, relative path, chunker version, and chunk content for stable IDs', () => {
    const before = buildCorpus({ repo, name: 'fixture-kb' });
    const readmeBefore = before.chunks.filter((c) => c.path === 'README.md');

    expect(readmeBefore.map((c) => c.id)).toEqual([
      'chunk:e1d4f5b2fdc11919ef095d56f35d6317b039615f39caf834892ff5646a1a6c96',
      'chunk:d98a042e5838f7dfe6db24ba06a84c83b3dfca66950ea0f97af1d338baca0981',
    ]);

    // This file sorts before README and therefore changes traversal position. README IDs
    // must survive even though its chunks move later in the corpus array.
    write('000-first.md', '# Inserted earlier\n');
    const after = buildCorpus({ repo, name: 'fixture-kb' });
    expect(after.chunks.filter((c) => c.path === 'README.md').map((c) => c.id))
      .toEqual(readmeBefore.map((c) => c.id));
    expect(after.chunks[0].path).toBe('000-first.md');
  });

  it('honors an exact --keep directory-name exemption without disabling other skips', () => {
    const result = buildCorpus({
      repo,
      name: 'fixture-kb',
      keepNames: ['v2'],
    });

    expect(result.chunks.some((c) => c.path === 'v2/legacy.md')).toBe(true);
    expect(result.chunks.some((c) => c.path === 'target/generated.md')).toBe(false);
    expect(result.excluded.dirs).toEqual(new Set(['target']));
  });
});
