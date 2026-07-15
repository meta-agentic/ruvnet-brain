#!/usr/bin/env node
// scripts/router-optimizer.mjs — computes two model+effort routing PROFILES (development &
// production) the router can use, DISCOVERING the bands from real data rather than assuming a
// fixed tier count. Implements the near-term slice of ADR-0015.
//
// Grounded (not recalled):
//   • Prices: this repo's verified-live tables (route-cheap.mjs PRICING + CLAUDE_TIERS, FRONTIER).
//   • Measured model picks + quality: rUv's bench (openrouter-alts.json, benched 2026-06-15) —
//     cheap→Ling-2.6-flash (100% pass, 151× cheaper than Haiku), mid→GPT-4.1 (81% quality, 4×
//     cheaper than Sonnet) or Llama-3.3-70b (70× cheaper $/quality). Cited, not invented.
//   • Real outcomes: the user's own ~/.claude/metaharness/routing-receipts.jsonl.
//   • Bucket philosophy: ruflo ADR-142 (3 complexity bands, shipped) + ADR-051 (Tier-0 mechanical,
//     $0) + ADR-149 ("tier_label is metadata, not control flow" — a quality bar over a continuum).
//
// HONESTY: the EFFORT axis (low..max) has NO per-effort measurement in the corpus yet, so v1 uses
// principled defaults tagged {effortSource:'default'}. Every cell says whether it is measured,
// on your subscription, or a default. Nothing here fabricates a quality or savings number.
//
// Usage: node scripts/router-optimizer.mjs [--no-openrouter] [--print]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { priceOf } from './route-cheap.mjs';
import { loadCatalog, detectProvider, ladderFor } from './model-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const RECEIPTS = process.env.METAHARNESS_RECEIPTS || path.join(HOME, '.claude/metaharness/routing-receipts.jsonl');
const OUT = process.env.ROUTER_PROFILES || path.join(HOME, '.claude/ruvnet-brain/router-profiles.json');

// rUv's MEASURED per-tier picks — openrouter-alts.json, benched 2026-06-15 (cited).
const MEASURED_AT = '2026-06-15';
const MEASURED = {
  cheap:    { model: 'inclusionai/ling-2.6-flash',        provider: 'openrouter', why: '100% pass on the cheap bench · 151× cheaper than Haiku 4.5' },
  mid:      { model: 'openai/gpt-4.1',                    provider: 'openrouter', why: '81% quality vs Sonnet’s 77% · 4× cheaper, 2.7× faster' },
  midValue: { model: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter', why: '91% of Sonnet’s quality at 70× cheaper $/quality' },
};

// Effort defaults per band — principled starting points, NOT measured. Corrected 2026-07-15 from
// independent evidence (Artificial Analysis + Epoch AI + a 26-PR practitioner study): efficiency
// INVERTS before max — "all-pass per dollar" peaks at high and DROPS at xhigh. So high is the default
// workhorse at mid+frontier; xhigh/max is opt-in for hard, VERIFIABLE tasks only, never a default.
const EFFORT_DEFAULT = { mechanical: 'none', cheap: 'low', mid: 'high', frontier: 'high' };

// Blended $/Mtok for the measured OpenRouter picks. Ling and GPT-4.1 from openrouter-alts.json
// (2026-06-15); Llama-3.3-70b priced from the live OpenRouter catalog snapshot (2026-07-15, in 0.13/
// out 0.40 → 0.27) so the mid band shows a real number instead of "—".
const OR_PRICE = { 'inclusionai/ling-2.6-flash': 0.02, 'openai/gpt-4.1': 5.0, 'meta-llama/llama-3.3-70b-instruct': 0.27 };
const blended = (m) => {
  if (OR_PRICE[m] != null) return OR_PRICE[m];
  const p = priceOf(m);
  return p ? +(((p.in + p.out) / 2)).toFixed(3) : null;
};

/** Does the user have an OpenRouter key reachable? (env → console config → repo .env) */
function hasOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return true;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(HOME, '.claude/ruvnet-brain/config.json'), 'utf8'));
    if (cfg.openrouterKey && String(cfg.openrouterKey).length > 8) return true;
  } catch { /* no config */ }
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    if (/^OPENROUTER_API_KEY=.+/m.test(env)) return true;
  } catch { /* no .env */ }
  return false;
}

