// correction-detect-embed.test.mjs — tests for the embedding-classifier PRIMITIVE this task built
// to test whether swapping regex for embeddings clears ADR-033 §2's floor. This is a measurement
// tool, not a shipped detector: nothing here is wired into any hook, gate, or store.
//
// Unit tier stays model-free and fast for the pure logic (classify()'s k-NN math, candidateText()'s
// formatting) — same convention tests/unit/corpus-qa.test.mjs uses for @ruvector/rvf: build tiny
// synthetic vectors, no real embedder. The one test that needs the REAL local MiniLM (proving the
// classifier's own resolver path actually produces usable vectors, end-to-end, on a small committed
// fixture) is gated behind a live availability probe and SKIPS LOUDLY — never silently — when
// @xenova/transformers or a model cache isn't resolvable on this runner, exactly like corpus-qa's
// `describeRvf` gate.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, candidateText, DEFAULT_K, DEFAULT_MIN_SIM } from '../../scripts/correction-detect-embed.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── candidateText(): pure formatting, no model ──────────────────────────────────────────────────

describe('candidateText', () => {
  it('prefixes the preceding action ahead of the utterance when one is present', () => {
    const text = candidateText({ promptText: 'Never do that again.', precedingAssistantAction: { tool: 'Bash', summary: 'rm -rf dist' } });
    expect(text).toBe('PRECEDING ACTION: rm -rf dist\nUSER: Never do that again.');
  });

  it('prefers a text summary over a bare tool name when both exist', () => {
    const text = candidateText({ promptText: 'x', precedingAssistantAction: { tool: 'Bash', summary: 'git push' } });
    expect(text).toContain('PRECEDING ACTION: git push');
    expect(text).not.toContain('PRECEDING ACTION: Bash');
  });

  it('falls back to the bare tool name when no summary was captured', () => {
    const text = candidateText({ promptText: 'x', precedingAssistantAction: { tool: 'Read', summary: null } });
    expect(text).toBe('PRECEDING ACTION: Read\nUSER: x');
  });

  it('omits the ACTION line entirely when there is no preceding action (never fabricates one)', () => {
    const text = candidateText({ promptText: 'Never do that again.', precedingAssistantAction: null });
    expect(text).toBe('USER: Never do that again.');
  });
});

// ── classify(): pure k-NN vote math, synthetic vectors, NO model ───────────────────────────────
//
// Uses simple axis-aligned unit vectors so similarity is exact and the test asserts on the actual
// arithmetic (weighted-vote sign), not on floating-point-sensitive real embeddings.

const AXIS = (i, n = 4) => Array.from({ length: n }, (_, j) => (j === i ? 1 : 0));

