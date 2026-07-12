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
import { loadCatalog, loadPolicy, CONFIG_DIR } from './model-router-engine.mjs';

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

function detectInventory() {
  const has = (cmd) => {
    try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; }
  };
  const keyPresent = (name) => !!process.env[name];
  return {
    claudeCli: has('claude'),
    codexCli: has('codex'),
    codexAuthed: fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json')),
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
  const candidates = loadCatalog();
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

  console.log(`MetaHarness Router — current plan`);
  console.log(`Catalog last updated: ${result.catalogUpdated}`);
  console.log(`Active policy: ${result.activePolicy}`);
  console.log('');
  console.log('Detected on this machine:');
  console.log(`  claude CLI: ${inventory.claudeCli ? 'present' : 'not found'}   codex CLI: ${inventory.codexCli ? (inventory.codexAuthed ? 'present, authed' : 'present, not authed') : 'not found'}`);
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
