#!/usr/bin/env node
// scripts/model-router-engine.mjs — the harness-neutral MODEL SELECTION engine.
//
// WHAT THIS IS (and is NOT):
//   • IS: a pure `prompt -> {model, provider, reason, cost}` DECISION engine. It extracts features
//     from the prompt and hands them to a PLUGGABLE POLICY that decides which model to use. The
//     policy is the swappable part — drop your researched heuristics (or a learned router) into
//     ~/.claude/model-router/policy.mjs and the engine picks them up. NO heuristics are baked in
//     here. (ADR-040 / DRACO, verified via search_ruvnet: a hand-built self-signal threshold routed
//     WORSE than always-cheapest; a learned map from a real feature beat the best fixed model. So
//     the SIGNAL/policy is everything and must never be hard-coded into the engine.)
//   • IS harness-neutral: the SAME CLI is consulted by Claude Code AND Codex. It only DECIDES; it
//     does not launch a model. The caller acts on the JSON. (Codex has no native routing surface —
//     ~/.codex/config.toml launches one model per run — so a consulted CLI is the only way to make
//     selection work for Codex too. That is the fix for "only partially OK for Codex.")
//   • Is NOT an executor. Running a task on a cheap model is route-cheap.mjs's job (OpenRouter).
//     This answers only "which model should handle this prompt?"
//
// INTEGRATION:
//   Claude Code : call from a hook/skill, parse the JSON, use .model.
//                   node model-router-engine.mjs --harness claude-code --prompt "$PROMPT" --json
//   Codex       : wrap the codex launch —
//                   M=$(node model-router-engine.mjs --harness codex --prompt "$TASK" --json | jq -r .model)
//                   codex --model "$M"  ...
//
// Config (edit freely):  ~/.claude/model-router/catalog.json   (candidates + verified pricing)
//                        ~/.claude/model-router/policy.mjs      (YOUR policy; falls back to policy.default.mjs)
// Decision log:          ~/.claude/metaharness/routing-decisions.jsonl  (sibling to route-cheap's execution receipts)
//
// Usage:
//   node model-router-engine.mjs --prompt "..." [--harness claude-code|codex] [--policy <path>] [--json|--line]
//   echo "the prompt text" | node model-router-engine.mjs --harness codex

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { estTokens } from './route-cheap.mjs'; // reuse the verified char/4 estimator (DRY)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_DIR = path.join(os.homedir(), '.claude', 'model-router');
const CATALOG_PATH = path.join(CONFIG_DIR, 'catalog.json');
const POLICY_USER = path.join(CONFIG_DIR, 'policy.mjs');
const POLICY_DEFAULT = path.join(CONFIG_DIR, 'policy.default.mjs');
const DECISIONS_LOG =
  process.env.MODEL_ROUTER_DECISIONS ||
  path.join(os.homedir(), '.claude', 'metaharness', 'routing-decisions.jsonl');

