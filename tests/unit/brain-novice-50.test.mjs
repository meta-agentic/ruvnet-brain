import { describe, expect, it } from 'vitest';
import { NOVICE_QUESTIONS } from '../../scripts/brain-novice-50.mjs';

describe('novice 50-question acceptance corpus', () => {
  it('contains exactly 50 unique, graded questions across broad and specific levels', () => {
    expect(NOVICE_QUESTIONS).toHaveLength(50);
    expect(new Set(NOVICE_QUESTIONS.map((item) => item.query)).size).toBe(50);
    expect(new Set(NOVICE_QUESTIONS.map((item) => item.category)).size).toBeGreaterThanOrEqual(10);
    for (const item of NOVICE_QUESTIONS) {
      expect(item.repo).toMatch(/^[a-z0-9-]+$/);
      expect(item.required).toBeInstanceOf(RegExp);
    }
  });
});
