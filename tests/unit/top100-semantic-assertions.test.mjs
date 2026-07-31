import { describe, it, expect } from 'vitest';
import { buildTop100 } from '../../scripts/top100-corpus.mjs';
import { answerFromCards, renderCardHit } from '../../kb/card-lane.mjs';
import {
  evaluateSemanticEvidence,
  repoMatchesExpectation,
} from '../../scripts/top100-benchmark.mjs';

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

  it('matches a required phrase inside a cited CamelCase source identifier without splitting concepts apart', () => {
    const explanation = subject.semanticAssertionsFor('n-02');
    expect(evaluateSemanticEvidence('export class ExplainableRecall {}', explanation))
      .toMatchObject({ present: true, pass: true, matched: 1, required: 1 });
    expect(evaluateSemanticEvidence(
      'export class Explainable {} export class RecallIndex {}',
      explanation,
    )).toMatchObject({ present: true, pass: false, matched: 0, required: 1 });
  });

  it('matches bounded morphology and modifiers without joining distant concepts', () => {
    const requirements = subject.semanticAssertionsFor('n-10');
    expect(evaluateSemanticEvidence(
      'DSPy.ts brings DSPy to TypeScript: compose them into modules and pipelines.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'A TypeScript package has composable storage records. '
      + 'This unrelated discussion deliberately puts many concepts between the words. '
      + 'Modules are mentioned only in another context.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('treats possessive determiners as optional inside a tight preservation phrase', () => {
    const sourceId = buildTop100().questions.find((question) => question.id === 'top-062').sourceId;
    const requirements = subject.semanticAssertionsFor(sourceId);
    expect(evaluateSemanticEvidence(
      'SynthLang provides prompt compression while preserving meaning.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'SynthLang provides prompt compression. '
      + 'Preserving an unrelated cache policy takes many separate steps before meaning is discussed.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('reads a CamelCase risk-threshold implementation symbol as governance evidence', () => {
    const requirements = subject.semanticAssertionsFor('n-09');
    expect(evaluateSemanticEvidence(
      'Decentralized Autonomous Agents export MaxDailySpendingRule and RiskThresholdRule.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'Decentralized Autonomous Agents include a risk model. '
      + 'Several unrelated implementation details separate that discussion from a threshold counter.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('recognizes source-bound cache performance language without accepting generic caching prose', () => {
    const requirements = subject.semanticAssertionsFor('n-11');
    expect(evaluateSemanticEvidence(
      'The implementation uses a cache-first pattern. '
      + 'A circuit breaker provides graceful degradation during cache failures.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'Intelligent caching reduces response times from seconds to milliseconds. '
      + 'A circuit breaker provides graceful degradation during cache failures.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'The implementation stores results in a cache. '
      + 'A circuit breaker provides graceful degradation during cache failures.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('recognizes source-bound text-to-image retrieval and explicit browser-local execution', () => {
    const requirements = subject.semanticAssertionsFor('n-17');
    expect(evaluateSemanticEvidence(
      'CLIP performs text→image retrieval over document screenshots. '
      + 'The live path runs fully in the browser with no server and no upload.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'CLIP performs text→image retrieval over document screenshots, '
      + 'then uploads every frame to a remote service.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('recognizes an explicit sandboxed partition as a guest isolation boundary', () => {
    const requirements = subject.semanticAssertionsFor('n-19');
    expect(evaluateSemanticEvidence(
      'The RVM microhypervisor maps guest physical pages to host physical pages. '
      + 'Wasm modules execute in a sandboxed interpreter within a partition.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'The RVM microhypervisor supports ordinary partition bookkeeping.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('accepts an audited installed-store alias as the routed public product', () => {
    const installedAlias = ['meta', 'harness'].join('');
    expect(repoMatchesExpectation(
      installedAlias,
      ['agent-harness-generator', 'concepts'],
      { 'agent-harness-generator': [installedAlias] },
    )).toBe(true);
    expect(repoMatchesExpectation(
      'unrelated-store',
      ['agent-harness-generator', 'concepts'],
      { 'agent-harness-generator': [installedAlias] },
    )).toBe(false);
  });

  it('matches a bounded structured-policy mutation target without joining distant prose', () => {
    const requirements = subject.semanticAssertionsFor('n-21');
    expect(evaluateSemanticEvidence(
      'Darwin mutates a structured solver policy; the CFR algorithm stays frozen '
      + 'while the harness around it learns.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'Darwin emits structured metrics. '
      + 'Several unrelated implementation details separate this sentence from a policy appendix. '
      + 'The harness around it learns while the model stays frozen.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('treats an explicitly frozen foundation model as the fixed-model invariant', () => {
    const requirements = subject.semanticAssertionsFor('n-22');
    expect(evaluateSemanticEvidence(
      'Darwin Mode evolves harness variants. The foundation model is frozen.',
      requirements,
    )).toMatchObject({ present: true, pass: true, matched: 2, required: 2 });
    expect(evaluateSemanticEvidence(
      'Darwin Mode evolves harness variants against a frozen benchmark.',
      requirements,
    )).toMatchObject({ present: true, pass: false, matched: 1, required: 2 });
  });

  it('never lets a fast-lane answer pass routing while failing its question-specific facts', () => {
    const failures = [];
    for (const question of buildTop100().questions) {
      const hit = answerFromCards(question.query, 'kb', { allowGuideAnswers: true });
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
