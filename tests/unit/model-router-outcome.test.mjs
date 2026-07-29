import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarize } from '../../scripts/model-router-outcome.mjs';

describe('model-router outcome summary understands both append-only row schemas', () => {
  it('does not misclassify k-NN training rows as undefined-model failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rvb-router-outcome-'));
    const file = path.join(dir, 'routing-outcomes.jsonl');
    fs.writeFileSync(file, [
      JSON.stringify({ ts: '2026-07-28T00:00:00Z', embedding: [0.1, 0.2], scores: { cheap: 0.8, strong: 0.9 } }),
      JSON.stringify({ ts: '2026-07-28T00:00:01Z', model: 'cheap', success: true }),
      JSON.stringify({ ts: '2026-07-28T00:00:02Z', model: 'cheap', success: false }),
      JSON.stringify({ ts: '2026-07-28T00:00:03Z', note: 'not a recognized row' }),
      '{bad json',
    ].join('\n') + '\n');

    try {
      expect(summarize(file)).toEqual({
        total: 5,
        outcomes: 2,
        trainingRows: 1,
        invalid: 2,
        byModel: { cheap: { total: 2, successes: 1, failures: 1 } },
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
