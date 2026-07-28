#!/usr/bin/env node
// rerank-cap-warm-ab.mjs — the paired, WARM before/after for the cross-encoder pool cap.
//
// Why this exists rather than timing the CLI: a cold `forge-ask-all.mjs` spends ~53s loading two
// ONNX models before it scores anything, and the cap cannot touch that. Timing cold runs would
// dilute the effect being measured by roughly 3x and would also compare runs taken hours apart on a
// machine whose load moved underneath them. This harness loads the models ONCE and then runs each
// question twice in the same process — uncapped and capped — so the only difference between the two
// numbers is the thing under test.
//
// PAIRED AND ORDER-ALTERNATED: question i runs uncapped-then-capped on even i and capped-then-
// uncapped on odd i, so any residual warm-up or thermal drift cannot systematically favour one arm.
// Both arms' ANSWERS are recorded, not just their times: a cap that is fast and wrong is a failure,
// and this is the file that would catch it.
//
//   node scripts/rerank-cap-warm-ab.mjs --cap 408 [--n 24] [--out result.json]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = process.env.RUVNET_BRAIN_KB || path.join(os.homedir(), '.cache', 'ruvnet-brain', 'kb');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const CAP = arg('--cap', '408');
const N = parseInt(arg('--n', '24'), 10);
const OUT = arg('--out', path.join(os.tmpdir(), `ce-cap-warm-ab-${CAP}.json`));

const { searchAll } = await import(pathToFileURL(path.join(ROOT, 'kb', 'forge-ask-all.mjs')).href);
const { gradeQuestion, aggregate } = await import(pathToFileURL(path.join(ROOT, 'scripts', 'eval-brain.mjs')).href);

// Stratified subset of the frozen held-out set, dealt round-robin so every stratum is represented
// even at small n — a prefix of a grouped file would be all 'described' and no 'adversarial'.
const { questions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'held-out.json'), 'utf8'));
const byStratum = new Map();
for (const q of questions) (byStratum.get(q.stratum) ?? byStratum.set(q.stratum, []).get(q.stratum)).push(q);
const lanes = [...byStratum.values()];
const dealt = [];
for (let i = 0; dealt.length < questions.length; i++) for (const lane of lanes) if (lane[i]) dealt.push(lane[i]);
const set = dealt.slice(0, N);

const idOf = (r) => (r ? `${r.repo}/${r.path}` : '(none)');
async function once(query, cap) {
  process.env.KB_CE_MAX_PAIRS = String(cap);
  const t0 = Date.now();
  const out = await searchAll({ dir: KB, query, k: 3 });
  return { ms: Date.now() - t0, pairs: out.pooled, pooledAll: out.pooledAll, results: out.results.map((r) => ({ id: idOf(r), repo: r.repo, ce: r.ceScore, gist: !!r.gist })) };
}

// Warm-up: the first query of a process pays both model loads. It is thrown away deliberately —
// including it would credit the cap with a saving it did not produce.
process.stderr.write('[warm-ab] loading models (first query is discarded)...\n');
const w0 = Date.now();
await once('what is ruvector', 0);
process.stderr.write(`[warm-ab] warm after ${((Date.now() - w0) / 1000).toFixed(1)}s\n`);

const rows = [];
for (let i = 0; i < set.length; i++) {
  const q = set[i];
  const capFirst = i % 2 === 1;
  const a = capFirst ? await once(q.query, CAP) : await once(q.query, 0);
  const b = capFirst ? await once(q.query, 0) : await once(q.query, CAP);
  const [off, on] = capFirst ? [b, a] : [a, b];
  rows.push({ id: q.id, stratum: q.stratum, expectRepo: q.expectRepo ?? null, capFirst, off, on });
  process.stderr.write(`[warm-ab] ${i + 1}/${set.length} ${q.id} off=${(off.ms / 1000).toFixed(1)}s/${off.pairs}p on=${(on.ms / 1000).toFixed(1)}s/${on.pairs}p top1${idOf2(off) === idOf2(on) ? '=same' : ' CHANGED'}\n`);
}
function idOf2(x) { return x.results[0]?.id ?? '(none)'; }

fs.writeFileSync(OUT, JSON.stringify({ cap: CAP, kb: KB, n: set.length, load: os.loadavg(), rows }, null, 2));

// ── the table ───────────────────────────────────────────────────────────────────────────────────
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const grade = (arm) => aggregate(rows.map((r) => {
  const top = r[arm].results[0] ?? null;
  return { stratum: r.stratum, ...gradeQuestion({ stratum: r.stratum, expectRepo: r.expectRepo },
    { grounded: r[arm].results.length > 0,
      citations: top ? [{ repo: top.repo, fullPath: top.id, ce: top.ce }] : [],
      bannerPresent: r[arm].results.some((x) => x.gist) }) };
}));
const top1Same = rows.filter((r) => idOf2(r.off) === idOf2(r.on)).length;
let kn = 0, kd = 0;
for (const r of rows) { const s = new Set(r.on.results.map((x) => x.id)); for (const x of r.off.results) { kd++; if (s.has(x.id)) kn++; } }
const gOff = grade('off'), gOn = grade('on');

console.log(`\n# warm A/B — cross-encoder pool cap KB_CE_MAX_PAIRS=${CAP}`);
console.log(`${rows.length} questions from the frozen held-out set, paired, order-alternated, one warm process. load1=${os.loadavg()[0].toFixed(1)} on ${os.cpus().length} cores.\n`);
console.log('| | pairs (median) | warm wall median | warm wall mean | routed | abstain | banner |');
console.log('|---|---|---|---|---|---|---|');
const fmt = (arm, g) => `| ${med(rows.map((r) => r[arm].pairs))} | ${(med(rows.map((r) => r[arm].ms)) / 1000).toFixed(2)}s | ${(rows.reduce((a, r) => a + r[arm].ms, 0) / rows.length / 1000).toFixed(2)}s | ${g.routed.k}/${g.routed.n} | ${g.abstain.k}/${g.abstain.n} | ${g.banner.k}/${g.banner.n} |`;
console.log(`| uncapped (before) ${fmt('off', gOff)}`);
console.log(`| capped B=${CAP} (after) ${fmt('on', gOn)}`);
const dMed = 1 - med(rows.map((r) => r.on.ms)) / med(rows.map((r) => r.off.ms));
console.log(`\nwall-time change (median, paired): ${dMed >= 0 ? '-' : '+'}${pct(Math.abs(dMed))}`);
console.log(`top-1 cited path identical : ${top1Same}/${rows.length} (${pct(top1Same / rows.length)})`);
console.log(`top-3 cited paths retained : ${kn}/${kd} (${pct(kn / kd)})`);
console.log('\n## every question whose top-1 changed');
const changed = rows.filter((r) => idOf2(r.off) !== idOf2(r.on));
if (!changed.length) console.log('  none');
for (const r of changed) console.log(`  ${r.id} [${r.stratum}] expect=${(r.expectRepo || ['-']).join('|')}\n     before: ${idOf2(r.off)}  (ce ${r.off.results[0]?.ce?.toFixed(3)})\n     after : ${idOf2(r.on)}  (ce ${r.on.results[0]?.ce?.toFixed(3)})`);
console.log(`\nraw: ${OUT}`);
