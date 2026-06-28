#!/usr/bin/env node
// forge-score.mjs — MECHANICAL census-diff scorer for an rvf-kb-forge knowledge base.
//
// Step 7 of the skill. Makes the 1-100 score reproducible instead of vibes:
//   coverage% per category = (distinct repo paths COVERED by the KB) / (repo paths in that
//   category, from the Step-1 census). The overall score is the path-weighted coverage%.
//
// It re-walks the repo with the SAME enumeration + categorization rules as forge-build.mjs
// (excluded dirs, minified/lockfile/platform-stub exclusions), reads which paths the build
// actually ingested from <name>.meta.json, and prints:
//   - per-category covered/total and coverage%
//   - the EXACT uncovered paths per category (so the Step-2 loopback is mechanical, not guesswork)
//   - the overall census-diff score and a PASS/FAIL against --threshold (default 98)
//
// It does NOT embed or query — it is a pure file/coverage diff, so it is instant and offline.
// (The 10-question acceptance test in Step 6 is the retrieval-quality proof; this is the
// breadth proof. Both are required.)
//
// Usage:
//   node forge-score.mjs --repo <repo> --dir <kb-dir> --name <kb-name> [--threshold 98]
//   node forge-score.mjs <repo> <kb-dir> <kb-name> [threshold]
//
// Exit 0 if score >= threshold, else exit 1 (so it can gate CI / the honesty step).

import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag) => { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] : undefined; };
  if (a.includes('--repo') || a.includes('--dir') || a.includes('--name')) {
    return { repo: get('--repo'), dir: get('--dir'), name: get('--name'), threshold: parseFloat(get('--threshold') || '98') };
  }
  return { repo: a[0], dir: a[1], name: a[2], threshold: parseFloat(a[3] || '98') };
}

const { repo, dir, name, threshold } = parseArgs();
if (!repo || !dir || !name) {
  console.error('Usage: node forge-score.mjs --repo <repo> --dir <kb-dir> --name <kb-name> [--threshold 98]');
  process.exit(2);
}
const R = path.resolve(repo);
if (!fs.existsSync(R)) { console.error(`repo not found: ${R}`); process.exit(2); }
const META = path.join(dir, `${name}.meta.json`);
if (!fs.existsSync(META)) { console.error(`meta not found: ${META} (run forge-build.mjs first)`); process.exit(2); }

// ---- enumeration + categorization: MUST mirror forge-build.mjs ----
const SKIP_DIRS = new Set([
  'node_modules', 'target', '.git', 'dist', 'build', '.next', '.cache',
  'coverage', '.venv', 'venv', '__pycache__', '.vite', 'vendor',
]);
const SKIP_NAME_RE = /\.(min\.js|min\.css|lock)$/;
const PLATFORM_STUB_RE = /\/npm\/[^/]+\/package\.json$/;
const VENDORED_RE = /(^|\/)(stub|pkg|\.vite|dist)(\/|$)/;
const SRC_EXT = new Set(['.rs', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.py', '.go', '.c', '.cpp', '.h', '.hpp', '.java', '.rb', '.swift', '.kt']);

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
  catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (SKIP_DIRS.has(e.name)) continue; yield* walk(p); }
    else if (e.isFile()) yield p;
  }
}
const rel = (p) => path.relative(R, p);
const categoryFor = (p) => {
  const rp = rel(p);
  const base = path.basename(p);
  const ext = path.extname(p).toLowerCase();
  if (SKIP_NAME_RE.test(base)) return null;
  if (base === 'Cargo.toml') return 'manifest';
  if (base === 'package.json') {
    if (PLATFORM_STUB_RE.test(rp) || VENDORED_RE.test(rp)) return null;
    return 'manifest';
  }
  if (base === 'SKILL.md') return 'skill';
  if (ext === '.md') {
    if (/adr/i.test(rp)) return 'adr';
    if (/ddd|domain/i.test(rp)) return 'ddd';
    if (/research/i.test(rp)) return 'research';
    if (/tutorial|guide/i.test(rp)) return 'tutorial';
    return 'doc';
  }
  if (ext === '.txt' || ext === '.rst') return 'doc';
  if (ext === '.html') return 'ui';
  if (SRC_EXT.has(ext)) return 'source';
  if (['.json', '.toml', '.yaml', '.yml', '.ini', '.cfg', '.conf'].includes(ext)) return 'config';
  return 'other';
};

