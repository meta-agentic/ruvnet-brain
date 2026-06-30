#!/usr/bin/env node
// scripts/behavioral-l1-l4.mjs — the 4-level BEHAVIORAL test harness for the RuvNet brain.
//
// The existing eval scripts (prove.mjs, brain-capability-check.mjs, brain-grade-groundtruth.mjs)
// test RETRIEVAL: does the right source come back, is it confident, is the answer graded high. This
// harness tests the four BEHAVIORS a user actually depends on — including the one the brain is meant
// to DRIVE (orchestration), which no prior script covered:
//
//   L1 ROUTE        — "which repo solves X?" → the brain routes the top hit to the correct repo.
//   L2 DEEP-RECALL  — "how is X implemented?" → the brain returns CODE-level source (full bodies),
//                     not just doc-comments — proof it walked the repo to the implementation.
//   L3 IMPLEMENT    — "implement X using <repo>" → the #1 cited source actually contains the API you
//                     would build against, so an implementation grounded in it is correct (mechanical
//                     correctness proxy; full multi-vendor grading stays brain-grade-groundtruth.mjs).
//   L4 ORCHESTRATE  — the newbie path. Run the real UserPromptSubmit hook (ground-ruvnet.sh) on
//                     "go make magic / here's a spec, build it" prompts and assert it injects the FULL
//                     Ruv-way directive (ground → SPARC → DDD/ADR → parallel swarm → QA → score ≥98 →
//                     frontend-design → AI image-gen → ask-for-API-key → prove). This is the only
//                     enforcement primitive that exists (ADR-0005: UserPromptSubmit injection), so
//                     testing the injected text IS testing whether the brain takes the wheel.
//
// L1–L3 call searchAll() — the EXACT engine search_ruvnet wraps (forge-mcp-all.mjs:77). L4 shells the
// real hook. No mutation, read-only. Needs KB_MODEL_CACHE pointing at the ONNX model cache for L1–L3.
//
// Usage:
//   KB_MODEL_CACHE=<cache> node scripts/behavioral-l1-l4.mjs [--dir kb] [--repos a,b,c] [--levels L1,L4]
//   --repos  restrict the search pool (collision-safe while a build sweep is running)
//   --levels comma list of L1,L2,L3,L4 to run (default all)
// Exit 0 iff every selected check passes.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchAll } from '../kb/forge-ask-all.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const KB_DIR = path.resolve(arg('--dir', path.join(ROOT, 'kb')));
const HOOK = path.resolve(arg('--hook', path.join(ROOT, 'plugin/scripts/ground-ruvnet.sh')));
const reposArg = arg('--repos', '');
const REPOS = reposArg ? reposArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
const K = parseInt(arg('--k', '6'), 10);
const LEVELS = new Set((arg('--levels', 'L1,L2,L3,L4')).split(',').map((s) => s.trim().toUpperCase()));

const CODE_RX = /(\bfn\s|\bfunction\s|\bimpl\s|\bstruct\s|\bclass\s|\bexport\s|\basync\s|=>|\(full body\))/;
const G = (s) => `\x1b[32m${s}\x1b[0m`, R = (s) => `\x1b[31m${s}\x1b[0m`, DIM = (s) => `\x1b[2m${s}\x1b[0m`;

// ── L1 ROUTE: question → repo it should route to ──────────────────────────────────────────────
const L1 = [
  { q: 'single-file HNSW vector store with no server', expect: 'ruvector' },
  { q: 'orchestrate a swarm of agents across multiple steps', expect: 'ruflo' },
  { q: 'causal explainable agent memory — why did I recall that', expect: 'agentdb' },
  { q: 'fork a million vectors cheaply, branch agent memory copy-on-write', expect: 'agenticow' },
  { q: 'WiFi CSI sensing of vital signs on an edge device', expect: 'ruview' },
];
// ── L2 DEEP-RECALL: must return CODE (full bodies) from the right repo, not doc-comments ──────────
const L2 = [
  { q: 'how is the HNSW graph insert / neighbour selection implemented', expect: 'ruvector' },
  { q: 'how does the swarm decide how many agents to spawn in code', expect: 'ruflo' },
  { q: 'how is a copy-on-write branch created in code', expect: 'agenticow' },
];
// ── L3 IMPLEMENT: #1 cited source must contain the API you'd build against ────────────────────────
const L3 = [
  { q: 'implement a nearest-neighbour query against an .rvf store', expect: 'ruvector', apiRx: /query|search|knn|nearest/i },
  { q: 'store and recall an agent memory entry with AgentDB', expect: 'agentdb', apiRx: /store|recall|memory|insert|search/i },
];
// ── L4 ORCHESTRATE: run the real hook; assert the injected directive is complete ──────────────────
const L4 = [
  {
    name: 'newbie "go make magic"',
    prompt: 'go make magic and build me an app that helps people learn',
    // pure build prompt, no RuvNet keyword → Gate 3 (take-the-wheel) must fire with the full pipeline
    must: ['take the wheel', 'SPARC', 'DDD', 'ADR', 'swarm', 'QA gate', '98', 'frontend-design', 'image generation', 'API key', 'PROVEN', 'PARALLEL'],
  },
  {
    name: 'spec → build (RuvNet-named)',
    prompt: 'here is a product spec, build a knowledge base feature using ruvector',
    // names ruvector → Gate 1 (ground) AND Gate 3 (build) must both fire
    must: ['search_ruvnet', 'ground', 'SPARC', 'DDD', 'frontend-design', 'image generation', 'API key', '98'],
  },
  {
    name: 'classical-default drift',
    prompt: 'set up pinecone and langchain to do rag over my docs',
    // drift keywords → Gate 2 (hijack) must fire AND build keyword "set up" → Gate 3
    must: ['classical default', 'RuVector', 'Ruflo', 'AgentDB', 'take the wheel'],
  },
  {
    name: 'pure recall (no build)',
    prompt: 'what can ruflo actually do',
    must: ['search_ruvnet', 'ground'],
    mustNot: ['take the wheel'], // no build verb → Gate 3 must stay silent
  },
];

