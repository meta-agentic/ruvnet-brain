import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.RUVNET_BRAIN_IMPORT_ONLY = '1';
const { pruneUnlistedStores, copyLocalBundleInto } = await import('../../bin/install.mjs');
afterAll(() => { delete process.env.RUVNET_BRAIN_IMPORT_ONLY; });

describe('installer replacement semantics — stale stores never survive an overlay update', () => {
  it('the packed stranger harness exercises the same assembled-directory --local contract', () => {
    const harness = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../scripts/ci/stranger-scenario.mjs'),
      'utf8',
    );
    expect(harness).toContain('stageLocalBundle(fixtureDir, INSTALLED)');
    expect(harness).not.toContain("path.join(INSTALLED, 'dist', 'ruvnet-brain.zip')");
  });

  it('--local copies the freshly assembled directory rather than relying on a stale zip', () => {
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-local-source-'));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-local-target-'));
    try {
      fs.writeFileSync(path.join(source, 'card-lane.mjs'), 'fresh');
      fs.mkdirSync(path.join(source, 'keys'));
      fs.writeFileSync(path.join(source, 'keys', 'signing.pub'), 'key');
      fs.writeFileSync(path.join(target, 'card-lane.mjs'), 'stale');
      fs.writeFileSync(path.join(target, 'user.log'), 'preserve');

      expect(copyLocalBundleInto(source, target)).toBe(2);
      expect(fs.readFileSync(path.join(target, 'card-lane.mjs'), 'utf8')).toBe('fresh');
      expect(fs.readFileSync(path.join(target, 'keys', 'signing.pub'), 'utf8')).toBe('key');
      expect(fs.readFileSync(path.join(target, 'user.log'), 'utf8')).toBe('preserve');
    } finally {
      fs.rmSync(source, { recursive: true, force: true });
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  it('removes the complete artifact family of an omitted store and preserves allowed/unrelated files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-prune-'));
    try {
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
        builtRepos: [{ name: 'public-repo' }],
        conceptsStore: { store: 'concepts.big.rvf' },
      }));
      for (const file of [
        'public-repo.rvf', 'public-repo.passages.jsonl',
        'concepts.big.rvf', 'concepts.big.passages.jsonl',
        'private-repo.rvf', 'private-repo.big.rvf', 'private-repo.passages.jsonl',
        'private-repo.big.rvf.old-shallow.bak', 'private-repo.symbols.json',
        'private-repo-primer.md',
      ]) fs.writeFileSync(path.join(dir, file), file);
      fs.writeFileSync(path.join(dir, 'update.log'), 'keep me');
      fs.mkdirSync(path.join(dir, 'node_modules'));
      fs.writeFileSync(path.join(dir, 'node_modules', 'keep'), 'reader');

      const removed = pruneUnlistedStores(dir);
      expect(new Set(removed.map((r) => r.repo))).toEqual(new Set(['private-repo']));
      expect(fs.readdirSync(dir).filter((f) => f.startsWith('private-repo'))).toEqual([]);
      expect(fs.readFileSync(path.join(dir, 'public-repo.passages.jsonl'), 'utf8')).toBe('public-repo.passages.jsonl');
      expect(fs.readFileSync(path.join(dir, 'update.log'), 'utf8')).toBe('keep me');
      expect(fs.readFileSync(path.join(dir, 'node_modules', 'keep'), 'utf8')).toBe('reader');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removes an omitted primer even after a prior install already removed its RVF files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-prune-'));
    try {
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
        builtRepos: [{ name: 'public-repo' }],
      }));
      fs.writeFileSync(path.join(dir, 'public-repo-primer.md'), 'keep');
      fs.writeFileSync(path.join(dir, 'private-repo-primer.md'), 'remove');

      const removed = pruneUnlistedStores(dir);
      expect(removed).toContainEqual({ repo: 'private-repo', entry: 'private-repo-primer.md' });
      expect(fs.existsSync(path.join(dir, 'private-repo-primer.md'))).toBe(false);
      expect(fs.readFileSync(path.join(dir, 'public-repo-primer.md'), 'utf8')).toBe('keep');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed on a missing or corrupt manifest — it never guesses what to delete', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-prune-'));
    try {
      fs.writeFileSync(path.join(dir, 'orphan.rvf'), 'data');
      expect(pruneUnlistedStores(dir)).toEqual([]);
      expect(fs.existsSync(path.join(dir, 'orphan.rvf'))).toBe(true);
      fs.writeFileSync(path.join(dir, 'manifest.json'), '{broken');
      expect(pruneUnlistedStores(dir)).toEqual([]);
      expect(fs.existsSync(path.join(dir, 'orphan.rvf'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
