import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageLocalBundle } from '../../scripts/ci/stranger-fixture-stage.mjs';

describe('stranger fixture staging', () => {
  it('replaces a prior healthy bundle so a seeded-broken fixture stays broken', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stranger-fixture-stage-'));
    const source = path.join(root, 'source');
    const installed = path.join(root, 'node_modules', 'ruvnet-brain');
    const target = path.join(installed, 'dist', 'ruvnet-brain');

    try {
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, 'manifest.json'), '{"fixture":"broken"}');

      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, 'forge-mcp-all.mjs'), 'stale healthy artifact');
      fs.writeFileSync(path.join(target, 'manifest.json'), '{"fixture":"healthy"}');

      expect(stageLocalBundle(source, installed)).toBe(target);
      expect(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')).toBe('{"fixture":"broken"}');
      expect(fs.existsSync(path.join(target, 'forge-mcp-all.mjs'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
