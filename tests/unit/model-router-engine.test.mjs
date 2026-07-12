// tests/unit/model-router-engine.test.mjs — locks the model-router-engine's contract.
// End-to-end: invokes the real CLI (catalog + policy loading included), asserts on the JSON.
// Redirects the decision log to a temp file so tests never pollute the real ledger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/model-router-engine.mjs');
const LOG = path.join(os.tmpdir(), `router-decisions-test-${process.pid}.jsonl`);
const run = (args) =>
  JSON.parse(
    execFileSync('node', [ENGINE, ...args, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, MODEL_ROUTER_DECISIONS: LOG },
    })
  );

test('claude-code short research -> cheap tier, a model is chosen', () => {
  const d = run(['--harness', 'claude-code', '--prompt', 'In one sentence, what is HNSW?']);
  assert.equal(d.harness, 'claude-code');
  assert.equal(d.tier, 'cheap');
  assert.ok(d.model, 'a model was chosen');
});

test('codex gets a codex-capable model (never a claude-only model)', () => {
  const d = run(['--harness', 'codex', '--prompt', 'summarize this article']);
  assert.equal(d.harness, 'codex');
  assert.ok(!/^claude-/.test(d.model), `codex must not get a claude-only model, got ${d.model}`);
});

test('security + code escalates above the cheap tier', () => {
  const d = run([
    '--harness',
    'codex',
    '--prompt',
    'Refactor and fix the SQL injection security vulnerability in this auth module; prove correctness. ```js\nq="SELECT..."+id\n```',
  ]);
  assert.notEqual(d.tier, 'cheap', `security/refactor should escalate, got ${d.tier}`);
});

test('$1,600 floor: claude-code prefers the $0 subscription model over a billed one in-tier', () => {
  const d = run(['--harness', 'claude-code', '--prompt', 'hi']); // trivial -> cheap tier
  assert.equal(d.provider, 'anthropic', `expected a subscription model, got ${d.model} (${d.provider})`);
  assert.equal(d.est_input_cost_usd, null, 'a subscription model must carry no billed cost');
});

test('pluggable policy.mjs overrides selection (the core requirement)', () => {
  const tmp = path.join(os.tmpdir(), `router-policy-test-${process.pid}.mjs`);
  fs.writeFileSync(
    tmp,
    "export function choose(){ return { model:'deepseek/deepseek-chat', provider:'openrouter', tier:'cheap', reason:'forced by test policy', confidence:1 }; }"
  );
  try {
    const d = run(['--harness', 'codex', '--policy', tmp, '--prompt', 'anything at all']);
    assert.equal(d.model, 'deepseek/deepseek-chat');
    assert.match(d.reason, /forced by test policy/);
  } finally {
    fs.rmSync(tmp, { force: true });
    fs.rmSync(LOG, { force: true });
  }
});
