// incremental-refresh.test.mjs — a nightly refresh changes only the affected source
// files, while identity/schema changes fail closed to a clean rebuild.
//
// Breaks caught:
// - deriving chunk IDs from traversal order (one inserted file renumbers the corpus);
// - treating every changed repository SHA as "rebuild the whole repository";
// - appending modified/deleted content without retiring its previous chunks;
// - reusing embeddings after the build fingerprint or ledger schema changes;
// - attempting a delta against old manifests whose sequential IDs cannot be matched safely.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  buildCorpusLedger,
  chunkDelta,
  planLegacyDelta,
  planLegacyRekey,
  planIncrementalRefresh,
  promoteArtifactSet,
  rekeyStagedIdmap,
  stageRvfDelta,
  stableChunkId,
} from '../../kb/incremental-refresh.mjs';
import { closeReadonlyRvf } from '../../kb/resolve-deps.mjs';

describe('legacy BGE zero-embed migration', () => {
  it('rekeys sequential IDs while preserving internal RVF labels', () => {
    const result = planLegacyRekey({
      passages: [
        { id: 1, path: 'a.md', title: 'A', text: 'alpha' },
        { id: 2, path: 'b.md', title: 'B', text: 'beta' },
      ],
      chunks: [
        { id: 'chunk:aaa', path: 'a.md', title: 'A', text: 'alpha' },
        { id: 'chunk:bbb', path: 'b.md', title: 'B', text: 'beta' },
      ],
      idmap: { idToLabel: { 1: 7, 2: 9 }, labelToId: { 7: '1', 9: '2' }, nextLabel: 10 },
    });
    expect(result).toEqual({
      ok: true,
      idmap: {
        idToLabel: { 'chunk:aaa': 7, 'chunk:bbb': 9 },
        labelToId: { 7: 'chunk:aaa', 9: 'chunk:bbb' },
        nextLabel: 10,
      },
    });
  });

  it('refuses reuse when one passage differs', () => {
    const result = planLegacyRekey({
      passages: [{ id: 1, path: 'a.md', title: 'A', text: 'old' }],
      chunks: [{ id: 'chunk:new', path: 'a.md', title: 'A', text: 'new' }],
      idmap: { idToLabel: { 1: 1 }, labelToId: { 1: '1' }, nextLabel: 2 },
    });
    expect(result).toMatchObject({ ok: false, reason: 'corpus-mismatch-at:0:a.md' });
  });

  it('maps unchanged legacy rows and isolates only entering/departing chunks', () => {
    const result = planLegacyDelta({
      passages: [
        { id: 1, path: 'keep.md', title: 'Keep', text: 'same' },
        { id: 2, path: 'gone.md', title: 'Gone', text: 'old' },
      ],
      chunks: [
        { id: 'chunk:keep', path: 'keep.md', title: 'Keep', text: 'same' },
        { id: 'chunk:new', path: 'new.md', title: 'New', text: 'new' },
      ],
      idmap: { idToLabel: { 1: 7, 2: 8 } },
    });
    expect(result).toEqual({
      ok: true,
      matches: [{ oldId: '1', newId: 'chunk:keep' }],
      deleteIds: ['2'],
      insertIds: ['chunk:new'],
    });
    expect(rekeyStagedIdmap({
      staged: { idToLabel: { 1: 7, 'chunk:new': 9 }, nextLabel: 10 },
      matches: result.matches,
      insertedIds: result.insertIds,
    })).toEqual({
      idToLabel: { 'chunk:keep': 7, 'chunk:new': 9 },
      labelToId: { 7: 'chunk:keep', 9: 'chunk:new' },
      nextLabel: 10,
    });
  });
});

describe('stableChunkId — identity follows source content, not corpus traversal order', () => {
  const chunk = {
    repo: 'ruvector',
    sourcePath: 'crates/rvf-runtime/src/store.rs',
    chunkerVersion: 'chunker-v1',
    ordinal: 0,
    content: 'pub fn open(path: &Path) -> Result<Store> {\n  Store::open(path)\n}',
  };

  it('returns the same non-sequential ID for the same source chunk on every call', () => {
    const first = stableChunkId(chunk);
    const second = stableChunkId({ ...chunk });

    expect(first).toBe(second);
    expect(first).toMatch(/^chunk:[a-f0-9]{64}$/);
    expect(first).not.toMatch(/^\d+$/);
  });

  it.each([
    ['content changes', { content: `${chunk.content}\n// new behavior` }],
    ['source path changes', { sourcePath: 'crates/rvf-runtime/src/reader.rs' }],
    ['repository changes', { repo: 'ruflo' }],
    ['chunker version changes', { chunkerVersion: 'chunker-v2' }],
  ])('%s changes the ID', (_label, change) => {
    expect(stableChunkId({ ...chunk, ...change })).not.toBe(stableChunkId(chunk));
  });

  it('normalizes line endings so checkout platform does not create a false delta', () => {
    const crlf = { ...chunk, content: chunk.content.replaceAll('\n', '\r\n') };
    expect(stableChunkId(crlf)).toBe(stableChunkId(chunk));
  });

  it('keeps repeated identical chunks in one source file distinct by ordinal', () => {
    expect(stableChunkId({ ...chunk, ordinal: 1 })).not.toBe(stableChunkId(chunk));
  });
});

