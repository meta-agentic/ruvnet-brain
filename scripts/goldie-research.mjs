#!/usr/bin/env node
// goldie-research.mjs — Goldie's DETERMINISTIC core: keep the model-router catalog verifiably fresh.
//
// Stuart's standing mandate (2026-07-12): the router must never run on stale beliefs about the model
// landscape. Goldie runs WEEKLY (scripts/goldie-weekly.sh via launchd) and answers, with live data:
//   • what do the router's candidate models ACTUALLY cost right now (OpenRouter /models, public API)?
//   • did any price drift >20% since the catalog was last verified (ruflo ADR-149's own re-measure
//     trigger — that threshold is rUv's, not invented here)?
//   • which Codex tiers exist on this machine right now (~/.codex/models_cache.json, fetched live
//     by Codex itself)?
//   • which cheap, tool-capable OpenRouter models exist that we DON'T track (the "worth a look" radar)?
//
// It updates ONLY prices + verified-stamps in ~/.claude/model-router/catalog.json. It NEVER adds an
// execution path (harness/subscription fields) — the catalog's own rule: an engine that "chooses" a
// model it can't run is worse than one that doesn't know it exists. New-model adoption and bucket
// taxonomy are JUDGMENT calls: goldie-weekly.sh layers a headless-Claude research pass on top, and
// its output lands in the same brief as a PROPOSAL for a human/session to apply.
//
// Output: ~/.claude/model-router/goldie/YYYY-MM-DD.md (the brief) + updated catalog.json.
// Exit 0 = brief written; exit 1 = could not produce a brief (wrapper alerts loudly — no silent death).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.claude', 'model-router');
const CATALOG = path.join(CONFIG_DIR, 'catalog.json');
const GOLDIE_DIR = path.join(CONFIG_DIR, 'goldie');
const DECISIONS = path.join(os.homedir(), '.claude', 'metaharness', 'routing-decisions.jsonl');
const TODAY = new Date().toISOString().slice(0, 10);
const DRIFT_THRESHOLD = 0.20; // ADR-149 open question #3: re-measure when pricing moves >20%

async function fetchOpenRouterModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`OpenRouter /models HTTP ${res.status}`);
  const j = await res.json();
  if (!Array.isArray(j.data) || !j.data.length) throw new Error('OpenRouter /models returned no data');
  return j.data;
}

// OpenRouter pricing is $/token as strings; catalog speaks $/MTok.
const perMTok = (v) => (v == null || isNaN(+v) ? null : +(+v * 1e6).toFixed(4));

function refreshCatalogPrices(catalog, orModels) {
  const byId = new Map(orModels.map((m) => [m.id, m]));
  const changes = [];
  for (const c of catalog.candidates) {
    if (c.provider !== 'openrouter') continue;
    const live = byId.get(c.id);
    if (!live) { changes.push({ id: c.id, note: 'NOT FOUND on OpenRouter anymore — investigate before next route' }); continue; }
    const fresh = { in: perMTok(live.pricing?.prompt), out: perMTok(live.pricing?.completion) };
    if (fresh.in == null || fresh.out == null) { changes.push({ id: c.id, note: 'listed but pricing unparsable — left as-is' }); continue; }
    const old = c.costPerMTok;
    if (old && typeof old.out === 'number') {
      const drift = Math.max(Math.abs(fresh.in - old.in) / old.in, Math.abs(fresh.out - old.out) / old.out);
      if (drift > DRIFT_THRESHOLD) changes.push({ id: c.id, note: `PRICE DRIFT ${(drift * 100).toFixed(0)}%: in $${old.in}->$${fresh.in}, out $${old.out}->$${fresh.out} /MTok (>${DRIFT_THRESHOLD * 100}% — ADR-149 says re-measure quality/cost now)` });
      else if (fresh.in !== old.in || fresh.out !== old.out) changes.push({ id: c.id, note: `price updated: in $${old.in}->$${fresh.in}, out $${old.out}->$${fresh.out} /MTok` });
    }
    c.costPerMTok = fresh;
    c.verified = `${TODAY} OpenRouter API (goldie)`;
  }
  catalog.updated = TODAY;
  return changes;
}

