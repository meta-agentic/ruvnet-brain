import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  inspectRvfIndex,
  repairRvfIndex,
  restampChangedRvfGenerations,
} from '../../scripts/rvf-index-audit.mjs';
import { getVersion, getVersionTag } from '../../scripts/version.mjs';

const require = createRequire(new URL('../../kb/package.json', import.meta.url));
const { RvfDatabase } = require('@ruvector/rvf');

describe('RVF release index audit', () => {
  it('fails an eligible unindexed store and repairs it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-rvf-audit-'));
    const rvfPath = path.join(dir, 'candidate.big.rvf');
    try {
      const db = await RvfDatabase.create(rvfPath, { dimensions: 3, metric: 'cosine' });
      await db.ingestBatch(Array.from({ length: 1024 }, (_, index) => ({
        id: `vector-${index}`,
        vector: index % 2 ? [1, 0, 0] : [0, 1, 0],
      })));
      await db.close();
      fs.writeFileSync(`${rvfPath}.embed.json`, '{"dimensions":3}\n');

      expect(await inspectRvfIndex(rvfPath, RvfDatabase)).toMatchObject({
        state: 'FAIL',
        indexRequired: true,
        hasIndex: false,
      });
      expect(await repairRvfIndex(rvfPath, RvfDatabase)).toMatchObject({
        state: 'PASS',
        repaired: true,
        hasIndex: true,
      });
      fs.writeFileSync(path.join(dir, 'RVF-GENERATIONS.json'), JSON.stringify({
        schemaVersion: 1,
        brainVersion: getVersion(),
        releaseTag: getVersionTag(),
        stores: {
          candidate: {
            file: 'candidate.big.rvf',
            sha256: 'stale',
            model: 'fixture',
            dimensions: 3,
            sourceCommit: 'fixture-sha',
          },
        },
      }));
      const result = await inspectRvfIndex(rvfPath, RvfDatabase);
      expect(restampChangedRvfGenerations(dir, [result])).toBe(1);
      const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'RVF-GENERATIONS.json'), 'utf8'));
      expect(ledger.stores.candidate.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(ledger.stores.candidate.sourceCommit).toBe('fixture-sha');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
