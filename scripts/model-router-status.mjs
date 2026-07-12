#!/usr/bin/env node
// scripts/model-router-status.mjs — "what is MetaHarness's current plan?", answered plainly.
//
// Shows, for each harness (claude-code, codex): the live catalog, which policy is active, what
// it would actually pick for a cheap/mid/frontier-shaped prompt right now (by calling the REAL
// engine CLI — this never reimplements selection logic, so it can't drift from what actually runs),
// which candidates are landscape-only (known, not yet wired for execution), and catalog freshness.
//
// Usage: node scripts/model-router-status.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog, loadPolicy, loadProfile, applyProfile, CONFIG_DIR } from './model-router-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.join(__dirname, 'model-router-engine.mjs');

const SAMPLE_PROMPTS = {
  cheap: 'Fix this typo in the README.',
  mid: 'Add a new API endpoint that validates input and returns paginated results.',
  frontier: 'Refactor this auth module to fix a security vulnerability and prove correctness under concurrent access.',
};

function sampleDecision(harness, prompt) {
  try {
    const out = execFileSync('node', [ENGINE, '--harness', harness, '--prompt', prompt, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, MODEL_ROUTER_DECISIONS: path.join(os.tmpdir(), 'model-router-status-preview.jsonl') },
    });
    return JSON.parse(out);
  } catch (e) {
    return { model: null, tier: null, reason: `engine call failed: ${e.message}` };
  }
}

// HOW Codex is paid for, read from ~/.codex/auth.json's SHAPE (never its secrets): OAuth tokens =
// "Sign in with ChatGPT" — usage bills the ChatGPT plan (Plus/Pro/Business all include Codex), so
// marginal cost is $0 and the catalog's subscription:["codex"] entries are correct. An OPENAI_API_KEY
// instead = metered per-token billing — flip those subscription fields to [] or the $0-floor lies.
// Verified live on this machine 2026-07-12: tokens present, no API key -> chatgpt-subscription.
function codexAuthMode() {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex', 'auth.json'), 'utf8'));
    if (a.tokens) return 'chatgpt-subscription';
    if (a.OPENAI_API_KEY) return 'api-key-metered';
  } catch { /* absent or unreadable — not authed */ }
  return null;
}

function detectInventory() {
  const has = (cmd) => {
    try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; }
  };
  const keyPresent = (name) => !!process.env[name];
  return {
    claudeCli: has('claude'),
    codexCli: has('codex'),
    codexAuthed: fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json')),
    codexAuthMode: codexAuthMode(),
    keys: {
      ANTHROPIC_API_KEY: keyPresent('ANTHROPIC_API_KEY'),
      OPENAI_API_KEY: keyPresent('OPENAI_API_KEY'),
      GOOGLE_API_KEY: keyPresent('GOOGLE_API_KEY') || keyPresent('GEMINI_API_KEY'),
      XAI_API_KEY: keyPresent('XAI_API_KEY'),
      OPENROUTER_API_KEY: keyPresent('OPENROUTER_API_KEY'),
    },
  };
}

