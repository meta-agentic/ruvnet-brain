// tests/integration/require-brain-lane.mjs — ADR-058 D1: proves the REQUIRE_BRAIN lane is
// load-bearing, not merely a grep hit.
//
// plugin/test/run-tests.mjs (~193-229) already turns a SKIPPED core-capability battery into a
// FAILURE when REQUIRE_BRAIN=1 — but until this test (and the "warm-brain" CI job in
// .github/workflows/ci.yml) existed, REQUIRE_BRAIN appeared in ZERO workflow files, so that
// conversion was dead code no CI run had ever exercised.
//
// This file IS the ADR's named mutant, made permanent: "point the lane's cache at an empty
// directory -> REQUIRE_BRAIN converts the skip into a failure -> lane red." It creates a real,
// freshly-made EMPTY directory (the exact shape of a cold or misconfigured brain cache) and asserts
// BOTH halves of the contract:
//
//   (a) REQUIRE_BRAIN unset — a missing brain is a LOUD but NON-FATAL skip (exit 0). The fast PR
//       lane (no 736MB bundle on a fresh runner) must never turn "no brain here" into a false
//       failure.
//   (b) REQUIRE_BRAIN=1 — the SAME empty directory converts that skip into a hard FAILURE (non-zero
//       exit, naming itself in the failure list). This is the warm-brain lane's contract: if the
//       cache/download step ever silently produces an empty or stale directory, the lane must go
//       red instead of green.
//
// If REQUIRE_BRAIN's conversion logic is ever reverted from run-tests.mjs, test (b) below goes red
// — proving this check is load-bearing, not decorative. Runs via `node --test` (node:test format,
// matching tests/integration/install-smoke.mjs's idiom) — brain-independent, no network, no bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN_TESTS = path.join(ROOT, 'plugin', 'test', 'run-tests.mjs');
const CI_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');

// Runs the real battery against a freshly-created EMPTY brain dir (deleted afterward). Explicitly
// deletes any inherited REQUIRE_BRAIN so a caller's environment (e.g. running this file FROM inside
// the warm-brain job) can never leak into the "unset" case.
function runBattery({ requireBrain = false } = {}) {
  const emptyKb = fs.mkdtempSync(path.join(os.tmpdir(), 'require-brain-empty-'));
  const env = { ...process.env, RUVNET_BRAIN_KB: emptyKb };
  delete env.REQUIRE_BRAIN;
  if (requireBrain) env.REQUIRE_BRAIN = '1';
  try {
    return spawnSync(process.execPath, [RUN_TESTS], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
      env,
    });
  } finally {
    fs.rmSync(emptyKb, { recursive: true, force: true });
  }
}

test('REQUIRE_BRAIN unset — empty brain dir is a loud, NON-FATAL skip (exit 0)', () => {
  const r = runBattery();
  assert.equal(r.status, 0, `expected exit 0 (loud skip, fast lane), got ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /CORE CAPABILITY BATTERY SKIPPED/, 'must print the loud skip banner');
});

test('REQUIRE_BRAIN=1 — THE MUTANT: the same empty brain dir converts the skip into a hard FAILURE', () => {
  const r = runBattery({ requireBrain: true });
  assert.notEqual(r.status, 0, `expected a non-zero exit once REQUIRE_BRAIN=1, got ${r.status}\n${r.stdout}`);
  assert.match(
    r.stdout,
    /REQUIRE_BRAIN=1 set.*treating a skipped battery as FAILURE/,
    'must narrate the conversion',
  );
  assert.match(
    r.stdout,
    /core capability battery skipped but REQUIRE_BRAIN=1/,
    'must list the specific failure so the lane names why it is red',
  );
});

test('warm-brain explicitly instantiates the embedder the battery requires', () => {
  const workflow = fs.readFileSync(CI_WORKFLOW, 'utf8');
  assert.match(
    workflow,
    /pipeline\(['"]feature-extraction['"],\s*['"]Xenova\/all-MiniLM-L6-v2['"]/,
    'a successful reader query may warm only the reranker; CI must instantiate the embedder explicitly',
  );
  assert.match(
    workflow,
    /configureModel\(T,\s*modelCache\)/,
    'the explicit warm must point transformers at the same KB_MODEL_CACHE the battery inspects',
  );
  assert.match(
    workflow,
    /T\.env\.cacheDir\s*=\s*modelCache/,
    'the pinned installed resolver may set only localModelPath; CI must direct remote downloads to KB_MODEL_CACHE too',
  );
});
