#!/usr/bin/env node
// self-retrieval-bench.mjs — rUv's self-supervised retrieval benchmark (the flywheel's real metric).
//
// Grounded in ruv-gists/f8e2851f/ruflo-3.24.0-flywheel.md: "a self-supervised retrieval benchmark
// (can retrieval find a document from its own content?)", scored by self-retrieval reciprocal-rank —
// rUv demonstrated 0.496 → 0.758 → 0.847. This is NOT the 50 hand-written questions (that's the small
// human-labeled anchor); THIS auto-generates queries from the corpus itself and scales to thousands of
// probes across all 68 stores with zero hand-authoring. Standard IR evaluation (Thakur BEIR self-
// retrieval), not a reinvention.
//
// Method (per store): sample N passages; for each, build a query from a MIDDLE span of its own text
// (not the start — that would be identity retrieval); run the reader; find the rank of the SOURCE
// document; reciprocal rank = 1/rank (0 if not in top-K). MRR = mean over samples. Run HYBRID on vs off
// to measure the lift. $0, no LLM, no network.
//
// Usage: node self-retrieval-bench.mjs --store ruv-meetings --samples 100 [--k 10] [--seed 42]
//        node self-retrieval-bench.mjs --all --samples 40
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { searchKb } from './forge-ask.mjs';
import { discoverRepos } from './forge-ask-all.mjs';

function arg(f, d) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; }
const DIR = arg('--dir', '.');
const SAMPLES = parseInt(arg('--samples', '80'), 10);
const K = parseInt(arg('--k', '10'), 10);
let seed = parseInt(arg('--seed', '42'), 10);
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; // deterministic

async function loadPassages(name) {
  const file = path.join(DIR, fs.existsSync(path.join(DIR, `${name}.big.passages.jsonl`)) ? `${name}.big.passages.jsonl` : `${name}.passages.jsonl`);
  const recs = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) { if (!line.trim()) continue; try { const o = JSON.parse(line); if ((o.text || '').split(/\s+/).length >= 30) recs.push({ path: o.path, text: o.text }); } catch { /* skip */ } }
  return recs;
}
// Query = a ~14-word span from the MIDDLE of the passage (a real fragment, not the passage's opening).
function fragmentQuery(text) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const start = Math.floor(words.length * 0.35);
  return words.slice(start, start + 14).join(' ');
}
async function benchStore(name) {
  const recs = await loadPassages(name);
  if (recs.length < 5) return null;
  const idxs = [...recs.keys()]; for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
  const sample = idxs.slice(0, Math.min(SAMPLES, recs.length)).map((i) => recs[i]);
  let rrSum = 0, hitAt1 = 0;
  for (const rec of sample) {
    const q = fragmentQuery(rec.text);
    let results = [];
    try { results = await searchKb({ dir: DIR, name, query: q, k: K, n: Math.max(24, K * 4) }); } catch { /* skip */ }
    const rank = results.findIndex((r) => r.path === rec.path) + 1; // 0 => not found
    if (rank === 1) hitAt1++;
    rrSum += rank > 0 ? 1 / rank : 0;
  }
  return { store: name, n: sample.length, mrr: rrSum / sample.length, hitAt1Rate: hitAt1 / sample.length };
}

const stores = process.argv.includes('--all') ? discoverRepos(DIR) : [arg('--store', 'ruv-meetings')];
const mode = process.env.KB_HYBRID === '1' ? 'HYBRID' : 'dense-only';
console.log(`self-retrieval benchmark — mode=${mode}, samples/store=${SAMPLES}, k=${K}`);
let mrrSum = 0, cnt = 0;
for (const s of stores) {
  const r = await benchStore(s);
  if (!r) { console.log(`  ${s}: (too few passages)`); continue; }
  console.log(`  ${s.padEnd(28)} MRR=${r.mrr.toFixed(3)}  hit@1=${(r.hitAt1Rate * 100).toFixed(0)}%  (n=${r.n})`);
  mrrSum += r.mrr; cnt++;
}
if (cnt > 1) console.log(`\nOVERALL MRR (${cnt} stores): ${(mrrSum / cnt).toFixed(3)}`);