// ---- census denominator: every categorizable path in the tree, by category ----
const censusPaths = {};        // category -> Set(relpath)
for (const f of walk(R)) {
  const c = categoryFor(f);
  if (c === null) continue;
  (censusPaths[c] ||= new Set()).add(rel(f));
}

// ---- covered numerator: distinct paths the build actually ingested ----
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const coveredPaths = new Set(Object.values(meta.entries || {}).map((e) => e.path));
// A crate module-inventory entry has path "<dir>/src" (synthetic) — it covers the dir, not a
// file, so it never matches a census file path. That is fine: it is bonus signal, not a path
// we score against. We only credit census paths that are genuinely in coveredPaths.

// Paths the build INTENTIONALLY skipped (doc-comment-less source). These are excluded from the
// denominator — docking coverage for files that carry no extractable signal would be a permanent
// false-fail. They are reported so the exclusion is transparent, not hidden.
const skipped = new Set(meta.intentionallySkipped || []);

// ---- score ----
const cats = Object.keys(censusPaths).sort();
let totalAll = 0, coveredAll = 0, skippedAll = 0;
const rows = [];
const gaps = {};   // category -> [uncovered paths]
for (const c of cats) {
  // Denominator excludes intentionally-skipped (doc-comment-less) source paths.
  const paths = [...censusPaths[c]].filter((p) => !skipped.has(p)).sort();
  const skippedHere = [...censusPaths[c]].filter((p) => skipped.has(p)).length;
  skippedAll += skippedHere;
  const cov = paths.filter((p) => coveredPaths.has(p));
  const uncov = paths.filter((p) => !coveredPaths.has(p));
  totalAll += paths.length; coveredAll += cov.length;
  rows.push({ c, covered: cov.length, total: paths.length, skipped: skippedHere, pct: paths.length ? (cov.length / paths.length) * 100 : 100 });
  if (uncov.length) gaps[c] = uncov;
}
const overall = totalAll ? (coveredAll / totalAll) * 100 : 100;

console.log(`\n=== STEP 7: CENSUS-DIFF SCORE — ${name} ===`);
console.log(`repo: ${R}`);
console.log(`coverage = distinct covered repo paths / census repo paths (per category)\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('category', 12)} ${pad('covered/total', 14)} ${pad('skipped', 8)} coverage%`);
console.log('-'.repeat(50));
for (const r of rows) console.log(`${pad(r.c, 12)} ${pad(`${r.covered}/${r.total}`, 14)} ${pad(r.skipped || '', 8)} ${r.pct.toFixed(1)}%`);
console.log('-'.repeat(50));
console.log(`${pad('OVERALL', 12)} ${pad(`${coveredAll}/${totalAll}`, 14)} ${pad(skippedAll || '', 8)} ${overall.toFixed(2)}%`);
if (skippedAll) console.log(`(${skippedAll} doc-comment-less source file(s) excluded from denominator — add to --full to ingest)`);

const gapCats = Object.keys(gaps);
if (gapCats.length) {
  console.log(`\n--- UNCOVERED PATHS (loop back to Step 2 to fill these) ---`);
  for (const c of gapCats) {
    console.log(`[${c}] ${gaps[c].length} uncovered:`);
    for (const p of gaps[c].slice(0, 40)) console.log(`    ${p}`);
    if (gaps[c].length > 40) console.log(`    ... and ${gaps[c].length - 40} more`);
  }
  console.log('\nFix hints: source gaps -> add --full prefixes or note that doc-comment-less files'
    + ' are intentionally skipped; config gaps -> widen ingest to the needed .json/.toml/.yaml;'
    + ' doc/adr/ddd gaps -> check the file extension/dir matched the walker.');
} else {
  console.log('\nNo uncovered census paths. Full breadth coverage.');
}

const pass = overall >= threshold;
console.log(`\n=== SCORE: ${overall.toFixed(2)} / 100  (threshold ${threshold}) -> ${pass ? 'PASS' : 'FAIL — loop back to Step 2'} ===`);
process.exit(pass ? 0 : 1);