// The radar: cheap, tool-capable models we don't track. Tool support matters because agentic work
// (the router's whole domain) is useless without it. Deterministic shortlist only — adoption is a
// judgment call for the brief's reader / the judgment layer.
function radar(catalog, orModels) {
  const tracked = new Set(catalog.candidates.map((c) => c.id));
  return orModels
    .filter((m) => !tracked.has(m.id))
    .filter((m) => (m.supported_parameters || []).includes('tools'))
    .map((m) => ({ id: m.id, in: perMTok(m.pricing?.prompt), out: perMTok(m.pricing?.completion), ctx: m.context_length }))
    .filter((m) => m.in != null && m.in >= 0 && m.in <= 0.5 && m.out != null && m.out >= 0) // negative = OpenRouter's dynamic-pricing sentinel, not a price
    .sort((a, b) => a.in - b.in)
    .slice(0, 8);
}

function codexTiers() {
  try {
    const cache = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex', 'models_cache.json'), 'utf8'));
    const models = cache.models || cache.data || [];
    const names = models.map((m) => m.id || m.slug || m.name).filter(Boolean);
    // `models` (below) is truncated to 20 for the brief's display list; `allModels` is the FULL set,
    // kept separately so the gpt-5.6 reinstate check (reinstateGpt56, below) can never miss a real
    // slug just because it landed past position #20 in the cache.
    return { fetchedAt: cache.fetched_at || cache.fetchedAt || 'unknown', models: names.slice(0, 20), allModels: names };
  } catch { return null; }
}

// GPT-5.6 auto-reinstate (Stuart's mandate, 2026-07-12): gpt-5.6-sol/terra/luna were demoted to
// landscape-only THAT SAME DAY because their "verified live" stamps were false — two independent
// reads of models_cache.json showed only gpt-5.5/5.4/5.4-mini/codex-auto-review. The demotion note
// on each entry says: reinstate ONLY when a fresh read of models_cache.json actually shows the slug.
// This is that fresh read, automated, every week Goldie runs — no more relying on a human to notice.
//
// Inverse direction (any 'codex' harness entry whose gpt-* id vanishes from this week's cache) is
// FLAG-ONLY, never auto-demote: a cache miss could be rollout timing or a transient cache staleness,
// not proof the model is gone — the same false-confidence mistake in reverse. Demotion stays a
// judgment call for a human/Goldie's judgment pass, same as the 2026-07-12 demotion itself was.
function reinstateGpt56(catalog, codex) {
  const result = { reinstated: [], warnings: [] };
  if (!codex) return result; // no live cache this run (codexTiers() returned null) — skip both checks silently
  const live = new Set(codex.allModels);
  for (const c of catalog.candidates) {
    if (c.id.startsWith('gpt-5.6') && Array.isArray(c.harness) && c.harness.length === 0 && live.has(c.id)) {
      c.harness = ['codex'];
      c.subscription = ['codex'];
      c.verified = `${TODAY} ~/.codex/models_cache.json live (goldie auto-reinstate)`;
      c.note = `auto-reinstated by goldie on ${TODAY}; was demoted for false verification 2026-07-12`;
      result.reinstated.push(c.id);
    }
    if (c.id.startsWith('gpt-') && Array.isArray(c.harness) && c.harness.includes('codex') && !live.has(c.id)) {
      result.warnings.push(c.id);
    }
  }
  return result;
}

// models.env cross-check (pure informational drift-detection between the two model registries —
// ~/.claude/models.env auto-refreshes provider pins independently of the router's own catalog.json,
// so the two can silently drift apart; this just surfaces that, it never edits either file).
function parseModelsEnv() {
  try {
    const lines = fs.readFileSync(path.join(os.homedir(), '.claude', 'models.env'), 'utf8').split('\n');
    const pins = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      pins.push({ key: t.slice(0, eq).trim(), value: t.slice(eq + 1).trim() });
    }
    return pins;
  } catch { return null; }
}

// Loose match: models.env pins bare model names (e.g. 'deepseek-v4-flash') while the catalog often
// prefixes openrouter candidates with a provider ('deepseek/deepseek-v4-flash') — compare both the
// raw id and the segment after the last '/' in either direction.
function pinMatchesCatalog(pinValue, candidates) {
  const norm = pinValue.toLowerCase();
  return candidates.some((c) => {
    const cid = c.id.toLowerCase();
    const short = cid.split('/').pop();
    return cid === norm || short === norm;
  });
}

function modelsEnvCrossCheck(catalog) {
  const pins = parseModelsEnv();
  if (!pins) return null;
  return pins.map((p) => ({ ...p, known: pinMatchesCatalog(p.value, catalog.candidates) }));
}

