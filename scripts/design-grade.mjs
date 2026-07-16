#!/usr/bin/env node
// design-grade.mjs — the ONLY key to the design wall (plugin/scripts/design-wall.sh).
//
// WHY (2026-07-16). Stuart: "You are always supposed to look at a page as an end user would: take
// pictures of it, review it, analyze it, grade it, see if it gets a 95 or better, and if it doesn't,
// tweak it until it does — BEFORE you ever tell me something is ready." A memory-file rule was not
// enough ("suggestions mean bullshit"); this repo's own history says only walls hold. This tool
// enforces the RITUAL mechanically: it refuses to record a grade unless >=2 fresh screenshots at
// distinct widths exist and the deductions are written down. The grade itself remains judgment —
// but the receipt (shots + deductions + number) is auditable, and the wall only opens at >=95.
//
// Usage:
//   node scripts/design-grade.mjs --surface explainer --grade 96 \
//        --shot /path/a-1440.png --shot /path/b-1920.png \
//        --deductions "caption widowed at 1440 (-2); card border too faint in light (-2)"
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const get = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const shots = []; args.forEach((a, i) => { if (a === '--shot') shots.push(args[i + 1]); });
const surface = get('surface');
const grade = Number(get('grade'));
const deductions = get('deductions') || '';
const fail = (m) => { console.error('✗ ' + m); process.exit(1); };

if (!surface || !/^[a-z0-9-]+$/.test(surface)) fail('need --surface (kebab-case: explainer, console, readme, …)');
if (!Number.isFinite(grade) || grade < 0 || grade > 100) fail('need a numeric --grade 0-100');
if (shots.length < 2) fail('the ritual requires >=2 screenshots (two widths) — take them and LOOK at them first');
if (!deductions.trim()) fail('write the deductions down — a grade with no deductions is a vibe, not a grade');

const widths = new Set();
for (const s of shots) {
  if (!s || !fs.existsSync(s)) fail('missing screenshot: ' + s);
  const ageMin = (Date.now() - fs.statSync(s).mtimeMs) / 60000;
  if (ageMin > 45) fail(`stale screenshot (${ageMin | 0} min old): ${s} — the page may have changed; re-shoot`);
  try {
    const out = String(execFileSync('sips', ['-g', 'pixelWidth', s], { stdio: ['ignore', 'pipe', 'ignore'] }));
    const w = Number(out.match(/pixelWidth: (\d+)/)?.[1] || 0);
    if (w) widths.add(w);
  } catch { /* sips unavailable → widths check degrades below */ }
}
if (widths.size > 0 && widths.size < 2) fail('shots must cover >=2 distinct widths (e.g. 1440 and 1920) — got: ' + [...widths].join(', '));

const rec = {
  surface, grade, passing: grade >= 95,
  widths: [...widths].sort((a, b) => a - b),
  shots: shots.map((s) => path.resolve(s)),
  deductions, at: new Date().toISOString(),
};
const dir = path.join(os.homedir(), '.cache/ruvnet-brain');
fs.mkdirSync(dir, { recursive: true });
fs.appendFileSync(path.join(dir, 'design-grades.jsonl'), JSON.stringify(rec) + '\n');
fs.writeFileSync(path.join(dir, `design-stamp-${surface}.json`), JSON.stringify(rec, null, 2) + '\n');
console.log(`${rec.passing ? '✓ PASSING' : '✗ RECORDED — NOT PASSING'} · ${surface} graded ${grade}/100 · widths ${rec.widths.join('/') || 'unverified'} · ${shots.length} shots`);
if (!rec.passing) { console.log('  fix the deductions and re-run — the wall stays closed below 95.'); process.exit(3); }
