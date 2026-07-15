// tests/unit/learnings.test.mjs — the "What I've learned" reader (ADR-0017). Pure file reads with
// injectable paths, so no dependency on the machine's real learner state.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { learnings } from '../../scripts/learnings.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
const STATS = path.join(TMP, 'stats.json');
const QDIR = path.join(TMP, 'q');
fs.mkdirSync(QDIR);

describe('learnings — the console “What I’ve learned” reader', () => {
  it('returns the inactive shape when there is no learner yet (no invented data)', () => {
    const l = learnings({ statsPath: path.join(TMP, 'none.json'), queueDir: path.join(TMP, 'none') });
    expect(l.active).toBe(false);
    expect(l.trajectories).toBe(0);
    expect(l.patterns).toBe(0);
    expect(l.lastAdaptation).toBeNull();
    expect(l.recentWorkflow).toEqual([]);
  });

  it('reads real counts + days-since + dedupes the recently-observed workflow (malformed skipped)', () => {
    const now = Date.UTC(2026, 6, 15, 12);
    fs.writeFileSync(STATS, JSON.stringify({ trajectoriesRecorded: 1863, patternsLearned: 1856, lastAdaptation: now - 2 * 86400000 }));
    fs.writeFileSync(path.join(QDIR, 'session-a.jsonl'), [
      JSON.stringify({ tool: 'Bash', action: 'git push origin main' }),
      JSON.stringify({ tool: 'Bash', action: 'gh run watch --exit-status' }),
      JSON.stringify({ tool: 'Bash', action: 'git push origin main' }), // duplicate — must collapse
      'not-json-should-be-skipped',
    ].join('\n') + '\n');
    const l = learnings({ statsPath: STATS, queueDir: QDIR, now });
    expect(l.active).toBe(true);
    expect(l.trajectories).toBe(1863);
    expect(l.patterns).toBe(1856);
    expect(l.daysSinceLastAdaptation).toBe(2);
    expect(l.recentWorkflow).toEqual(['git push origin main', 'gh run watch --exit-status']);
    expect(l.lastAdaptation).toMatch(/^2026-07-13T/);
  });
});
