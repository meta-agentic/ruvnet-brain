// tests/unit/model-router-engine.test.mjs — locks the model-router-engine's contract.
// End-to-end through the REAL CLI, but fully HERMETIC: a fixture catalog (MODEL_ROUTER_CATALOG),
// the repo's own shipped default policy (--policy config/model-router/policy.default.mjs), a
// fixture profile (MODEL_ROUTER_PROFILE), and a temp decision log. The first version of this file
// silently depended on ~/.claude/model-router existing on the dev machine — CI runners have no
// such directory, so the engine fell back to no-policy/cheapest and three assertions failed on
// every runner from the moment the file landed (2026-07-12). Never again: everything the engine
// reads is pinned to fixtures here. Vitest, like the rest of tests/unit — node:test files make
// vitest error "No test suite found in file".
import { test, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(ROOT, 'scripts', 'model-router-engine.mjs');
const POLICY = path.join(ROOT, 'config', 'model-router', 'policy.default.mjs'); // the SHIPPED policy
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'router-test-'));
const CATALOG = path.join(TMP, 'catalog.json');
const PROFILE = path.join(TMP, 'profile.json');
const LOG = path.join(TMP, 'decisions.jsonl');

// Fixture catalog: the shapes the contract cares about — subscription-covered models on both
// harnesses, billed OpenRouter models, tier spread. Prices are fixture values, not claims.
const FIXTURE = {
  updated: 'fixture',
  candidates: [
    { id: 'claude-haiku-fixture', provider: 'anthropic', harness: ['claude-code'], subscription: ['claude-code'], tier: 'cheap', costPerMTok: null, verified: null },
    { id: 'claude-sonnet-fixture', provider: 'anthropic', harness: ['claude-code'], subscription: ['claude-code'], tier: 'mid', costPerMTok: null, verified: null },
    { id: 'claude-opus-fixture', provider: 'anthropic', harness: ['claude-code'], subscription: ['claude-code'], tier: 'frontier', costPerMTok: { in: 5, out: 25 }, verified: 'fixture' },
    { id: 'gpt-frontier-fixture', provider: 'openai', harness: ['codex'], subscription: ['codex'], tier: 'frontier', costPerMTok: null, verified: null },
    { id: 'or/cheap-fixture', provider: 'openrouter', harness: ['claude-code', 'codex'], subscription: [], tier: 'cheap', costPerMTok: { in: 0.1, out: 0.2 }, verified: 'fixture' },
    { id: 'or/mid-fixture', provider: 'openrouter', harness: ['claude-code', 'codex'], subscription: [], tier: 'mid', costPerMTok: { in: 0.5, out: 1.5 }, verified: 'fixture' },
  ],
};

beforeAll(() => {
  fs.writeFileSync(CATALOG, JSON.stringify(FIXTURE));
  fs.writeFileSync(PROFILE, JSON.stringify({
    harnesses: {
      'claude-code': { available: true, subscription: true, basis: 'fixture' },
      codex: { available: true, subscription: true, basis: 'fixture' },
    },
  }));
});
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const run = (args, extraEnv = {}) =>
  JSON.parse(
    execFileSync(process.execPath, [ENGINE, ...args, '--policy', POLICY, '--json'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MODEL_ROUTER_CATALOG: CATALOG,
        MODEL_ROUTER_PROFILE: PROFILE,
        MODEL_ROUTER_DECISIONS: LOG,
        ...extraEnv,
      },
    })
  );

test('claude-code short research -> cheap tier, a subscription model is chosen', () => {
  const d = run(['--harness', 'claude-code', '--prompt', 'In one sentence, what is HNSW?']);
  expect(d.harness).toBe('claude-code');
  expect(d.tier).toBe('cheap');
  expect(d.model).toBe('claude-haiku-fixture');
});

test('codex gets a codex-capable model (never a claude-only model)', () => {
  const d = run(['--harness', 'codex', '--prompt', 'summarize this article']);
  expect(d.harness).toBe('codex');
  expect(d.model).not.toMatch(/^claude-/);
});

test('security + code escalates above the cheap tier', () => {
  const d = run([
    '--harness', 'codex', '--prompt',
    'Refactor and fix the SQL injection security vulnerability in this auth module; prove correctness. ```js\nq="SELECT..."+id\n```',
  ]);
  expect(d.tier).not.toBe('cheap');
});

test('$1,600 floor: claude-code prefers the $0 subscription model over a billed one in-tier', () => {
  const d = run(['--harness', 'claude-code', '--prompt', 'hi']); // trivial -> cheap tier
  expect(d.provider).toBe('anthropic');
  expect(d.est_input_cost_usd).toBeNull();
});

test('cross-tier $0 floor: codex never pays a billed model while a subscription model can do the job', () => {
  const d = run(['--harness', 'codex', '--prompt', 'summarize this article in one line']);
  const paysWhileSubscriptionExists = d.provider === 'openrouter' && d.est_input_cost_usd > 0;
  expect(paysWhileSubscriptionExists).toBe(false);
});

test('per-user profile: a user WITHOUT a codex subscription gets billed candidates, never a phantom $0', () => {
  const noCodexSub = path.join(TMP, 'profile-nocodex.json');
  fs.writeFileSync(noCodexSub, JSON.stringify({
    harnesses: {
      'claude-code': { available: true, subscription: true },
      codex: { available: true, subscription: false },
    },
  }));
  const d = run(['--harness', 'codex', '--prompt', 'summarize this article'], { MODEL_ROUTER_PROFILE: noCodexSub });
  expect(d.model).toBeTruthy();
  expect(d.provider).not.toBe('openai'); // the codex-subscription model must NOT be treated as $0
});

test('per-user profile: an unavailable harness disappears from the candidate pool', () => {
  const noCodex = path.join(TMP, 'profile-unavail.json');
  fs.writeFileSync(noCodex, JSON.stringify({
    harnesses: {
      'claude-code': { available: true, subscription: true },
      codex: { available: false, subscription: false },
    },
  }));
  const d = run(['--harness', 'codex', '--prompt', 'hello'], { MODEL_ROUTER_PROFILE: noCodex });
  expect(d.model || '').not.toMatch(/^gpt-/);
});

test('pluggable policy overrides selection (the core requirement)', () => {
  const forced = path.join(TMP, 'forced-policy.mjs');
  fs.writeFileSync(forced,
    "export function choose(){ return { model:'or/cheap-fixture', provider:'openrouter', tier:'cheap', reason:'forced by test policy', confidence:1 }; }");
  const out = JSON.parse(
    execFileSync(process.execPath, [ENGINE, '--harness', 'codex', '--policy', forced, '--prompt', 'anything', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, MODEL_ROUTER_CATALOG: CATALOG, MODEL_ROUTER_PROFILE: PROFILE, MODEL_ROUTER_DECISIONS: LOG },
    })
  );
  expect(out.model).toBe('or/cheap-fixture');
  expect(out.reason).toMatch(/forced by test policy/);
});
