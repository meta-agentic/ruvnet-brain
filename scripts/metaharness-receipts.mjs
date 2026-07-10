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

  const header = ['date', 'task class', 'model used', 'est. cost', 'est. frontier cost', 'saved'];
  const body = rows.map((r) => [
    (r.ts || '').replace('T', ' ').slice(0, 16),
    r.task_class || '?',
    r.model,
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

  return [
    line(header),
    line(widths.map((w) => '-'.repeat(w))),
    ...body.map(line),
    '',
    `${rows.length} routed task(s) · est. spent ${fmt$(totalCost)} vs ${fmt$(totalFrontier)} frontier (${rows[0]?.frontier_ref || 'claude-opus-4.8'}) · saved ~${fmt$(totalSaved)} (~${ratio}x cheaper)`,
    'All figures are estimates: verified OpenRouter pricing x chars/4 token estimates.',
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
