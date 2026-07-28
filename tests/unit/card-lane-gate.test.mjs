// tests/unit/card-lane-gate.test.mjs — ADR-058 D6: kb/card-lane.mjs's decision lane is a HARD gate,
// not an advisory WARN. This proves the gate's THRESHOLD LOGIC actually fires on a slow lane (a test
// that cannot fail on broken code is not a test) using real setTimeout-based synthetic functions and
// real temp budget files — never a mock of the comparison itself.
//
// The manual, one-off demonstration against the REAL kb/card-lane.mjs (inserting the literal
// `await new Promise(r => setTimeout(r, 1100))` into its answer path, then reverting) is recorded in
// the ADR-058 D6 build report, not here — this suite is the PERMANENT regression guard that survives
// every future run of `npm run test:unit`.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadBudget, percentile, measureFirings, runCardLaneGate, KB_DIR, BUDGET_PATH,
} from '../../scripts/qe/card-lane-gate.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('percentile', () => {
  it('nearest-rank over a known ascending array', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 100)).toBe(100);
  });

  it('never throws on an empty array — returns null instead', () => {
    expect(percentile([], 95)).toBeNull();
  });
});

describe('loadBudget — the checked-in manifest is the only source of these numbers', () => {
  it('parses the real kb/card-lane-budget.json with the required numeric keys', () => {
    const b = loadBudget();
    expect(b.sampleSize).toBeGreaterThan(0);
    expect(b.p95BudgetMs).toBeGreaterThan(0);
    expect(b.absoluteFailMs).toBeGreaterThan(b.p95BudgetMs);
    // Matches ADR-058 D6's literal numbers unless a future, currency-stamped change moves them.
    expect(b.p95BudgetMs).toBe(250);
    expect(b.absoluteFailMs).toBe(1000);
  });

  it('rejects a manifest with a missing/non-numeric required key rather than silently defaulting', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-lane-budget-'));
    const bad = path.join(dir, 'bad-budget.json');
    fs.writeFileSync(bad, JSON.stringify({ sampleSize: 100, p95BudgetMs: 250 })); // absoluteFailMs missing
    expect(() => loadBudget(bad)).toThrow(/absoluteFailMs/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('measureFirings — in-process, no subprocess per firing', () => {
  it('against the real kb/ dir, returns one numeric ms sample per firing, all >= 0', async () => {
    const samples = await measureFirings({ dir: KB_DIR, n: 20 });
    expect(samples).toHaveLength(20);
    for (const s of samples) {
      expect(typeof s).toBe('number');
      expect(s).toBeGreaterThanOrEqual(0);
    }
  });

  it('awaits a THENABLE result — proves the timing loop can observe an injected async delay', async () => {
    const delayMs = 30;
    const slowThenableFn = () => new Promise((resolve) => setTimeout(() => resolve({ hit: false }), delayMs));
    const samples = await measureFirings({ dir: KB_DIR, n: 3, answerFn: slowThenableFn });
    for (const s of samples) expect(s).toBeGreaterThanOrEqual(delayMs - 5); // small clock slack
  });
});

describe('runCardLaneGate — the real, unmutated lane passes today', () => {
  it('PASSes against the real kb/card-lane.mjs with real headroom under budget', async () => {
    const result = await runCardLaneGate({ dir: KB_DIR });
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.n).toBe(result.budget.sampleSize);
    expect(result.p95).toBeLessThan(result.budget.p95BudgetMs);
    expect(result.max).toBeLessThan(result.budget.absoluteFailMs);
  });
});

// ═══ Mutant-shaped tests: prove the gate is load-bearing by feeding it a REAL slow function ═══════
describe('runCardLaneGate FAILS a slow lane — never warns, per ADR-058 D6', () => {
  function tinyBudgetFixture(overrides) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-lane-gate-mutant-'));
    const p = path.join(dir, 'budget.json');
    fs.writeFileSync(p, JSON.stringify({ sampleSize: 5, p95BudgetMs: 250, absoluteFailMs: 1000, ...overrides }));
    return p;
  }

  it('BUDGET BREACH: a real ~40ms-per-firing function exceeds an intentionally tiny p95BudgetMs', async () => {
    const budgetPath = tinyBudgetFixture({ p95BudgetMs: 1, absoluteFailMs: 5000 }); // budget far below reality
    const slowFn = () => new Promise((resolve) => setTimeout(() => resolve({ hit: false }), 40));
    const result = await runCardLaneGate({ dir: KB_DIR, budgetPath, answerFn: slowFn });
    expect(result.pass).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/BUDGET BREACH/);
    fs.rmSync(path.dirname(budgetPath), { recursive: true, force: true });
  });

  it('ABSOLUTE FAIL: a real ~1100ms-per-firing function crosses absoluteFailMs and is labeled a correctness event', async () => {
    const budgetPath = tinyBudgetFixture({ p95BudgetMs: 250, absoluteFailMs: 1000 });
    const slowFn = () => new Promise((resolve) => setTimeout(() => resolve({ hit: false }), 1100));
    const result = await runCardLaneGate({ dir: KB_DIR, budgetPath, queries: ['x'], answerFn: slowFn });
    expect(result.pass).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/ABSOLUTE FAIL/);
    fs.rmSync(path.dirname(budgetPath), { recursive: true, force: true });
  }, 15000);
});

describe('BUDGET_PATH points at the checked-in manifest, not an invented location', () => {
  it('resolves under kb/ in this repo', () => {
    expect(BUDGET_PATH).toBe(path.join(REPO, 'kb', 'card-lane-budget.json'));
    expect(fs.existsSync(BUDGET_PATH)).toBe(true);
  });
});
