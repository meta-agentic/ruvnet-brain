import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  PROFILE_COMPLETE,
  PROFILE_RUVECTOR,
  applyBrainProfile,
  discoverStoreFamilies,
  measureBrainProfile,
  readBrainProfile,
  restoreCompleteProfile,
} from '../../kb/brain-profile.mjs';

let root;
let source;
let installed;

function writeBundle(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, size] of Object.entries({
    'ruvector.rvf': 50,
    'ruvector.big.rvf': 100,
    'ruvector.idmap.json': 10,
    'ruflo.rvf': 70,
    'ruflo.big.rvf': 140,
    'ruflo.idmap.json': 10,
  })) fs.writeFileSync(path.join(dir, name), Buffer.alloc(size, 1));
  fs.writeFileSync(path.join(dir, 'ruvector-primer.md'), 'ruvector primer');
  fs.writeFileSync(path.join(dir, 'ruflo-primer.md'), 'ruflo primer');
  fs.writeFileSync(path.join(dir, 'forge-mcp-all.mjs'), '// shared reader');
  fs.writeFileSync(path.join(dir, 'capability-cards.md'), [
    '# Capability Cards',
    '',
    'Shared introduction.',
    '',
    '## ruflo',
    'Orchestration.',
    '',
    '## ruvector',
    'Vector search.',
    '',
    '## agentdb',
    'Memory.',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'RVF-GENERATIONS.json'), JSON.stringify({
    stores: { ruflo: { release: 'x' }, ruvector: { release: 'x' } },
  }));
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-profile-'));
  source = path.join(root, 'complete');
  installed = path.join(root, 'installed');
  writeBundle(source);
  fs.cpSync(source, installed, { recursive: true });
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('brain storage profiles', () => {
  it('defaults safely and reads a durable RuVector choice', () => {
    const settings = path.join(root, 'settings.json');
    expect(readBrainProfile({ env: { RUVNET_SETTINGS_FILE: settings } })).toBe(PROFILE_COMPLETE);
    fs.writeFileSync(settings, JSON.stringify({ settings: { brainProfile: PROFILE_RUVECTOR } }));
    expect(readBrainProfile({ env: { RUVNET_SETTINGS_FILE: settings } })).toBe(PROFILE_RUVECTOR);
  });

  it('physically keeps only the RuVector family and filters shared indexes', () => {
    const before = measureBrainProfile(installed);
    const result = applyBrainProfile(installed, PROFILE_RUVECTOR);

    expect(before.stores).toEqual(['ruflo', 'ruvector']);
    expect(result.stores).toEqual(['ruvector']);
    expect(result.removedStores).toEqual(['ruflo']);
    expect(result.bytesFreed).toBeGreaterThan(200);
    expect(fs.existsSync(path.join(installed, 'forge-mcp-all.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(installed, 'ruflo.big.rvf'))).toBe(false);
    expect(fs.readFileSync(path.join(installed, 'capability-cards.md'), 'utf8')).toContain('## ruvector');
    expect(fs.readFileSync(path.join(installed, 'capability-cards.md'), 'utf8')).not.toContain('## ruflo');
    const ledger = JSON.parse(fs.readFileSync(path.join(installed, 'RVF-GENERATIONS.json'), 'utf8'));
    expect(Object.keys(ledger.stores)).toEqual(['ruvector']);
  });

  it('is idempotent and does not replace the complete-card backup with the filtered copy', () => {
    applyBrainProfile(installed, PROFILE_RUVECTOR);
    const second = applyBrainProfile(installed, PROFILE_RUVECTOR);
    expect(second.removed).toEqual([]);
    expect(fs.readFileSync(path.join(installed, 'capability-cards.complete.md'), 'utf8')).toContain('## ruflo');
  });

  it('restores the complete profile from the signed full-bundle source', () => {
    applyBrainProfile(installed, PROFILE_RUVECTOR);
    const restored = restoreCompleteProfile(installed, source);

    expect(restored.stores).toEqual(['ruflo', 'ruvector']);
    expect(discoverStoreFamilies(installed)).toEqual(['ruflo', 'ruvector']);
    expect(fs.readFileSync(path.join(installed, 'capability-cards.md'), 'utf8')).toContain('## ruflo');
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(installed, 'RVF-GENERATIONS.json'), 'utf8')).stores))
      .toEqual(['ruflo', 'ruvector']);
  });
});
