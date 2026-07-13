#!/usr/bin/env node
// scripts/metaharness-receipts.mjs — plain-language routing receipts: what MetaHarness cheap-routing
// actually did and what it saved. Reads the REAL log written by scripts/route-cheap.mjs at
// ~/.claude/metaharness/routing-receipts.jsonl (override: METAHARNESS_RECEIPTS env, used by tests).
// No data → says so plainly. Never invents numbers (all costs are estimates from verified
// OpenRouter pricing + chars/4 token estimates, and are labeled "est.").
//
// Usage: node scripts/metaharness-receipts.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

export function receiptsPath() {
  return (
    process.env.METAHARNESS_RECEIPTS ||
    path.join(os.homedir(), '.claude', 'metaharness', 'routing-receipts.jsonl')
  );
}

// Parse the JSONL log. Corrupt lines are skipped (counted), never guessed at.
export function loadReceipts(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { rows: [], skipped: 0 };
  }
  const rows = [];
  let skipped = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (typeof r.saved === 'number' && r.model) rows.push(r);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { rows, skipped };
}

const fmt$ = (n) => `$${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}`;

export function formatTable(rows) {
  if (!rows.length) return 'No routing receipts yet.\nRoute something cheap first:  node scripts/route-cheap.mjs --task "<text>"';

  // `channel` + `instead of` (2026-07-13): subagent receipts arrived with a per-row baseline — the
  // model that agent WOULD have inherited — so a single global "frontier" column would misreport them.
  const header = ['date', 'channel', 'task class', 'model used', 'instead of', 'est. cost', 'est. baseline', 'saved'];
  const body = rows.map((r) => [
    (r.ts || '').replace('T', ' ').slice(0, 16),
    r.source === 'claude-subagent' ? 'subagent' : 'openrouter',
    r.task_class || '?',
    r.model,
    r.frontier_ref || 'claude-opus-4.8',
    fmt$(r.est_cost ?? 0),
    fmt$(r.est_frontier_cost ?? 0),
    fmt$(r.saved),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');

  const totalCost = rows.reduce((s, r) => s + (r.est_cost || 0), 0);
  const totalFrontier = rows.reduce((s, r) => s + (r.est_frontier_cost || 0), 0);
  const totalSaved = rows.reduce((s, r) => s + r.saved, 0);
  const ratio = totalCost > 0 ? (totalFrontier / totalCost).toFixed(1) : '?';
  // Lead with the PERCENTAGE — "$1.83" reads as pocket change; "68% cheaper" is the actual
  // message (Stuart, 2026-07-13). Dollars stay for auditability; percent carries the story.
  const pct = totalFrontier > 0 ? Math.round((totalSaved / totalFrontier) * 100) : 0;

  // Baselines now vary per row; name them all rather than picking one and implying it covers everything.
  const baselines = [...new Set(rows.map((r) => r.frontier_ref || 'claude-opus-4.8'))].join(', ');
  const subagents = rows.filter((r) => r.source === 'claude-subagent').length;

  // The card leads with the PERCENTAGE and a spent-vs-unrouted bar — "$1.83" reads as pocket
  // change; "68% cheaper", drawn, is the message (Stuart, 2026-07-13). The dollar table stays
  // below for auditability; every number still traces to a receipt row.
  const BAR = 30;
  const withBar = totalFrontier > 0 ? Math.min(BAR, Math.max(1, Math.round(BAR * (totalCost / totalFrontier)))) : BAR;
  const drawBar = (n) => '█'.repeat(n) + '░'.repeat(BAR - n);
  const rule = '─'.repeat(70);
  return [
    rule,
    `  💰 SAVED ~${pct}%  ·  ~${ratio}× cheaper  ·  ${rows.length} routed task(s) (${subagents} subagent, ${rows.length - subagents} openrouter)`,
    '',
    `  without routing    ${drawBar(BAR)}  ${fmt$(totalFrontier)}`,
    `  with MetaHarness   ${drawBar(withBar)}  ${fmt$(totalCost)}   → ~${fmt$(totalSaved)} kept`,
    rule,
    line(header),
    line(widths.map((w) => '-'.repeat(w))),
    ...body.map(line),
    '',
    `Baselines: ${baselines} — the model each task would have run on if it had not been routed.`,
    'Pricing is live-verified. Token counts are measured OR estimated per row (each row records which, in token_source).',
  ].join('\n');
}

function main() {
  const file = receiptsPath();
  const { rows, skipped } = loadReceipts(file);
  console.log(`MetaHarness routing receipts — ${file}`);
  console.log('');
  console.log(formatTable(rows));
  if (skipped) console.log(`(${skipped} corrupt line(s) skipped)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
