import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../kb/forge-ask.mjs', () => ({ searchKb: vi.fn() }));
vi.mock('../../kb/forge-rerank.mjs', () => ({
  rerankPairs: vi.fn(),
  cePrefilterScores: vi.fn(),
}));

import { searchAll } from '../../kb/forge-ask-all.mjs';
import { searchKb } from '../../kb/forge-ask.mjs';
import { rerankPairs } from '../../kb/forge-rerank.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
let dir;

function writeRepo(name, body, entries) {
  fs.writeFileSync(path.join(dir, `${name}.rvf`), 'synthetic-store');
  fs.appendFileSync(path.join(dir, 'capability-cards.md'), `## ${name}\n${body}\n\n`);
  fs.writeFileSync(path.join(dir, `${name}.meta.json`), JSON.stringify({ entries }));
}

function source(pathname, preview) {
  return {
    path: pathname,
    kind: 'source',
    title: path.basename(pathname),
    preview,
  };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-card-adversarial-'));
  fs.writeFileSync(path.join(dir, 'capability-cards.md'), '');
  vi.mocked(searchKb).mockReset();
  vi.mocked(rerankPairs).mockReset();
  // A correct conservative implementation may fall through. Keep that path cheap and observable.
  vi.mocked(searchKb).mockResolvedValue([]);
  vi.mocked(rerankPairs).mockImplementation(async (_query, candidates) => candidates);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('source-backed card lane adversarial release gate', () => {
  it('never proves the positive capability for a negated question', async () => {
    fs.writeFileSync(path.join(dir, 'unrelated.rvf'), 'synthetic-store');
    writeRepo(
      'vault-engine',
      'Vault Engine retains encrypted records and rotates encryption keys.',
      {
        records: source('src/records.ts', 'Encrypted records retained by the vault engine.'),
        keys: source('src/keys.ts', 'Encryption key rotation for retained records.'),
      },
    );

    const out = await searchAll({
      dir,
      query: 'Does vault-engine not retain encrypted records?',
      k: 3,
    });

    expect(
      out.routing?.lane === 'source-backed-card' && out.implementation?.verdict === 'proven',
      'a token-overlap lane cannot interpret negation and must fall through',
    ).toBe(false);
  });

  it('never truncates a multi-entity claim after proving only its first repository', async () => {
    fs.writeFileSync(path.join(dir, 'unrelated.rvf'), 'synthetic-store');
    writeRepo(
      'swarm-engine',
      'Swarm Engine coordinates parallel swarms and shares task state.',
      {
        swarm: source('src/swarm.ts', 'Coordinates parallel swarms with shared task state.'),
        agents: source('src/agents.ts', 'Parallel agent swarm coordination.'),
      },
    );
    writeRepo(
      'memory-engine',
      'Memory Engine persists durable memories across sessions and restarts.',
      {
        memory: source('src/memory.ts', 'Persists durable memory across sessions.'),
        restore: source('src/restore.ts', 'Restores persisted memories after restarts.'),
      },
    );

    const out = await searchAll({
      dir,
      query: 'Can swarm-engine coordinate parallel swarms and memory-engine persist memory across sessions?',
      k: 5,
    });

    if (out.routing?.lane === 'source-backed-card') {
      expect(new Set(out.repos)).toEqual(new Set(['swarm-engine', 'memory-engine']));
      expect(out.implementation?.implementationSources).toEqual(expect.arrayContaining([
        expect.stringMatching(/^swarm-engine\//),
        expect.stringMatching(/^memory-engine\//),
      ]));
    }
  });

  it('binds required semantic clauses to cited implementation bytes, not appended card prose', async () => {
    fs.writeFileSync(path.join(dir, 'unrelated.rvf'), 'synthetic-store');
    writeRepo(
      'cipher-engine',
      'Cipher Engine can encrypt records and rotate keys without downtime.',
      {
        recordTypes: source(
          'src/record-types.ts',
          'Encrypt metadata attached to records type declarations in Cipher Engine.',
        ),
        keyMetrics: source(
          'src/key-metrics.ts',
          'Rotate counters emitted for keys metrics in Cipher Engine.',
        ),
      },
    );

    const out = await searchAll({
      dir,
      query: 'Does cipher-engine encrypt records and rotate keys?',
      k: 3,
    });

    // Weak lexical previews are not obligated to answer. Conservative fallthrough is correct.
    // If the fast lane accepts, however, every required clause must be present in the cited
    // implementation bytes themselves; the appended capability card cannot supply missing facts.
    if (out.routing?.lane === 'source-backed-card') {
      const cited = new Set(out.implementation?.implementationSources || []);
      const citedBytes = out.results
        .filter((result) => cited.has(`${result.repo}/${result.path}`))
        .map((result) => result.fullText || result.text || '')
        .join('\n')
        .toLowerCase();
      expect(citedBytes).toMatch(/\bencrypts?\s+records?\b/);
      expect(citedBytes).toMatch(/\brotates?\s+keys?\b/);
    }
  });

  it('loads repository aliases from a declarative registry instead of benchmark-specific code', () => {
    const registry = path.join(ROOT, 'kb', 'repo-aliases.json');
    expect(fs.existsSync(registry), 'repository/store aliases need one inspectable data registry').toBe(true);
    const aliases = JSON.parse(fs.readFileSync(registry, 'utf8'));
    expect(aliases).toSatisfy((value) =>
      value && typeof value === 'object' && !Array.isArray(value)
      && Object.entries(value).every(([canonical, stores]) =>
        canonical.length > 0 && Array.isArray(stores) && stores.every((store) => typeof store === 'string')));
  });

  it('does not synchronously materialize and split an entire passage sidecar per fast-lane query', () => {
    const sourceText = fs.readFileSync(path.join(ROOT, 'kb', 'forge-ask-all.mjs'), 'utf8');
    expect(sourceText).not.toMatch(
      /readFileSync\(\s*passageFile\s*,\s*['"]utf8['"]\s*\)\.split\(\s*['"]\\n['"]\s*\)/,
    );
  });
});
