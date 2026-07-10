#!/usr/bin/env node
// scripts/route-cheap.mjs — THE place cheap-model routing happens, so the visibility line is earned.
//
// Grounding (verified, not recalled):
//   - The real cheap-routing path is agentic-flow's CLI: any --model containing "/" auto-routes
//     through OpenRouter (agentic-flow/src/router/index.ts exports OpenRouterProvider; verified
//     live 2026-07-07 — see plugin/skills/ruvnet-brain/SKILL.md "Cost-optimal model routing").
//   - NOT mcp__ruflo__agent_execute (Anthropic-only), NOT the neural router (chance-level per
//     rUv's own ROUTER-PILOT.md benchmark).
//   - Pricing below was pulled live from the OpenRouter API on 2026-07-07 (same SKILL.md table).
//
// What it does, visibly (Stuart directive: "invisible value = no value"):
//   1. Runs the task on a cheap model via `npx agentic-flow@latest`.
//   2. Appends a receipt to ~/.claude/metaharness/routing-receipts.jsonl (machine-wide).
//   3. Prints ONE dim line: "⚡ MetaHarness: routed to <model> (est. $X vs $Y frontier — saved ~$Z)".
//
// Usage:
//   node scripts/route-cheap.mjs --task "summarize X" [--model deepseek/deepseek-chat]
//                                [--agent researcher] [--class research]
//
// Scope guard: read-only text work ONLY (research / summarize / classify / transform). This path
// has no file-write capability and no native tool calling — code edits stay on Claude Code.
// The OPENROUTER_API_KEY value is read from env or ruvnet-brain/.env and NEVER printed.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// $/Mtok, verified live from the OpenRouter API 2026-07-07 (SKILL.md "Cost-optimal model routing").
export const PRICING = {
  'deepseek/deepseek-chat': { in: 0.20, out: 0.80 },
  'z-ai/glm-4.6': { in: 0.43, out: 1.74 },
  'z-ai/glm-5': { in: 0.60, out: 1.92 },
};
export const FRONTIER = { name: 'claude-opus-4.8', in: 5.0, out: 25.0 };

export function receiptsPath() {
  return (
    process.env.METAHARNESS_RECEIPTS ||
    path.join(os.homedir(), '.claude', 'metaharness', 'routing-receipts.jsonl')
  );
}

// Honest token estimate: ~4 chars/token. Labeled "est." everywhere — never presented as measured.
export const estTokens = (text) => Math.max(1, Math.ceil((text || '').length / 4));

export function estimateCosts(model, inTokens, outTokens) {
  const p = PRICING[model];
  if (!p) return null; // unknown model → no receipt rather than an invented number
  const cost = (inTokens * p.in + outTokens * p.out) / 1e6;
  const frontier = (inTokens * FRONTIER.in + outTokens * FRONTIER.out) / 1e6;
  return { cost, frontier, saved: frontier - cost };
}

const fmt$ = (n) => `$${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}`;

export function receiptLine(model, costs) {
  return `\x1b[2m⚡ MetaHarness: routed to ${model} (est. ${fmt$(costs.cost)} vs ${fmt$(costs.frontier)} frontier — saved ~${fmt$(costs.saved)})\x1b[0m`;
}

// Load OPENROUTER_API_KEY from ruvnet-brain/.env if not already in env. Value never printed/logged.
function ensureOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return true;
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = envFile.match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (m && m[1].trim()) {
      process.env.OPENROUTER_API_KEY = m[1].trim().replace(/^["']|["']$/g, '');
      return true;
    }
  } catch {
    /* no .env — fall through */
  }
  return false;
}

function parseArgs(argv) {
  const args = { model: 'deepseek/deepseek-chat', agent: 'researcher', class: 'research' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--task' || k === '--model' || k === '--agent' || k === '--class') args[k.slice(2)] = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.task) {
    console.error('Usage: node scripts/route-cheap.mjs --task "<text>" [--model deepseek/deepseek-chat] [--agent researcher] [--class research]');
    process.exit(2);
  }
  if (!PRICING[args.model]) {
    console.error(`Unknown model "${args.model}" — no verified pricing, refusing to invent savings. Known: ${Object.keys(PRICING).join(', ')}`);
    process.exit(2);
  }
  if (!ensureOpenRouterKey()) {
    console.error('OPENROUTER_API_KEY not found in env or ruvnet-brain/.env — cannot route. (Key value is never printed.)');
    process.exit(1);
  }

  const started = Date.now();
  const run = spawnSync('npx', ['agentic-flow@latest', '--agent', args.agent, '--model', args.model, '--task', args.task], {
    encoding: 'utf8',
    timeout: 180_000,
    env: process.env,
  });

  if (run.error || run.status !== 0) {
    // Honest failure: no receipt, no savings claim.
    console.error(`route-cheap: agentic-flow failed (exit ${run.status ?? 'spawn-error'}). No receipt written.`);
    if (run.stderr) console.error(run.stderr.slice(-2000));
    if (run.stdout) console.error(run.stdout.slice(-1000));
    process.exit(run.status || 1);
  }

  const output = (run.stdout || '').trim();
  console.log(output);

  const inTok = estTokens(args.task);
  const outTok = estTokens(output);
  const costs = estimateCosts(args.model, inTok, outTok);
  const receipt = {
    ts: new Date().toISOString(),
    task_class: args.class,
    task: args.task.slice(0, 120),
    model: args.model,
    agent: args.agent,
    est_in_tokens: inTok,
    est_out_tokens: outTok,
    est_cost: +costs.cost.toFixed(6),
    est_frontier_cost: +costs.frontier.toFixed(6),
    saved: +costs.saved.toFixed(6),
    frontier_ref: FRONTIER.name,
    token_source: 'chars/4 est',
    duration_ms: Date.now() - started,
    source: 'agentic-flow',
  };
  const file = receiptsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(receipt) + '\n');

  console.log('');
  console.log(receiptLine(args.model, costs));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