async function main() {
  const jsonMode = process.argv.includes('--json');
  // Profile-aware, same as the engine: what this tool displays must be what routing actually does.
  const candidates = applyProfile(loadCatalog(), loadProfile());
  const policy = await loadPolicy();
  const catalogRaw = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'catalog.json'), 'utf8'));
  const inventory = detectInventory();

  const selectable = candidates.filter((c) => Array.isArray(c.harness) && c.harness.length > 0);
  const landscapeOnly = candidates.filter((c) => !Array.isArray(c.harness) || c.harness.length === 0);

  const plan = {};
  for (const harness of ['claude-code', 'codex']) {
    plan[harness] = {};
    for (const [tierLabel, prompt] of Object.entries(SAMPLE_PROMPTS)) {
      const d = sampleDecision(harness, prompt);
      plan[harness][tierLabel] = { model: d.model, actualTier: d.tier, cost: d.est_input_cost_usd, reason: d.reason };
    }
  }

  const result = {
    catalogUpdated: catalogRaw.updated,
    activePolicy: policy ? policy.source.replace(os.homedir(), '~') : 'NONE — falling back to cheapest priced candidate (no policy found)',
    inventory,
    plan,
    selectableCandidateCount: selectable.length,
    landscapeOnlyCandidates: landscapeOnly.map((c) => ({ id: c.id, provider: c.provider, note: c.note })),
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── The plain-language answer first (Stuart, 2026-07-12: "show them what the current
  // recommended path is — the zero-cost options, and what it uses when it must go out for API
  // calls"). Everything below it is the detailed evidence; this block is the one a person reads.
  console.log('Recommended path (zero-cost first, always):');
  console.log('  $0 — covered by YOUR subscriptions:');
  for (const harness of ['claude-code', 'codex']) {
    const p = plan[harness];
    const zero = ['cheap', 'mid', 'frontier']
      .map((t) => ({ t, m: p[t].model, free: p[t].cost == null && p[t].model }))
      .filter((x) => x.free);
    if (zero.length) {
      const parts = zero.map((x) => `${x.t}→${x.m}`);
      console.log(`    ${harness.padEnd(12)} ${parts.join(' · ')}`);
    } else {
      console.log(`    ${harness.padEnd(12)} (no subscription-covered models for this user — see profile)`);
    }
  }
  const billed = selectable
    .filter((c) => c.costPerMTok && typeof c.costPerMTok.out === 'number' && !(c.subscription || []).length)
    .sort((a, b) => a.costPerMTok.out - b.costPerMTok.out)
    .slice(0, 3);
  console.log('  Paid API — only when work must leave the subscriptions (parallel fleets, background batch):');
  for (const c of billed) {
    console.log(`    ${c.id.padEnd(28)} $${c.costPerMTok.in}/M in · $${c.costPerMTok.out}/M out  (${c.tier}, verified ${String(c.verified || '').slice(0, 10)})`);
  }
  console.log('');
  console.log(`MetaHarness Router — current plan`);
  console.log(`Catalog last updated: ${result.catalogUpdated}`);
  console.log(`Active policy: ${result.activePolicy}`);
  console.log('');
  console.log('Detected on this machine:');
  const codexPay = inventory.codexAuthMode === 'chatgpt-subscription' ? 'authed via ChatGPT subscription ($0 marginal)'
    : inventory.codexAuthMode === 'api-key-metered' ? 'authed via API key (METERED — subscription fields in catalog.json should be [])'
    : inventory.codexAuthed ? 'authed (mode unknown)' : 'not authed';
  console.log(`  claude CLI: ${inventory.claudeCli ? 'present' : 'not found'}   codex CLI: ${inventory.codexCli ? `present, ${codexPay}` : 'not found'}`);
  const keyList = Object.entries(inventory.keys).filter(([, v]) => v).map(([k]) => k.replace('_API_KEY', ''));
  console.log(`  API keys present: ${keyList.length ? keyList.join(', ') : 'none'}`);
  console.log('');
  for (const harness of ['claude-code', 'codex']) {
    console.log(`${harness}:`);
    for (const tierLabel of ['cheap', 'mid', 'frontier']) {
      const p = plan[harness][tierLabel];
      const costStr = p.cost == null ? (p.model ? 'subscription/$0 or unpriced' : '') : `est $${p.cost}`;
      console.log(`  ${tierLabel.padEnd(9)} -> ${(p.model || '(none)').padEnd(28)} ${costStr}`);
    }
  }
  console.log('');
  console.log(`Selectable candidates: ${result.selectableCandidateCount}   Landscape-only (known, not yet wired): ${landscapeOnly.length}`);
  if (landscapeOnly.length) {
    for (const c of landscapeOnly) console.log(`  - ${c.id} (${c.provider}): ${c.note}`);
  }
}

main().catch((e) => { process.stderr.write(`model-router-status: ${e.stack || e.message}\n`); process.exit(1); });
