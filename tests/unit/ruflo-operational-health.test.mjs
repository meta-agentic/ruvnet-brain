import { describe, expect, it } from 'vitest';
import { classifyRufloOperationalHealth } from '../../bin/install.mjs';

describe('Ruflo operational health is derived from the configured execution mode', () => {
  it('accepts zero-daemon direct mode without trusting daemon-owned summaries', () => {
    expect(classifyRufloOperationalHealth({
      status: 'RuFlo V3 [STOPPED]\nBackend | none\nEntries | 0\nSwarm not running',
      memory: 'Total Entries | 1,504\nBackend | sql.js + HNSW',
      metrics: 'Total Patterns | 0\nTotal Routes | 0\nTotal Executed | 0',
    })).toMatchObject({
      healthy: true,
      directMode: true,
      stopped: true,
      memoryContradiction: true,
      zeroLearning: true,
      memoryEntries: 1504,
    });
  });

  it('accepts only agreeing active and nonzero operational signals', () => {
    expect(classifyRufloOperationalHealth({
      status: 'RuFlo V3 [RUNNING]\nBackend | hybrid\nEntries | 12',
      memory: 'Total Entries | 12',
      metrics: 'Total Patterns | 3\nTotal Routes | 8\nTotal Executed | 5',
    }).healthy).toBe(true);
  });
});