describe('classify — k-NN vote, synthetic vectors', () => {
  const refs = [
    { vector: AXIS(0), label: 'true' },
    { vector: AXIS(0), label: 'true' },
    { vector: AXIS(1), label: 'false' },
    { vector: AXIS(1), label: 'false' },
    { vector: AXIS(1), label: 'false' },
  ];

  it('classifies a vector identical to the true-labelled cluster as a correction', () => {
    const r = classify(AXIS(0), refs, { k: 3, minSim: 0.5 });
    expect(r.isCorrection).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('classifies a vector identical to the false-labelled cluster as NOT a correction', () => {
    const r = classify(AXIS(1), refs, { k: 3, minSim: 0.5 });
    expect(r.isCorrection).toBe(false);
  });

  it('a vector with zero similarity to every reference (orthogonal, below the floor) is NOT flagged — silence is the default, same principle as the regex detector', () => {
    const r = classify(AXIS(2), refs, { k: 3, minSim: 0.5 });
    expect(r.isCorrection).toBe(false);
    expect(r.score).toBe(0);
  });

  it('breaks a numerically-tied vote toward NOT a correction (a tie is a silence, mirroring correction-detect.mjs\'s own trigger tie-break rule)', () => {
    const tiedRefs = [{ vector: AXIS(0), label: 'true' }, { vector: AXIS(0), label: 'false' }];
    const r = classify(AXIS(0), tiedRefs, { k: 2, minSim: 0.5 });
    expect(r.isCorrection).toBe(false); // posWeight === negWeight -> `>` is false
  });

  it('a reference just below the floor cannot swing the vote — it is excluded from scoring (score stays 0), even though it still surfaces as the nearest raw neighbour for diagnostic legibility', () => {
    // sim(AXIS(0), this vector) = 0.29 exactly, i.e. just under minSim=0.3.
    const nearMiss = [{ vector: [0.29, Math.sqrt(1 - 0.29 ** 2), 0, 0], label: 'true' }];
    const r = classify(AXIS(0), nearMiss, { k: 1, minSim: 0.3 });
    expect(r.isCorrection).toBe(false);
    expect(r.score).toBe(0); // excluded from the vote entirely, not just outvoted
    expect(r.neighbors[0].sim).toBeCloseTo(0.29, 5); // still shown — a verdict should stay legible about its nearest miss
  });

  it('the frozen default operating point (DEFAULT_K, DEFAULT_MIN_SIM) is exported and usable without an explicit options object', () => {
    expect(DEFAULT_K).toBeGreaterThan(0);
    expect(DEFAULT_MIN_SIM).toBeGreaterThan(0);
    const r = classify(AXIS(0), refs);
    expect(typeof r.isCorrection).toBe('boolean');
  });
});

// ── The real thing: local MiniLM end-to-end on the small committed fixture ─────────────────────
//
// This is the test that actually exercises "did we wire the real local embedder correctly", not
// just the arithmetic around it. It is allowed to be slow (model load) but must never hang — same
// network-guard loadTransformers() already provides — and must SKIP LOUDLY, not silently, when the
// model can't be resolved on this runner (CI installs only root deps; @xenova/transformers lives in
// kb/node_modules).

const KB_DIR = path.join(__dirname, '..', '..', 'kb');
let embedderAvailable = true;
let unavailableReason = '';
try {
  const { loadTransformers } = await import(path.join(KB_DIR, 'resolve-deps.mjs'));
  await loadTransformers();
} catch (e) {
  embedderAvailable = false;
  unavailableReason = e.message;
}
const describeEmbedder = embedderAvailable ? describe : describe.skip;
if (!embedderAvailable) {
  console.warn(`[correction-detect-embed.test] SKIPPED real-model tests: @xenova/transformers not resolvable on this runner (${unavailableReason})`);
}

describeEmbedder('correction-detect-embed — real local MiniLM, small fixture', () => {
  it('separates the fixture\'s TRUE corrections from its FALSE candidates via leave-one-out k-NN, using ONLY the local embedder (no external API)', async () => {
    const { loadTransformers, configureModel } = await import(path.join(KB_DIR, 'resolve-deps.mjs'));
    const { T, modelCache } = await loadTransformers();
    configureModel(T, modelCache);
    const embed = await T.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });

    const rows = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'correction-embed-sample.jsonl'), 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));

    const texts = rows.map(candidateText);
    const vectors = [];
    for (const t of texts) {
      const out = await embed(t, { pooling: 'mean', normalize: true });
      vectors.push(Array.from(out.data));
    }

    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (let i = 0; i < rows.length; i++) {
      const others = rows.map((r, j) => ({ vector: vectors[j], label: r.label })).filter((_, j) => j !== i);
      const { isCorrection } = classify(vectors[i], others, { k: DEFAULT_K, minSim: DEFAULT_MIN_SIM });
      const truth = rows[i].label === 'true';
      if (isCorrection && truth) tp++;
      else if (isCorrection && !truth) fp++;
      else if (!isCorrection && truth) fn++;
      else tn++;
    }

    // This is NOT a precision/recall claim about the real corpus (that lives in the report this
    // task produced, measured on the full 271-item hand-labelled pool over the real 1,328-transcript
    // corpus) — it is a smoke proof that the real local embedder, wired through this classifier,
    // can separate genuine corrections from bug-reports/spec-language/questions AT ALL, on a tiny
    // fixture. It is deliberately NOT asserting high recall: leave-one-out search on this exact
    // fixture (see the report) found its own best operating point gets precision=100% at only
    // recall=33% (2 of 6) — the same precision-over-recall shape the real measurement found on the
    // full corpus. Zero false positives is the property this test actually protects.
    expect(tp).toBeGreaterThanOrEqual(1);
    expect(fp).toBe(0);
  }, 60_000);
});