const results = { L1: [], L2: [], L3: [], L4: [] };

async function runL1() {
  for (const t of L1) {
    const { results: r } = await searchAll({ dir: KB_DIR, query: t.q, k: K, repos: REPOS });
    const top = r[0];
    // Routing is correct if the top hit is the expected repo OR a `concepts` capability-card that
    // NAMES it. The concepts store is the by-description router (the cards that took routing 33%→96%);
    // for a described need the legitimate #1 is often the card pointing at the repo, repo='concepts'.
    const viaCard = !!top && top.repo === 'concepts'
      && new RegExp(`\\b${t.expect}\\b`, 'i').test(`${top.path} ${top.title} ${(top.fullText || '').slice(0, 800)}`);
    const pass = !!top && (top.repo === t.expect || viaCard);
    results.L1.push({ pass, info: `${t.q.slice(0, 40)}… → ${top ? top.repo + '/' + (top.path || '').split('/').pop() : 'none'} (want ${t.expect}${viaCard ? ' via card' : ''}; ce ${top?.ceScore?.toFixed(2) ?? 'n/a'})` });
  }
}
async function runL2() {
  for (const t of L2) {
    const { results: r } = await searchAll({ dir: KB_DIR, query: t.q, k: K, repos: REPOS });
    const hit = r.find((x) => x.repo === t.expect && CODE_RX.test(x.fullText || x.text || ''));
    const pass = !!hit;
    const any = r.find((x) => x.repo === t.expect);
    results.L2.push({ pass, info: `${t.q.slice(0, 42)}… → ${pass ? `CODE @ ${hit.repo}/${hit.path}` : any ? `doc-only @ ${any.repo}/${any.path}` : `no ${t.expect} hit`}` });
  }
}
async function runL3() {
  for (const t of L3) {
    const { results: r } = await searchAll({ dir: KB_DIR, query: t.q, k: K, repos: REPOS });
    const top = r[0];
    const apiOk = top && t.apiRx.test(top.fullText || top.text || '');
    const pass = !!top && top.repo === t.expect && apiOk;
    results.L3.push({ pass, info: `${t.q.slice(0, 40)}… → #1 ${top ? `${top.repo}/${top.path}` : 'none'} apiMatch=${!!apiOk}` });
  }
}
function runL4() {
  for (const t of L4) {
    let out = '';
    try { out = execFileSync('sh', [HOOK], { input: JSON.stringify({ prompt: t.prompt }), encoding: 'utf8' }); } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
    const lc = out.toLowerCase();
    const missing = (t.must || []).filter((m) => !lc.includes(m.toLowerCase()));
    const leaked = (t.mustNot || []).filter((m) => lc.includes(m.toLowerCase()));
    const pass = missing.length === 0 && leaked.length === 0;
    results.L4.push({ pass, info: `${t.name}${missing.length ? ` — MISSING: ${missing.join(', ')}` : ''}${leaked.length ? ` — LEAKED: ${leaked.join(', ')}` : ''}` });
  }
}

(async () => {
  console.log(`\n=== RuvNet Brain — L1–L4 behavioral harness ===`);
  console.log(DIM(`kb=${KB_DIR}  pool=${REPOS ? REPOS.join(',') : 'ALL'}  hook=${path.relative(ROOT, HOOK)}\n`));
  if (LEVELS.has('L1')) await runL1();
  if (LEVELS.has('L2')) await runL2();
  if (LEVELS.has('L3')) await runL3();
  if (LEVELS.has('L4')) runL4();

  let allPass = true;
  const titles = { L1: 'ROUTE', L2: 'DEEP-RECALL', L3: 'IMPLEMENT', L4: 'ORCHESTRATE' };
  for (const lvl of ['L1', 'L2', 'L3', 'L4']) {
    if (!LEVELS.has(lvl) || !results[lvl].length) continue;
    const passN = results[lvl].filter((x) => x.pass).length;
    const ok = passN === results[lvl].length;
    allPass = allPass && ok;
    console.log(`${ok ? G('PASS') : R('FAIL')}  ${lvl} ${titles[lvl]}  (${passN}/${results[lvl].length})`);
    for (const x of results[lvl]) console.log(`   ${x.pass ? G('✓') : R('✗')} ${x.info}`);
    console.log();
  }
  console.log(`=== OVERALL: ${allPass ? G('PASS') : R('FAIL')} ===\n`);
  process.exit(allPass ? 0 : 1);
})();
