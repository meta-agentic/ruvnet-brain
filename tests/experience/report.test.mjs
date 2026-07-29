// tests/experience/report.test.mjs — ADR-058 D2: proves tests/experience/report.mjs is
// load-bearing, not decorative.
//
// The ADR names mutants that MUST make the report go red:
//   1. delete one scenario's classification -> report red
//   2. point one scenario at a non-existent workflow job/file -> report red
//   3. point a proof at a missing path OR an existing path the named job never invokes -> red
//
// Both are exercised here as real subprocess runs against MUTATED COPIES of the real
// scenarios.json (never the live file, and never in-process — a fresh process is what the real CI
// step runs). A control run against the REAL, unmodified scenarios.json is asserted green first, so
// a red result from either mutant can only be attributed to the mutation, never to a pre-existing
// break. Runs via `node --test` (node:test format, matching tests/integration/install-smoke.mjs and
// tests/integration/require-brain-lane.mjs's idiom) — no network, no bundle, no brain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const REPORT = path.join(HERE, 'report.mjs');
const REAL_SCENARIOS = JSON.parse(fs.readFileSync(path.join(HERE, 'scenarios.json'), 'utf8'));

function runReport(scenarioDoc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'experience-report-'));
  const file = path.join(dir, 'scenarios.json');
  fs.writeFileSync(file, JSON.stringify(scenarioDoc, null, 2));
  try {
    return spawnSync(process.execPath, [REPORT, file], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('CONTROL — the real, unmodified scenarios.json passes (exit 0)', () => {
  const r = runReport(REAL_SCENARIOS);
  assert.equal(r.status, 0, `expected the real scenario list to pass, got ${r.status}\n${r.stdout}\n${r.stderr}`);
});

test('MUTANT 1 — deleting one scenario\'s classification makes the report red', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  delete mutated.scenarios[0].classification; // ADR-058's named mutant, verbatim
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected a non-zero exit once a classification is deleted, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /UNCLASSIFIED/, 'must name the unclassified scenario as the reason');
});

test('MUTANT 2 — pointing one scenario at a non-existent workflow job makes the report red', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  const target = mutated.scenarios.find((s) => s.classification === 'ci');
  assert.ok(target, 'fixture assumption: at least one ci-classified scenario must exist to mutate');
  target.proofs[0].job = 'this-job-does-not-exist';
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected a non-zero exit once a scenario names a fictional job, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /this-job-does-not-exist/, 'must name the offending job in the failure output');
  assert.match(r.stdout, /job .* does not exist/, 'must say the job does not exist, not merely that something failed');
});

test('MUTANT 2b — pointing a scenario at a non-existent workflow FILE also makes the report red', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  const target = mutated.scenarios.find((s) => s.classification === 'ci');
  target.proofs[0].workflow = 'no-such-file.yml';
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected a non-zero exit once a scenario names a fictional workflow file, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /does not exist in \.github\/workflows/);
});

test('MUTANT 3a — a proof path that does not exist makes the report red', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  const target = mutated.scenarios.find((s) => s.classification === 'ci');
  target.proofs[0].path = 'tests/unit/removed-by-mutant.test.mjs';
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected a missing proof path to fail, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /not an existing repo file/);
});

test('MUTANT 3b — an existing path the named job never invokes makes the report red', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  const target = mutated.scenarios.find((s) => s.id === 'S23');
  assert.ok(target, 'fixture assumption: S23 is the scheduled published-surface probe');
  target.proofs[0].path = 'tests/unit/codex-wiring.test.mjs'; // exists, but probe job never runs it
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected an uninvoked existing proof path to fail, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /does not invoke/);
});

test('manual-share cap: pushing manual above 20% of the list makes the report red', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  for (const s of mutated.scenarios) { s.classification = 'manual'; s.owner = 'Stuart Kerr'; } // 100% manual
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected a non-zero exit once manual exceeds the cap, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /manual scenarios are 100\.0% of the list/);
});

test('a manual scenario with no owner is itself a failure (not just a silent pass)', () => {
  const mutated = structuredClone(REAL_SCENARIOS);
  const target = mutated.scenarios.find((s) => s.classification === 'manual');
  assert.ok(target, 'fixture assumption: at least one manual-classified scenario must exist');
  target.owner = '';
  const r = runReport(mutated);
  assert.notEqual(r.status, 0, `expected a non-zero exit for an ownerless manual scenario, got ${r.status}\n${r.stdout}`);
  assert.match(r.stdout, /requires a named owner/);
});
