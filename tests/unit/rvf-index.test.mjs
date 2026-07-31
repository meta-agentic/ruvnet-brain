import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { persistAndVerifyRvfIndex } from '../../kb/rvf-index.mjs';

describe('persistAndVerifyRvfIndex', () => {
  it('persists an index that is immediately visible after reopen', async () => {
    const require = createRequire(new URL('../../kb/package.json', import.meta.url));
    const { RvfDatabase } = require('@ruvector/rvf');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-rvf-index-'));
    const rvfPath = path.join(dir, 'indexed.rvf');

    try {
      const db = await RvfDatabase.create(rvfPath, { dimensions: 3, metric: 'cosine' });
      await db.ingestBatch(Array.from({ length: 1024 }, (_, index) => ({
        id: `vector-${index}`,
        vector: index % 2 ? [1, 0, 0] : [0, 1, 0],
      })));

      const proof = await persistAndVerifyRvfIndex({
        db,
        dimensions: 3,
        rvfPath,
        RvfDatabase,
      });

      expect(proof).toMatchObject({ hasIndex: true, indexRequired: true });
      expect(proof.status.totalVectors).toBe(1024);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