describe('planIncrementalRefresh — classify the file delta explicitly', () => {
  it('plans unchanged, add, modify, and delete without rebuilding unaffected files', () => {
    const plan = planIncrementalRefresh({
      previous: {
        schemaVersion: 2,
        buildFingerprint: 'bge-m3:1024:chunker-v1:include-v1',
        files: {
          'docs/unchanged.md': {
            sourceHash: 'sha256:same',
            chunkIds: ['chunk:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
          },
          'docs/modified.md': {
            sourceHash: 'sha256:old',
            chunkIds: ['chunk:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
          },
          'docs/deleted.md': {
            sourceHash: 'sha256:gone',
            chunkIds: ['chunk:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'],
          },
        },
      },
      current: {
        schemaVersion: 2,
        buildFingerprint: 'bge-m3:1024:chunker-v1:include-v1',
        files: {
          'docs/unchanged.md': { sourceHash: 'sha256:same' },
          'docs/modified.md': { sourceHash: 'sha256:new' },
          'docs/added.md': { sourceHash: 'sha256:added' },
        },
      },
    });

    expect(plan).toEqual({
      mode: 'incremental',
      reason: null,
      unchanged: ['docs/unchanged.md'],
      add: ['docs/added.md'],
      modify: ['docs/modified.md'],
      delete: ['docs/deleted.md'],
    });
  });

  it('sorts each file list so filesystem enumeration order cannot change the plan', () => {
    const plan = planIncrementalRefresh({
      previous: {
        schemaVersion: 2,
        buildFingerprint: 'same',
        files: {
          'z-deleted.md': { sourceHash: 'z', chunkIds: ['chunk:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'] },
          'a-deleted.md': { sourceHash: 'a', chunkIds: ['chunk:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] },
        },
      },
      current: {
        schemaVersion: 2,
        buildFingerprint: 'same',
        files: {
          'z-added.md': { sourceHash: 'z' },
          'a-added.md': { sourceHash: 'a' },
        },
      },
    });

    expect(plan.add).toEqual(['a-added.md', 'z-added.md']);
    expect(plan.delete).toEqual(['a-deleted.md', 'z-deleted.md']);
  });
});

describe('buildCorpusLedger/chunkDelta — persist enough identity to retire stale vectors', () => {
  const fingerprint = 'minilm@a+bge@b+forge-corpus-v1';
  const oldChunks = [
    { id: 'chunk:a', path: 'same.md', text: 'same' },
    { id: 'chunk:b', path: 'changed.md', text: 'old' },
    { id: 'chunk:c', path: 'deleted.md', text: 'gone' },
  ];
  const newChunks = [
    { id: 'chunk:a', path: 'same.md', text: 'same' },
    { id: 'chunk:d', path: 'changed.md', text: 'new' },
    { id: 'chunk:e', path: 'added.md', text: 'added' },
  ];

  it('groups chunk IDs by source path with deterministic source hashes', () => {
    const ledger = buildCorpusLedger(oldChunks, { buildFingerprint: fingerprint });

    expect(ledger.schemaVersion).toBe(2);
    expect(ledger.buildFingerprint).toBe(fingerprint);
    expect(ledger.files['changed.md'].chunkIds).toEqual(['chunk:b']);
    expect(ledger.files['changed.md'].sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Object.keys(ledger.files)).toEqual(['changed.md', 'deleted.md', 'same.md']);
  });

  it('returns only the vectors whose IDs leave or enter the complete corpus', () => {
    expect(chunkDelta(oldChunks, newChunks)).toEqual({
      deleteIds: ['chunk:b', 'chunk:c'],
      insertIds: ['chunk:d', 'chunk:e'],
    });
  });
});

describe('planIncrementalRefresh — unsafe ledgers require a full rebuild', () => {
  const current = {
    schemaVersion: 2,
    buildFingerprint: 'bge-m3:1024:chunker-v1:include-v1',
    files: {
      'docs/a.md': { sourceHash: 'sha256:new' },
    },
  };

  const safePrevious = {
    schemaVersion: 2,
    buildFingerprint: current.buildFingerprint,
    files: {
      'docs/a.md': {
        sourceHash: 'sha256:old',
        chunkIds: ['chunk:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      },
    },
  };

  it('requires a full rebuild when the embedding/chunking fingerprint changes', () => {
    const plan = planIncrementalRefresh({
      previous: { ...safePrevious, buildFingerprint: 'minilm:384:chunker-v1:include-v1' },
      current,
    });

    expect(plan).toEqual({
      mode: 'full',
      reason: 'build-fingerprint-changed',
      unchanged: [],
      add: [],
      modify: [],
      delete: [],
    });
  });

  it('requires a full rebuild when the ledger schema changes', () => {
    const plan = planIncrementalRefresh({
      previous: { ...safePrevious, schemaVersion: 1 },
      current,
    });

    expect(plan).toEqual({
      mode: 'full',
      reason: 'ledger-schema-changed',
      unchanged: [],
      add: [],
      modify: [],
      delete: [],
    });
  });

  it.each([
    ['numeric string IDs', ['1', '2']],
    ['numeric IDs', [1, 2]],
  ])('requires a full rebuild for legacy sequential chunk IDs: %s', (_label, chunkIds) => {
    const plan = planIncrementalRefresh({
      previous: {
        ...safePrevious,
        files: {
          'docs/a.md': { sourceHash: 'sha256:old', chunkIds },
        },
      },
      current,
    });

    expect(plan).toEqual({
      mode: 'full',
      reason: 'legacy-sequential-chunk-ids',
      unchanged: [],
      add: [],
      modify: [],
      delete: [],
    });
  });
});

describe('stageRvfDelta — mutate a staged copy, never the live store', () => {
  it('deletes retired IDs and inserts changed IDs while leaving the source byte-identical', async () => {
    const kbRequire = createRequire(new URL('../../kb/package.json', import.meta.url));
    const { RvfDatabase } = kbRequire('@ruvector/rvf');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-rvf-delta-'));
    const sourcePath = path.join(dir, 'source.rvf');
    const stagePath = path.join(dir, 'stage.rvf');
    const oldA = 'chunk:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const oldB = 'chunk:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const newC = 'chunk:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

    try {
      const source = await RvfDatabase.create(sourcePath, { dimensions: 3, metric: 'cosine' });
      await source.ingestBatch([
        { id: oldA, vector: [1, 0, 0] },
        { id: oldB, vector: [0, 1, 0] },
      ]);
      await source.close();
      const before = fs.readFileSync(sourcePath);
      const beforeMap = fs.readFileSync(`${sourcePath}.idmap.json`);

      const result = await stageRvfDelta({
        sourcePath,
        stagePath,
        deleteIds: [oldB],
        inserts: [{ id: newC, vector: [0, 0, 1] }],
        RvfDatabase,
      });

      expect(result).toMatchObject({ deleted: 1, accepted: 1, rejected: 0, totalVectors: 2 });
      expect(fs.readFileSync(sourcePath)).toEqual(before);
      expect(fs.readFileSync(`${sourcePath}.idmap.json`)).toEqual(beforeMap);

      const staged = await RvfDatabase.openReadonly(stagePath);
      const ids = (await staged.query([0, 0, 1], 3)).map((hit) => hit.id);
      await closeReadonlyRvf(staged);
      expect(ids).toContain(newC);
      expect(ids).toContain(oldA);
      expect(ids).not.toContain(oldB);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('promoteArtifactSet — readers never inherit a half-promoted generation', () => {
  it('moves a complete candidate into place and removes the promotion lock', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-promote-'));
    const liveDir = path.join(dir, 'live');
    const candidateDir = path.join(dir, 'candidate');
    fs.mkdirSync(liveDir);
    fs.mkdirSync(candidateDir);
    fs.writeFileSync(path.join(liveDir, 'repo.rvf'), 'old-rvf');
    fs.writeFileSync(path.join(liveDir, 'repo.passages.jsonl'), 'old-passages');
    fs.writeFileSync(path.join(candidateDir, 'repo.rvf'), 'new-rvf');
    fs.writeFileSync(path.join(candidateDir, 'repo.passages.jsonl'), 'new-passages');

    try {
      promoteArtifactSet({
        liveDir,
        candidateDir,
        files: ['repo.rvf', 'repo.passages.jsonl'],
      });

      expect(fs.readFileSync(path.join(liveDir, 'repo.rvf'), 'utf8')).toBe('new-rvf');
      expect(fs.readFileSync(path.join(liveDir, 'repo.passages.jsonl'), 'utf8')).toBe('new-passages');
      expect(fs.existsSync(path.join(liveDir, '.promotion.lock'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rolls back every already-moved file when a later promotion rename fails', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-promote-'));
    const liveDir = path.join(dir, 'live');
    const candidateDir = path.join(dir, 'candidate');
    fs.mkdirSync(liveDir);
    fs.mkdirSync(candidateDir);
    fs.mkdirSync(path.join(candidateDir, 'missing-parent'));
    fs.writeFileSync(path.join(liveDir, 'repo.rvf'), 'old-rvf');
    fs.writeFileSync(path.join(candidateDir, 'repo.rvf'), 'new-rvf');
    fs.writeFileSync(path.join(candidateDir, 'missing-parent', 'later'), 'cannot-land');

    try {
      expect(() => promoteArtifactSet({
        liveDir,
        candidateDir,
        files: ['repo.rvf', 'missing-parent/later'],
      })).toThrow(/promotion failed/);

      expect(fs.readFileSync(path.join(liveDir, 'repo.rvf'), 'utf8')).toBe('old-rvf');
      expect(fs.existsSync(path.join(liveDir, '.promotion.lock'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
