// tests/mutation/claims-freshness-mutation.test.mjs — the falsifiability proof for the freshness
// precondition. House rule: "a test that cannot fail on broken code is not a test."
//
// tests/unit/claims-artifact-freshness.test.mjs asserts that a STALE coverage artifact is never
// graded. That assertion is only worth something if it FALLS when the freshness check is removed —
// otherwise it might be passing because of something else entirely (the badge check, the all:true
// check, a lucky fixture). So here the real scripts/claims-verify.mjs is copied with ONE targeted
// mutation — the freshness gate short-circuited to never fire — and we prove the mutant does the
// exact thing the fix exists to prevent: it grades a nine-day-stale artifact and returns a confident
// PASS. Silently. Which is what the shipped gate did on 2026-07-26.
//
// The mutation must change something (asserted), so a refactor that moves the target line fails
// LOUDLY instead of quietly running an unmutated copy and "passing".
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyCoverageBadge } from '../../scripts/claims-verify.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REAL = path.join(REPO, 'scripts', 'claims-verify.mjs');
// Lives in scripts/ so its sibling-relative resolution matches the real module's.
const MUTANT = path.join(REPO, 'scripts', '_mutant-claims-verify.mjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-mutation-'));
afterEach(() => { try { fs.rmSync(MUTANT, { force: true }); } catch { /* best effort */ } });

async function withMutant(mutate, fn) {
  const src = fs.readFileSync(REAL, 'utf8');
  const mutated = mutate(src);
  if (mutated === src) {
    throw new Error('mutation changed nothing — the target moved. This test would otherwise run an UNMUTATED copy and pass for the wrong reason.');
  }
  fs.writeFileSync(MUTANT, mutated);
  try {
    return await fn(await import(`${pathToFileURL(MUTANT).href}?v=${Date.now()}`));
  } finally {
    fs.rmSync(MUTANT, { force: true });
  }
}

/**
 * The exact live shape of the defect: a coverage summary written days ago, a source file edited
 * since, and numbers that still happen to AGREE with the badge — so grading it yields a confident,
 * completely unearned PASS.
 */
function staleButAgreeingFixture(name) {
  const root = path.join(TMP, name);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'coverage'), { recursive: true });

  const srcFile = path.join(root, 'src', 'a.mjs');
  const vitestFile = path.join(root, 'vitest.config.mjs');
  const readmeFile = path.join(root, 'README.md');
  const summaryFile = path.join(root, 'coverage', 'coverage-summary.json');

  fs.writeFileSync(srcFile, 'export const a = 1;\n');
  fs.writeFileSync(vitestFile, 'export default { test: { coverage: { all: true, include: ["src/*.mjs"], exclude: [] } } };\n');
  fs.writeFileSync(readmeFile, '# X\n[![coverage](https://img.shields.io/badge/coverage-15%25%20of%20ALL%20source%20·%20honest-b58900)](#)\n');
  fs.writeFileSync(summaryFile, JSON.stringify({
    total: { statements: { pct: 17 }, branches: { pct: 15.4 }, functions: { pct: 20 }, lines: { pct: 18 } },
    [srcFile]: { statements: { pct: 17 } },
  }));

  const at = (f, s) => { const t = new Date(Date.now() + s * 1000); fs.utimesSync(f, t, t); };
  at(vitestFile, -9 * 86400);
  at(summaryFile, -9 * 86400); // measured nine days ago…
  at(srcFile, -60); //            …the source it measured has moved on since
  return { root, readmeFile, summaryFile, vitestFile };
}

describe('mutation — the freshness precondition must be load-bearing', () => {
  it('baseline: the REAL gate refuses to grade the stale artifact (SKIP, never a number)', async () => {
    const f = staleButAgreeingFixture('baseline');
    const res = await verifyCoverageBadge(f.readmeFile, f.summaryFile, f.vitestFile, f.root);
    expect(res.status).toBe('SKIP');
    expect(res.evidence).toMatch(/STALE/);
  });

  it('MUTANT (freshness gate disabled): the SAME stale artifact grades as a confident PASS — the silent lie, reproduced', async () => {
    const f = staleButAgreeingFixture('mutant');
    const res = await withMutant(
      // the one line that stands between a rotting artifact and a published number
      (src) => src.replace('  if (!state.fresh) {\n    return skip(', '  if (false) {\n    return skip('),
      (mod) => mod.verifyCoverageBadge(f.readmeFile, f.summaryFile, f.vitestFile, f.root),
    );
    expect(res.status).toBe('PASS'); // ← the defect: nine days stale, graded, published
    expect(res.evidence).toMatch(/re-derived floor 15%/); // and it even sounds authoritative
  });

  it('MUTANT (completeness check disabled): a PARTIAL summary from an aborted run grades as truth', async () => {
    // Second half of the same defect class: the run that ends on a failing test can leave nothing,
    // or leave a fragment. A fragment's `total` is a denominator nobody measured.
    const f = staleButAgreeingFixture('mutant-partial');
    const at = (file, s) => { const t = new Date(Date.now() + s * 1000); fs.utimesSync(file, t, t); };
    at(path.join(f.root, 'src', 'a.mjs'), -10 * 86400); // not stale any more…
    const orphan = path.join(f.root, 'src', 'never-measured.mjs');
    fs.writeFileSync(orphan, 'export const b = 2;\n'); // …but a covered file is absent from the summary
    at(orphan, -10 * 86400);

    const real = await verifyCoverageBadge(f.readmeFile, f.summaryFile, f.vitestFile, f.root);
    expect(real.status).toBe('SKIP');
    expect(real.evidence).toMatch(/PARTIAL/);

    const mutant = await withMutant(
      (src) => src.replace('    if (unmeasured.length) {', '    if (false) {'),
      (mod) => mod.verifyCoverageBadge(f.readmeFile, f.summaryFile, f.vitestFile, f.root),
    );
    expect(mutant.status).toBe('PASS');
  });

  it('leaves no mutant behind — a stray copy in scripts/ would be scanned by every other gate', () => {
    expect(fs.existsSync(MUTANT)).toBe(false);
  });
});
