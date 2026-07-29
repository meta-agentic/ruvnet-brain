import { describe, it, expect } from 'vitest';
import { buildTop100, corpusHash } from '../../scripts/top100-corpus.mjs';
import { semanticAssertionsFor } from '../../scripts/top100-semantic-assertions.mjs';

describe('top-100 RuvNet recall corpus', () => {
  const corpus = buildTop100();

  it('contains exactly 100 unique, answerable questions', () => {
    expect(corpus.questions).toHaveLength(100);
    expect(new Set(corpus.questions.map((q) => q.query)).size).toBe(100);
    for (const q of corpus.questions) {
      expect(q.expectRepo.length, `${q.id} has no owning repo`).toBeGreaterThan(0);
      expect(q.query.length, `${q.id} is empty`).toBeGreaterThan(10);
    }
  });

  it('accepts either side of the AgentDB and @ruvector/rvf integration boundary', () => {
    const q = corpus.questions.find((x) => x.sourceId === 'agentdb-q9');
    expect(q.expectRepo).toEqual(expect.arrayContaining(['agentdb', 'ruvector', 'concepts']));
  });

  it('balances all five experience levels at 20 each', () => {
    const counts = Object.groupBy(corpus.questions, (q) => q.level);
    for (const level of ['naive', 'beginner', 'intermediate', 'advanced', 'expert']) {
      expect(counts[level], level).toHaveLength(20);
    }
  });

  it('covers explicit, implicit, contextual, and surgical specificity', () => {
    const kinds = new Set(corpus.questions.map((q) => q.specificity));
    expect(kinds).toEqual(new Set(['explicit', 'implicit', 'contextual', 'surgical']));
  });

  it('has a stable content hash for benchmark attribution', () => {
    expect(corpusHash(corpus)).toMatch(/^[a-f0-9]{64}$/);
    expect(corpusHash(corpus)).toBe(corpusHash(buildTop100()));
  });

  it('attaches explicit answer-content requirements to every benchmark question', () => {
    for (const q of corpus.questions) {
      expect(q.requiredEvidence, q.sourceId).toEqual(semanticAssertionsFor(q.sourceId));
      expect(q.requiredEvidence.length, q.sourceId).toBeGreaterThan(0);
    }
  });
});
