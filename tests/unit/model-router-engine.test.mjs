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
const run = (args, extraEnv = {}) =>
  JSON.parse(
    execFileSync('node', [ENGINE, ...args, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, MODEL_ROUTER_DECISIONS: LOG, ...extraEnv },
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

test('per-user profile: a user WITHOUT a codex subscription gets billed candidates, never a phantom $0', () => {
  // Stuart's mandate 2026-07-12: subscription awareness must be per-user — the catalog's
  // subscription claims only hold for users whose profile confirms them.
  const tmp = path.join(os.tmpdir(), `router-profile-test-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({
    harnesses: {
      'claude-code': { available: true, subscription: true, basis: 'test' },
      codex: { available: true, subscription: false, basis: 'test: metered API key user' },
    },
  }));
  try {
    const d = run(['--harness', 'codex', '--prompt', 'summarize this article'], { MODEL_ROUTER_PROFILE: tmp });
    // With no subscription-covered codex model, the $0 floor must NOT fire — a billed pick with a
    // real cost is the honest answer for this user.
    assert.ok(d.model, 'a model is still chosen');
    assert.notEqual(d.provider, 'openai', `codex-subscription model chosen for a user whose profile denies it (got ${d.model})`);
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('per-user profile: an unavailable harness disappears from the candidate pool', () => {
  const tmp = path.join(os.tmpdir(), `router-profile-avail-test-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify({
    harnesses: { 'claude-code': { available: true, subscription: true }, codex: { available: false, subscription: false } },
  }));
  try {
    const d = run(['--harness', 'codex', '--prompt', 'hello'], { MODEL_ROUTER_PROFILE: tmp });
    // codex-only models are gone; whatever remains must be a model that also runs elsewhere.
    assert.ok(!/^gpt-/.test(d.model || ''), `codex-only model ${d.model} chosen despite codex being unavailable for this user`);
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('cross-tier $0 floor: codex never pays a billed model while a subscription model can do the job', () => {
  // Found live 2026-07-12: demoting the unreachable gpt-5.6 tiers left codex cheap prompts routing
  // to billed DeepSeek while subscription-covered gpt-5.5 sat unused one tier up. The floor must
  // hold ACROSS tiers, not just within one.
  const d = run(['--harness', 'codex', '--prompt', 'summarize this article in one line']);
  const paysWhileSubscriptionExists = d.provider === 'openrouter' && d.est_input_cost_usd > 0;
  assert.ok(!paysWhileSubscriptionExists, `codex routed to billed ${d.model} despite a subscription-covered candidate existing`);
});