/** Real outcome signal from the user's own receipts — which models they ran and pass rate. */
function receiptsSignal() {
  const by = {};
  try {
    for (const line of fs.readFileSync(RECEIPTS, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (!r.model) continue;
      by[r.model] = by[r.model] || { n: 0, pass: 0 };
      by[r.model].n++;
      if (r.quality_pass) by[r.model].pass++;
    }
  } catch { /* no receipts yet */ }
  return by;
}

function cell(band, model, provider, why, source, effort) {
  return {
    band, model, provider,
    effort: effort ?? EFFORT_DEFAULT[band],
    effortSource: band === 'mechanical' ? 'n/a' : 'default',
    costPerMTok: blended(model),
    why, source,
  };
}

/** Build one profile. kind ∈ {development, production}. Same complexity axis, different objective.
 *  `ladder` is the user's HOUSE ladder (from the live-verified catalog) — the frontier is always their
 *  own stack's flagship; without an OpenRouter key, cheap/mid are their house too. */
function buildProfile(kind, hasOR, ladder) {
  const dev = kind === 'development';
  const bands = [];

  // A band built straight from a verified catalog ladder entry (house cheap/mid/frontier).
  const houseBand = (band, entry, effort) => entry ? {
    band, model: entry.model, provider: ladder.provider,
    effort, effortSource: 'default', costPerMTok: entry.costPerMTok,
    why: entry.rank || 'from your stack’s ladder', source: `catalog (live-verified)${entry.released ? ' · ' + entry.released : ''}`,
  } : null;

  // Band 0 — mechanical: $0, no LLM (Agent Booster, ADR-051). Identical in both profiles.
  bands.push({
    band: 'mechanical', model: 'agent-booster', provider: 'local', effort: 'none', effortSource: 'n/a',
    costPerMTok: 0, why: 'Deterministic transforms in Rust/WASM — skips the LLM entirely',
    source: `measured ${MEASURED_AT}`,
  });

  if (hasOR) {
    // With an OpenRouter key: cheap/mid = cross-provider COST-optimal value picks (rUv's measured cascade,
    // openrouter-alts.json 2026-06-15) — the cheapest good-enough regardless of house.
    bands.push(cell('cheap', MEASURED.cheap.model, MEASURED.cheap.provider, MEASURED.cheap.why, `measured ${MEASURED_AT}`));
    const m = dev ? MEASURED.midValue : MEASURED.mid; // dev favors $/quality value; prod favors higher quality
    bands.push(cell('mid', m.model, m.provider, m.why, `measured ${MEASURED_AT}`));
  } else {
    // No OpenRouter key → recommend only what the user can reach: their own HOUSE's cheap/mid.
    const c = houseBand('cheap', ladder.cheap, EFFORT_DEFAULT.cheap); if (c) bands.push(c);
    const md = houseBand('mid', ladder.mid, EFFORT_DEFAULT.mid); if (md) bands.push(md);
  }

  // Frontier — the user's OWN HOUSE flagship (personalized), from the verified catalog: the escalation
  // target AND the savings baseline. 'high' effort by default in both profiles; xhigh is opt-in for hard,
  // verifiable tasks only (independent measurement: efficiency inverts before max — never default to xhigh).
  const f = ladder.frontier;
  bands.push({
    band: 'frontier', model: f.model, provider: ladder.provider,
    effort: 'high', effortSource: 'default', costPerMTok: f.costPerMTok,
    why: `Your ${ladder.label} frontier — ${f.rank || 'the most capable model'}`,
    source: `catalog (live-verified)${f.released ? ' · ' + f.released : ''}`,
  });

  return {
    house: ladder.label, provider: ladder.provider,
    objective: dev
      ? 'latency & throughput on your subscription (marginal-$ ≈ 0)'
      : '$/quality on metered API, reliability-weighted',
    bands,
  };
}

export function optimize({ noOpenRouter = false, provider } = {}) {
  const catalog = loadCatalog();
  const det = detectProvider(catalog, { provider });
  const ladder = ladderFor(catalog, det.provider);
  const hasOR = !noOpenRouter && hasOpenRouterKey();
  const signal = receiptsSignal();
  return {
    generatedAt: new Date().toISOString(),
    measuredAt: MEASURED_AT,
    catalogAsOf: catalog._meta?.generated || null,
    house: { provider: det.provider, label: ladder.label, source: det.source },
    hasOpenRouterKey: hasOR,
    receiptsSeen: Object.values(signal).reduce((s, v) => s + v.n, 0),
    source: 'per-house frontier from the live-verified model catalog (ADR-0016) + rUv cross-provider cascade (openrouter-alts.json) + your receipts',
    note: 'Frontier is your own stack’s flagship. Effort levels are principled defaults (high; xhigh only for hard, verifiable tasks) and refine from your outcomes.',
    profiles: {
      development: buildProfile('development', hasOR, ladder),
      production: buildProfile('production', hasOR, ladder),
    },
  };
}

export function printSummary(o) {
  const money = (v) => (v == null ? '—' : v === 0 ? '$0' : '$' + v + '/Mtok');
  const line = (c) => `    ${c.band.padEnd(11)} ${String(c.model).padEnd(38)} effort:${String(c.effort).padEnd(7)} ${money(c.costPerMTok).padEnd(11)} ${c.source}`;
  console.log(`\nRouter profiles — generated ${o.generatedAt}`);
  console.log(`OpenRouter key: ${o.hasOpenRouterKey ? 'present' : 'absent (subscription-only picks)'} · receipts seen: ${o.receiptsSeen} · measured cells: ${o.measuredAt}`);
  for (const [k, p] of Object.entries(o.profiles)) {
    console.log(`\n  ${k.toUpperCase()} — ${p.objective}`);
    for (const c of p.bands) console.log(line(c));
  }
  console.log(`\n  ${o.note}`);
}

export function main() {
  const args = process.argv.slice(2);
  const o = optimize({ noOpenRouter: args.includes('--no-openrouter') });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(o, null, 2));
  if (args.includes('--print')) printSummary(o);
  console.log(`\nWrote ${Object.keys(o.profiles).length} profiles → ${OUT}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