function decisionStats() {
  try {
    const lines = fs.readFileSync(DECISIONS, 'utf8').trim().split('\n').filter(Boolean);
    const byModel = {};
    for (const l of lines) { try { const d = JSON.parse(l); byModel[d.model] = (byModel[d.model] || 0) + 1; } catch { /* skip */ } }
    return { total: lines.length, byModel };
  } catch { return { total: 0, byModel: {} } }
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const orModels = await fetchOpenRouterModels();
  const changes = refreshCatalogPrices(catalog, orModels);
  const watch = radar(catalog, orModels);
  const codex = codexTiers();
  const gpt56 = reinstateGpt56(catalog, codex);
  for (const id of gpt56.reinstated) changes.push({ id, note: `AUTO-REINSTATED: harness/subscription set to ['codex'] — slug now confirmed live in models_cache.json (goldie auto-reinstate)` });
  const envCross = modelsEnvCrossCheck(catalog);
  const stats = decisionStats();

  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
  fs.mkdirSync(GOLDIE_DIR, { recursive: true });

  const brief = [
    `# Goldie weekly model-landscape brief — ${TODAY}`,
    '',
    `Live sources: OpenRouter /api/v1/models (${orModels.length} models), ~/.codex/models_cache.json, routing-decisions.jsonl.`,
    '',
    `## Catalog price refresh (${changes.length ? changes.length + ' change(s)' : 'no changes'})`,
    ...(changes.length ? changes.map((c) => `- ${c.id}: ${c.note}`) : ['- all tracked OpenRouter prices unchanged; verified-stamps refreshed to today']),
    '',
    '## Radar: cheap tool-capable models we do NOT track (≤$0.50/MTok in, top 8 by input price)',
    ...(watch.length ? watch.map((m) => `- ${m.id} — in $${m.in}, out $${m.out} /MTok, ctx ${m.ctx}`) : ['- none matched the filter this week']),
    '',
    '## Codex tiers on this machine (live cache)',
    codex ? `- fetched_at: ${codex.fetchedAt}` : '- no ~/.codex/models_cache.json found',
    ...(codex ? codex.models.map((m) => `- ${m}`) : []),
    '',
    `## GPT-5.6 auto-reinstate check (${gpt56.reinstated.length} reinstated this run)`,
    ...(!codex ? ['- skipped: no live ~/.codex/models_cache.json this run'] :
      gpt56.reinstated.length ? gpt56.reinstated.map((id) => `- ${id}: REINSTATED — harness/subscription set to ['codex'], now confirmed live`) :
      ['- none reinstated: no gpt-5.6-* landscape entry appeared in this week\'s live cache']),
    ...(gpt56.warnings.length ? gpt56.warnings.map((id) => `- WARNING: ${id} has harness:['codex'] but is NOT in this week's live models_cache.json — verify manually before trusting it (flag only, not auto-demoted)`) : []),
    '',
    '## models.env cross-check (informational drift-detection between the two model registries; never edits either file)',
    ...(!envCross ? ['- ~/.claude/models.env not found'] : envCross.map((p) => `- ${p.key}=${p.value}${p.known ? '' : ' — NOT recognized in catalog.json (provider the router doesn\'t track, or the two registries have drifted — worth a look)'}`)),
    '',
    `## Router decision log so far (${stats.total} decisions)`,
    ...Object.entries(stats.byModel).map(([m, n]) => `- ${m}: ${n}`),
    '',
    '## Standing questions for the judgment layer (goldie-weekly.sh appends its answers below)',
    '1. How many BUCKETS should prompts be classified into, given this landscape? (current policy: 3-tier placeholder)',
    '2. What is the best model per bucket right now, per the public evals (Artificial Analysis, LMArena, SWE-bench)?',
    '3. Should any radar model be wired up (needs: route-cheap PRICING entry + catalog harness path + a measured quality check)?',
    '',
  ].join('\n');

  const briefPath = path.join(GOLDIE_DIR, `${TODAY}.md`);
  fs.writeFileSync(briefPath, brief);
  console.log(`[goldie] catalog refreshed (${changes.length} change(s)); brief: ${briefPath}`);
  if (changes.some((c) => c.note.startsWith('PRICE DRIFT') || c.note.startsWith('NOT FOUND'))) {
    console.log('[goldie] ATTENTION: drift or delisting detected — see brief');
    process.exitCode = 0; // informational; the wrapper reads the brief for the push
  }
}

main().catch((e) => { console.error(`goldie-research: ${e.message}`); process.exit(1); });
