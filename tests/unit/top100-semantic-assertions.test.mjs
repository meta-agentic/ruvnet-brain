import { describe, it, expect } from 'vitest';
import { buildTop100 } from '../../scripts/top100-corpus.mjs';
import { answerFromCards, renderCardHit } from '../../kb/card-lane.mjs';
import { evaluateSemanticEvidence } from '../../scripts/top100-benchmark.mjs';

let subject = null;
try {
  subject = await import('../../scripts/top100-semantic-assertions.mjs');
} catch {
  // RED phase: the production module does not exist yet.
}

const PRODUCT_NAMES = new Set([
  'agent-harness-generator', 'agentdb', 'agentic-flow', 'agentic-qe', 'agenticow',
  'cognitum-cogs', 'cognitum-support', 'concepts', 'cve-bench', 'daa', 'dspy.ts',
  'fact', 'metaharness', 'open-claude-code', 'qudag', 'ruflo', 'rulake', 'rupixel',
  'ruv-dev', 'ruv-fann', 'ruvector', 'ruview', 'rvm', 'safla', 'sparc', 'synthlang',
]);

describe('top-100 semantic assertions', () => {
  const sourceIds = buildTop100().questions.map((q) => q.sourceId);

  it('exports the lookup and completeness APIs', () => {
    expect(subject).not.toBeNull();
    expect(subject.semanticAssertionsFor).toBeTypeOf('function');
    expect(subject.semanticAssertionCompleteness).toBeTypeOf('function');
    expect(subject.TOP100_SEMANTIC_ASSERTIONS).toBeTypeOf('object');
  });

  it('covers exactly the current 100 sourceIds with at least one required clause each', () => {
    expect(subject).not.toBeNull();
    const coverage = subject.semanticAssertionCompleteness(sourceIds);
    expect(coverage).toEqual({ complete: true, missing: [], unexpected: [] });
    expect(Object.keys(subject.TOP100_SEMANTIC_ASSERTIONS)).toHaveLength(100);
    for (const sourceId of sourceIds) {
      expect(subject.semanticAssertionsFor(sourceId), sourceId).toEqual(
        subject.TOP100_SEMANTIC_ASSERTIONS[sourceId],
      );
      expect(subject.semanticAssertionsFor(sourceId).length, sourceId).toBeGreaterThan(0);
    }
    expect(subject.semanticAssertionsFor('not-in-the-corpus')).toBeNull();
  });

  it('uses labeled clauses with lowercase semantic alternatives, never a product name alone', () => {
    expect(subject).not.toBeNull();
    for (const [sourceId, clauses] of Object.entries(subject.TOP100_SEMANTIC_ASSERTIONS)) {
      const labels = new Set();
      for (const clause of clauses) {
        expect(Object.keys(clause).sort(), `${sourceId}:${clause.label}`).toEqual(['anyOf', 'label']);
        expect(clause.label.trim(), sourceId).not.toBe('');
        expect(labels.has(clause.label), `${sourceId}:${clause.label} is duplicated`).toBe(false);
        labels.add(clause.label);
        expect(Array.isArray(clause.anyOf), `${sourceId}:${clause.label}`).toBe(true);
        expect(clause.anyOf.length, `${sourceId}:${clause.label}`).toBeGreaterThan(0);
        for (const alternative of clause.anyOf) {
          expect(alternative, `${sourceId}:${clause.label}`).toBe(alternative.toLowerCase());
          expect(alternative.trim(), `${sourceId}:${clause.label}`).toBe(alternative);
          expect(alternative.length, `${sourceId}:${clause.label}`).toBeGreaterThanOrEqual(3);
          expect(PRODUCT_NAMES.has(alternative), `${sourceId}:${clause.label} is tautological`).toBe(false);
        }
      }
    }
  });

  it('never lets a fast-lane answer pass routing while failing its question-specific facts', () => {
    const failures = [];
    for (const question of buildTop100().questions) {
      const hit = answerFromCards(question.query, 'kb');
      if (!hit.hit) continue;
      const semantic = evaluateSemanticEvidence(renderCardHit(hit), question.requiredEvidence);
      if (!semantic.pass) {
        failures.push({
          id: question.id,
          missing: semantic.clauses.filter((clause) => !clause.pass).map((clause) => clause.label),
        });
      }
    }
    expect(failures).toEqual([]);
  });
});