// ─── feature extraction: this is "based on what the prompt is" ────────────────────────────────
// Pure and deterministic. Emits SIGNALS only — it never decides. Policies consume these; extend
// this object as your research identifies new predictive features (it is the documented surface).
export function extractFeatures(prompt, harness) {
  const text = prompt || '';
  const codeFences = Math.floor((text.match(/```/g) || []).length / 2);
  const fileTypes = [...new Set((text.match(/\.[a-z0-9]{1,5}\b/gi) || []).map((s) => s.toLowerCase()))].slice(0, 12);
  const hasCode =
    codeFences > 0 || /\b(function|const|let|def|class|import|=>|SELECT|async)\b/.test(text) || /[{};]\s*$/m.test(text);
  return {
    chars: text.length,
    estTokens: estTokens(text),
    codeFences,
    hasCode,
    fileTypes,
    questionCount: (text.match(/\?/g) || []).length,
    taskHints: text.slice(0, 4000), // policies may regex over the actual prompt head
    harness,
  };
}

export function loadCatalog() {
  try {
    const j = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    if (Array.isArray(j.candidates) && j.candidates.length) return j.candidates;
  } catch {
    /* fall through to a minimal built-in so the engine still answers */
  }
  // Built-in fallback (verified OpenRouter prices from route-cheap; Anthropic frontier from same).
  return [
    { id: 'deepseek/deepseek-chat', provider: 'openrouter', harness: ['claude-code', 'codex'], tier: 'cheap', costPerMTok: { in: 0.2, out: 0.8 }, verified: '2026-07-07' },
    { id: 'claude-opus-4-8', provider: 'anthropic', harness: ['claude-code'], tier: 'frontier', costPerMTok: { in: 5.0, out: 25.0 }, verified: '2026-07-07' },
    { id: 'gpt-5.5', provider: 'openai', harness: ['codex'], tier: 'frontier', costPerMTok: null, verified: null },
  ];
}

export async function loadPolicy(explicit) {
  const candidatePaths = [explicit, POLICY_USER, POLICY_DEFAULT].filter(Boolean);
  for (const p of candidatePaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const mod = await import(pathToFileURL(p).href);
      if (typeof mod.choose === 'function') return { choose: mod.choose, source: p };
    } catch (e) {
      process.stderr.write(`[model-router] policy at ${p} failed to load: ${e.message}\n`);
    }
  }
  return null;
}

function parseArgs(argv) {
  const a = { harness: null, prompt: null, policy: null, mode: 'json' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--prompt') a.prompt = argv[++i];
    else if (k === '--harness') a.harness = argv[++i];
    else if (k === '--policy') a.policy = argv[++i];
    else if (k === '--line') a.mode = 'line';
    else if (k === '--json') a.mode = 'json';
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Selection-time cost is INPUT-only and clearly labeled: at selection we don't know output length,
// so we never fabricate one. Returns null when the chosen model has no verified price.
function estInputCost(candidate, inTokens) {
  const p = candidate && candidate.costPerMTok;
  if (!p || typeof p.in !== 'number') return null;
  return +((inTokens * p.in) / 1e6).toFixed(6);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 33).join('\n') + '\n');
    return;
  }
  // Harness: explicit flag wins; else detect Codex by its env/dir; else default claude-code.
  const harness =
    args.harness ||
    (process.env.CODEX_SANDBOX || fs.existsSync(path.join(os.homedir(), '.codex', 'config.toml')) && process.env.CODEX ? 'codex' : null) ||
    'claude-code';
  const prompt = args.prompt || readStdin();
  if (!prompt || !prompt.trim()) {
    process.stderr.write('model-router-engine: no prompt (use --prompt "..." or pipe text on stdin)\n');
    process.exit(2);
  }

  const candidates = loadCatalog();
  const policy = await loadPolicy(args.policy);
  const features = extractFeatures(prompt, harness);

  let decision;
  if (!policy) {
    // No policy at all: pick cheapest priced candidate for the harness as a safe floor, and SAY SO.
    const pool = candidates.filter((m) => (m.harness || []).includes(harness));
    const pick = pool.slice().sort((x, y) => (x.costPerMTok?.out ?? Infinity) - (y.costPerMTok?.out ?? Infinity))[0] || candidates[0];
    decision = { model: pick?.id ?? null, provider: pick?.provider ?? null, tier: pick?.tier ?? null, reason: 'NO POLICY FOUND — fell back to cheapest priced candidate for the harness', confidence: 0 };
  } else {
    decision = policy.choose({ features, candidates, harness });
  }

  const chosen = candidates.find((m) => m.id === decision.model) || null;
  const out = {
    ts: new Date().toISOString(),
    harness,
    model: decision.model,
    provider: decision.provider,
    tier: decision.tier,
    reason: decision.reason,
    confidence: decision.confidence,
    policy_source: policy ? policy.source.replace(os.homedir(), '~') : 'none',
    price_verified: chosen ? chosen.verified : null,
    est_input_cost_usd: estInputCost(chosen, features.estTokens), // null if price unknown — never invented
    features: { estTokens: features.estTokens, hasCode: features.hasCode, codeFences: features.codeFences, fileTypes: features.fileTypes, questionCount: features.questionCount },
  };

  // Durable decision log (append-only; separate from route-cheap's execution/savings ledger).
  try {
    fs.mkdirSync(path.dirname(DECISIONS_LOG), { recursive: true });
    fs.appendFileSync(DECISIONS_LOG, JSON.stringify({ ...out, features: undefined, prompt_head: prompt.slice(0, 120) }) + '\n');
  } catch { /* logging must never break selection */ }

  if (args.mode === 'line') {
    const cost = out.est_input_cost_usd == null ? 'cost:unpriced' : `est-in:$${out.est_input_cost_usd}`;
    process.stdout.write(`\x1b[2m🧭 model-router → ${out.model} (${out.harness}, ${out.tier}, ${cost}) — ${out.reason}\x1b[0m\n`);
  } else {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { process.stderr.write(`model-router-engine: ${e.stack || e.message}\n`); process.exit(1); });
}
