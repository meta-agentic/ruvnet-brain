import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../../scripts/brain-latency-50.mjs';

describe('50-question Brain latency release benchmark', () => {
  it('contains exactly 50 non-duplicate questions with a source-citation oracle', () => {
    expect(QUESTIONS).toHaveLength(50);
    expect(new Set(QUESTIONS.map(([question]) => question)).size).toBe(50);
    for (const [question, expected] of QUESTIONS) {
      expect(question.endsWith('?') || question.endsWith('.')).toBe(true);
      expect(expected).toBeInstanceOf(RegExp);
    }
  });
});
