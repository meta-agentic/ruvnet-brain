#!/usr/bin/env node
// tests/experience/report.mjs — ADR-053 §1 / ADR-058 D2: the experience-level coverage gate.
//
// tests/experience/scenarios.json is a hand-written list of ~20 coherent scenarios — never a
// Cartesian host x os x artifact x stage matrix. ADR-053 §1 killed the matrix approach on purpose:
// its false-orthogonal axes manufacture ~100 incoherent cells whose bulk-labeling as `manual` makes
// the report permanently green (the matrix Goodharts itself in one move). A hand-written list is
// human work by design; this script is what keeps that list honest instead of aspirational.
//
// FAILS on:
//   (a) any coherent scenario left UNCLASSIFIED (missing/invalid `classification`)
//   (b) `manual` exceeding 20% of the FULL list (each `manual` entry also requires a named `owner`,
//       and sits OUTSIDE the coverage denominator — it is not counted as covered)
//   (c) THE LOAD-BEARING CHECK: any scenario classified `ci` or `scheduled-live-probe` whose
//       `evidence` names a workflow job that does NOT EXIST in .github/workflows/ — a
//       machine-checkable join, so a scenario can never point at a fictional runner. This is the
//       exact failure shape ADR-053 exists to stop: "everything worked on the machine that built
//       it, and was dead on the surface a real user touched."
//
// Usage:  node tests/experience/report.mjs [path/to/scenarios.json]
// Exits 0 with a summary on success, 1 with a FAILURES list otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const SCENARIOS_PATH = path.resolve(process.argv[2] || path.join(HERE, 'scenarios.json'));

const CLASSIFICATIONS = new Set(['ci', 'scheduled-live-probe', 'manual']);
const MANUAL_CAP = 0.20;
const JOB_REF_RE = /([A-Za-z0-9_.-]+\.ya?ml)#([A-Za-z0-9_-]+)/;

const failures = [];
const fail = (msg) => failures.push(msg);

// ── load the scenario list ───────────────────────────────────────────────────────────────────────
let data;
try {
  data = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));
} catch (e) {
  console.error(`FATAL: could not read/parse ${SCENARIOS_PATH}: ${e.message}`);
  process.exit(2);
}
const scenarios = Array.isArray(data) ? data : data.scenarios;
if (!Array.isArray(scenarios) || scenarios.length === 0) {
  console.error(`FATAL: no non-empty "scenarios" array found in ${SCENARIOS_PATH}`);
  process.exit(2);
}

// ── read the REAL job names out of every committed workflow file ───────────────────────────────
// Dependency-free (no yaml parser in package.json): reads the top-level `jobs:` block's 2-space-
// indented keys. Verified directly against every workflow file in this repo (ci.yml,
// integration-linux.yml, gists-nightly.yml, issue-watch.yml, ntfy-alerts.yml) before relying on it —
// `jobs:` is always the last top-level section and every job id is a bare 2-space-indented
// `name:` line (nested step/env keys are indented 4+ spaces, or carry a value after the colon).
function loadWorkflowJobs() {
  const map = new Map(); // 'ci.yml' -> Set(['check', 'windows-unit', ...])
  if (!fs.existsSync(WORKFLOWS_DIR)) return map;
  for (const f of fs.readdirSync(WORKFLOWS_DIR)) {
    if (!/\.ya?ml$/.test(f)) continue;
    const jobs = new Set();
    const lines = fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8').split('\n');
    let inJobs = false;
    for (const line of lines) {
      if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
      if (!inJobs) continue;
      if (/^\S/.test(line)) { inJobs = false; continue; } // dedented back out of jobs:
      const m = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
      if (m) jobs.add(m[1]);
    }
    map.set(f, jobs);
  }
  return map;
}
const workflowJobs = loadWorkflowJobs();

// ── per-scenario checks ──────────────────────────────────────────────────────────────────────────
let manualCount = 0;
scenarios.forEach((s, i) => {
  const id = s && s.id ? s.id : `#${i}`;
  const cls = s && s.classification;

  if (!cls || !CLASSIFICATIONS.has(cls)) {
    fail(`${id}: UNCLASSIFIED (classification=${JSON.stringify(cls)}) — must be one of ${[...CLASSIFICATIONS].join(' | ')}`);
    return;
  }

  if (cls === 'manual') {
    manualCount++;
    if (!s.owner || !String(s.owner).trim()) fail(`${id}: classification=manual requires a named owner`);
    return;
  }

  // cls is 'ci' or 'scheduled-live-probe' — the machine-checkable join.
  const ref = String(s.evidence || '').match(JOB_REF_RE);
  if (!ref) {
    fail(`${id}: classification=${cls} but evidence names no "<workflow>.yml#<job>" token — cannot verify the runner exists`);
    return;
  }
  const [, file, job] = ref;
  const jobs = workflowJobs.get(file);
  if (!jobs) {
    fail(`${id}: points at workflow file "${file}", which does not exist in .github/workflows/`);
    return;
  }
  if (!jobs.has(job)) {
    fail(`${id}: points at job "${job}" in ${file}, which has no such job (real jobs there: ${[...jobs].join(', ') || 'none'})`);
  }
});

// ── manual-share cap (manual sits OUTSIDE the coverage denominator, but is capped against the FULL list) ──
const manualShare = manualCount / scenarios.length;
if (manualShare > MANUAL_CAP) {
  fail(`manual scenarios are ${(manualShare * 100).toFixed(1)}% of the list (${manualCount}/${scenarios.length}) — cap is ${(MANUAL_CAP * 100).toFixed(0)}%`);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────
const covered = scenarios.length - manualCount;
console.log(`tests/experience/scenarios.json — ${scenarios.length} scenarios (${manualCount} manual, ${covered} machine-reachable — ci/scheduled-live-probe)`);
console.log(`manual share: ${(manualShare * 100).toFixed(1)}% (cap ${(MANUAL_CAP * 100).toFixed(0)}%)`);

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nAll scenarios classified; every ci/scheduled-live-probe evidence join resolves to a real workflow job; manual share within cap.');
process.exit(0);
