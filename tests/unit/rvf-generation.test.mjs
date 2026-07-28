import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RVF_GENERATIONS_FILE,
  canonicalRvfStores,
  hasCanonicalRvfStore,
  verifyRvfGenerations,
  writeRvfGeneration,
} from '../../scripts/rvf-generation.mjs';
import { getVersion, getVersionTag } from '../../scripts/version.mjs';

const dirs = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

function fixtureDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvf-generation-'));
  dirs.push(dir);
  return dir;
}

describe('checksum-bound RVF generation identity', () => {
  it('discovers only canonical big RVFs and matches registry names case-insensitively', () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, 'ruvector.big.rvf'), 'canonical');
    fs.writeFileSync(path.join(dir, 'ruvector.rvf'), 'obsolete');
    fs.writeFileSync(path.join(dir, 'ruvector.big.rvf.idmap.json'), '{}');

    expect(canonicalRvfStores(dir)).toEqual(['ruvector']);
    expect(hasCanonicalRvfStore(dir, 'RuVector')).toBe(true);
    expect(hasCanonicalRvfStore(dir, 'ruflo')).toBe(false);
  });

  it('binds exact RVF bytes to the one Brain version and detects byte drift', () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, 'demo.big.rvf'), Buffer.from('rvf generation one'));
    const generation = writeRvfGeneration({
      dir,
      store: 'demo',
      model: 'Xenova/bge-base-en-v1.5',
      dimensions: 768,
      sourceCommit: 'abc123',
    });

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, RVF_GENERATIONS_FILE), 'utf8'));
    expect(manifest.brainVersion).toBe(getVersion());
    expect(manifest.releaseTag).toBe(getVersionTag());
    expect(generation.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyRvfGenerations(dir).failures).toEqual([]);

    fs.appendFileSync(path.join(dir, 'demo.big.rvf'), 'changed');
    expect(verifyRvfGenerations(dir).failures).toEqual([
      expect.stringContaining('demo: sha256='),
    ]);
  });

  it('merges another store without losing the previous generation record', () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, 'one.big.rvf'), 'one');
    fs.writeFileSync(path.join(dir, 'two.big.rvf'), 'two');
    writeRvfGeneration({ dir, store: 'one', model: 'bge', dimensions: 768 });
    writeRvfGeneration({ dir, store: 'two', model: 'bge', dimensions: 768 });
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, RVF_GENERATIONS_FILE), 'utf8'));
    expect(Object.keys(manifest.stores).sort()).toEqual(['one', 'two']);
  });

  it('fails when a canonical store has no generation record', () => {
    const dir = fixtureDir();
    fs.writeFileSync(path.join(dir, 'recorded.big.rvf'), 'one');
    fs.writeFileSync(path.join(dir, 'missing.big.rvf'), 'two');
    writeRvfGeneration({ dir, store: 'recorded', model: 'bge', dimensions: 768 });
    expect(verifyRvfGenerations(dir, {
      requiredStores: ['recorded', 'missing'],
    }).failures).toContain('missing: no generation record');
  });
});
