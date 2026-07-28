#!/usr/bin/env node
// rerank-cap-eval.mjs — does bounding the cross-encoder pool change the ANSWERS?
//
// The cross-encoder is 84.7% of a query's wall and reads 605 (query, passage) pairs for an
// all-repos question. Capping that pool is the only lever that moves the number. But a cap
// re-orders results, and a naive one was MEASURED to lose the right answer — so no cap ships
// without a before/after on a real question set.
//
// TWO PHASES, because the measurement is expensive and the policy search is not:
//
//   --collect   Runs the FROZEN held-out set (evals/held-out.json — the same corpus
//               scripts/eval-brain.mjs gates on) UNCAPPED, recording every scored candidate:
//               repo, path, lane, within-lane depth, pool position, and its cross-encoder score.
//               One ~8-minute query per question. This is the whole cost of the experiment.
//
//   --report    Replays capRerankPool + selectResults — the SHIPPING functions, imported, not
//               re-implemented — against those recorded scores, for every candidate budget. The
//               cross-encoder is deterministic per (query, passage) pair and pairs are scored
//               independently, so a replay of a subset is EXACT: it is the same arithmetic on the
//               same numbers, not a model of it.
//
// Reported metrics are the ones a wrong answer would move, graded by ground truth (never a model
// judge — an LLM panel once scored a zero-citation answer 98/100 on this repo):
//   pairs      — cross-encoder pairs actually scored. The load-independent primary evidence.
//   top1-same  — the winning document is byte-identical to the uncapped winner.
//   kept       — the uncapped top-k documents still present in the capped top-k.
//   routed     — top-1 lands in an expected repo (eval-brain's own metric, same Wilson bound).
//   abstain    — adversarial questions still decline (top ce < 0).
//   banner     — a winning gist chunk still carries its provenance banner.
//
//   node scripts/rerank-cap-eval.mjs --collect [--conc 3] [--only ho-01,ho-02]
//   node scripts/rerank-cap-eval.mjs --report [--budgets 605,272,136,69]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { gradeQuestion, aggregate } from './eval-brain.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = process.env.RUVNET_BRAIN_KB || path.join(os.homedir(), '.cache', 'ruvnet-brain', 'kb');
// The code under test is THIS checkout's, run against whatever corpus KB points at.
const CODE = path.join(ROOT, 'kb');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const TRACES = arg('--traces', path.join(os.tmpdir(), 'ruvnet-brain-ce-cap-traces'));

// The frozen 120, plus probes for the paths a cap could silently break. These are NOT scored
// against expectRepo (they are not part of the frozen set and must never contaminate it) — they
// are watched for one thing only: does the cap change the winner?
const PROBES = [
  { id: 'px-mcp-policy', query: 'which file enforces the MCP tool policy in ruvector', why: 'the case a naive cap was measured to lose (mcp-policy.js -> an ADR)' },
  { id: 'px-adr-085', query: 'ADR-085', why: 'bare ADR number — per-repo collision disclosure reads the whole pool' },
  { id: 'px-pkg-rvf', query: 'what is @ruvector/rvf', why: 'exact @scope/name — exercises the RESCUE lane the cap must never drop' },
  { id: 'px-meetings', query: 'how many commits and contributors does the project have', why: 'answer is BM25-only in a transcript store; dense buries it past rank 40' },
];

// Probes first, then the frozen set DEALT ROUND-ROBIN ACROSS STRATA. The held-out file is grouped
// by stratum, and at ~8 minutes a question a run can be interrupted — grouped order would make any
// prefix a biased sample (all 'described', no 'adversarial'), which is the kind of partial evidence
// that reads as a result and is not one. Round-robin makes every prefix stratified.
function loadQuestions() {
  const { questions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'evals', 'held-out.json'), 'utf8'));
  const byStratum = new Map();
  for (const q of questions) (byStratum.get(q.stratum) ?? byStratum.set(q.stratum, []).get(q.stratum)).push(q);
  const lanes = [...byStratum.values()];
  const dealt = [];
  for (let i = 0; dealt.length < questions.length; i++) for (const lane of lanes) if (lane[i]) dealt.push(lane[i]);
  return [...PROBES.map((p) => ({ ...p, stratum: 'probe' })), ...dealt];
}

// ── collect ─────────────────────────────────────────────────────────────────────────────────────
async function collect() {
  const only = arg('--only', '') ? new Set(arg('--only', '').split(',')) : null;
  const questions = loadQuestions().filter((q) => !only || only.has(q.id));
  const CONC = Math.max(1, parseInt(arg('--conc', '3'), 10) || 3);
  fs.mkdirSync(TRACES, { recursive: true });

  const run = (q) => new Promise((resolve) => {
    const trace = path.join(TRACES, `${q.id}.jsonl`);
    // A partial trace from a killed run must never be read as a complete one: write to .part and
    // rename only on a clean exit, so --report can never score a truncated pool as a real pool.
    const part = `${trace}.part`;
    try { fs.rmSync(part, { force: true }); } catch { /* fresh anyway */ }
    const t0 = Date.now();
    execFile('node', ['forge-ask-all.mjs', '--dir', KB, '--q', q.query, '--k', '3'], {
      cwd: CODE,
      timeout: 1800000,
      maxBuffer: 256 * 1024 * 1024,
      // --cap 0 (the default) is the uncapped baseline. A NON-zero --cap re-collects the same
      // questions with the cap actually engaged, which is the only way to check the replay against
      // reality: capping changes which pairs share a batch, and batch composition was MEASURED to
      // move scores by up to 0.26 logits, so a replayed cap is an approximation of a real one.
      // --cascade K does the same for ADR-058's two-stage cascade. Both are collected FOR REAL for
      // exactly that reason: the cascade re-batches its survivors too, so its scores are its own.
      env: {
        ...process.env,
        KB_CE_TRACE: part,
        KB_CE_MAX_PAIRS: arg('--cap', '0'),
        KB_CE_CASCADE_K: arg('--cascade', '0'),
        KB_CE_CASCADE_TOKENS: arg('--tokens', '192'),
      },
    }, (err) => {
      const ms = Date.now() - t0;
      if (!err && fs.existsSync(part) && fs.statSync(part).size > 0) {
        const rec = JSON.parse(fs.readFileSync(part, 'utf8').trim().split('\n')[0]);
        fs.writeFileSync(trace, JSON.stringify({ id: q.id, stratum: q.stratum, expectRepo: q.expectRepo ?? null, ms, ...rec }) + '\n');
        fs.rmSync(part, { force: true });
        resolve({ id: q.id, ok: true, ms, pooled: rec.pooledAll });
      } else {
        try { fs.rmSync(part, { force: true }); } catch { /* nothing to clean */ }
        resolve({ id: q.id, ok: false, ms, err: String(err?.message || 'no trace written').slice(0, 120) });
      }
    });
  });

  let cursor = 0, done = 0;
  const t0 = Date.now();
  const worker = async () => {
    while (cursor < questions.length) {
      const q = questions[cursor++];
      if (fs.existsSync(path.join(TRACES, `${q.id}.jsonl`))) { done++; continue; } // resumable: an 8h run must survive a restart
      const r = await run(q);
      done++;
      const la = os.loadavg()[0].toFixed(0);
      process.stderr.write(`[cap-eval] ${done}/${questions.length} ${r.ok ? 'ok' : 'FAIL'} ${r.id} ${(r.ms / 1000).toFixed(0)}s pooled=${r.pooled ?? '-'} load=${la} elapsed=${((Date.now() - t0) / 60000).toFixed(0)}m${r.ok ? '' : ` :: ${r.err}`}\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, questions.length) }, worker));
  console.error(`[cap-eval] traces in ${TRACES}`);
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────
async function report() {
  const { capRerankPool, selectResults } = await import(pathToFileURL(path.join(CODE, 'forge-ask-all.mjs')).href);
  if (!fs.existsSync(TRACES)) { console.error(`no traces at ${TRACES} — run --collect first`); process.exit(2); }
  const files = fs.readdirSync(TRACES).filter((f) => f.endsWith('.jsonl'));
  if (!files.length) { console.error(`no traces at ${TRACES} — run --collect first`); process.exit(2); }
  const traces = files.map((f) => JSON.parse(fs.readFileSync(path.join(TRACES, f), 'utf8').trim().split('\n')[0]));

  const budgets = (arg('--budgets', '') ? arg('--budgets', '').split(',').map(Number)
    : [0, 408, 272, 204, 170, 136, 102, 69, 48, 24]).sort((a, b) => b - a);

  // Rebuild each trace's pool in its ORIGINAL fan-out order — the cap's tie-break depends on it.
  const pools = traces.map((t) => ({
    ...t,
    pool: [...t.cands].sort((a, b) => a.poolIdx - b.poolIdx)
      .map((c) => ({ ...c, ceScore: c.ce, fullText: '', text: '', _lane: c.lane, _srcRank: c.rank, _poolIdx: c.poolIdx })),
  }));

  // The exact-package boost reads a candidate's BODY, which a trace deliberately does not carry
  // (605 whole documents x 120 questions). It fires only on an `@scope/name` query, and it fires
  // identically on any candidate that survives the cap, so it cannot flip a comparison between two
  // survivors — but say so out loud rather than let a reader assume the replay is total.
  const bodyDependent = pools.filter((p) => /@[a-z0-9][a-z0-9._-]*\/[a-z0-9._-]+/i.test(p.query)).map((p) => p.id);

  const idOf = (r) => `${r.repo}/${r.path}`;

  // CASCADE — the alternative policy, kept because it was measured and lost. Score every store's
  // best passage first (~1 pair per store), then spend the rest of the budget only on the R stores
  // whose best passage scored highest. It is the obvious "let the cross-encoder decide where to
  // dig" design; the table below is the reason it is not what ships.
  const cascadeKeep = (pool, R) => {
    const best = new Map();
    for (const c of pool) if (c._srcRank === 0 && (!best.has(c.repo) || c.ceScore > best.get(c.repo))) best.set(c.repo, c.ceScore);
    const top = new Set([...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, R).map(([r]) => r));
    return pool.filter((c) => c._srcRank === 0 || c._lane === 'rescue' || top.has(c.repo));
  };

  const runKept = (p, kept) => {
    const ranked = [...kept].sort((a, b) => (b.ceScore ?? -Infinity) - (a.ceScore ?? -Infinity));
    const { results } = selectResults({ query: p.query, ranked, k: p.k });
    return { pairs: kept.length, results };
  };
  const runPolicy = (p, limit) => runKept(p, capRerankPool(p.pool, { limit }).kept);

  const base = new Map(pools.map((p) => [p.id, runPolicy(p, 0)]));

  // ── ROOT CAUSE ────────────────────────────────────────────────────────────────────────────────
  // How deep in its OWN store's vector ranking does the winning document sit? This one histogram
  // decides whether any pre-score cap can be safe. If winners clustered at depth 0, a tiny budget
  // would be free. They do not: the cross-encoder routinely promotes a passage its own store
  // ranked 4th or 7th, which means depth carries little information about who wins, which means
  // every pair a depth cut removes is a real chance of removing the answer.
  const depthTop1 = {}, depthTopK = {};
  for (const p of pools) {
    const r = base.get(p.id).results;
    if (!r.length) continue;
    depthTop1[r[0]._srcRank] = (depthTop1[r[0]._srcRank] || 0) + 1;
    for (const x of r) depthTopK[x._srcRank] = (depthTopK[x._srcRank] || 0) + 1;
  }
  const hist = (h) => Object.keys(h).map(Number).sort((a, b) => a - b).map((d) => `depth ${d}: ${h[d]}`).join(' | ');

  console.log(`\n# cross-encoder pool cap — quality vs pair count`);
  console.log(`corpus: ${pools.length} questions (${pools.filter((p) => p.stratum !== 'probe').length} frozen held-out + ${pools.filter((p) => p.stratum === 'probe').length} probes)`);
  console.log(`uncapped pool: min ${Math.min(...pools.map((p) => p.pooledAll))}, median ${median(pools.map((p) => p.pooledAll))}, max ${Math.max(...pools.map((p) => p.pooledAll))} pairs`);
  console.log(`body-dependent boost not replayed for: ${bodyDependent.length ? bodyDependent.join(', ') : '(none — no @scope/name query in the set)'}`);
  console.log(`\n## where the answer actually lives, in its own store's vector ranking`);
  console.log(`  winning document : ${hist(depthTop1)}`);
  console.log(`  every top-k hit  : ${hist(depthTopK)}`);
  console.log(`  (a budget of B pairs across S stores reaches depth B/S. Winners spread across depth`);
  console.log(`   means a depth cut drops answers roughly in proportion to what it saves.)\n`);
  console.log('| policy | pairs (median) | top1-same | top-k kept | routed k/n (Wilson lo) | abstain | banner |');
  console.log('|---|---|---|---|---|---|---|');

  // Every policy the run compares: the shipping depth cap at a range of budgets, plus cascade.
  const policies = [
    ...budgets.map((limit) => ({ label: limit === 0 ? 'uncapped' : `depth B=${limit}`, key: `depth-${limit}`, keep: (p) => capRerankPool(p.pool, { limit }).kept })),
    ...[4, 8, 12, 16, 24, 32].map((R) => ({ label: `cascade R=${R}`, key: `cascade-${R}`, keep: (p) => cascadeKeep(p.pool, R) })),
  ];

  const detail = {};
  for (const policy of policies) {
    const rows = [];
    let top1Same = 0, keptNum = 0, keptDen = 0;
    const changed = [];
    for (const p of pools) {
      const cur = runKept(p, policy.keep(p));
      const b = base.get(p.id);
      const same = idOf2(cur.results[0]) === idOf2(b.results[0]);
      if (same) top1Same++; else changed.push(`${p.id}: ${idOf2(b.results[0])} -> ${idOf2(cur.results[0])}`);
      const curSet = new Set(cur.results.map(idOf));
      for (const r of b.results) { keptDen++; if (curSet.has(idOf(r))) keptNum++; }
      if (p.stratum !== 'probe') {
        const top = cur.results[0] ?? null;
        // Same grading rule as scripts/eval-brain.mjs, fed from the replayed result set. `grounded`
        // is structurally true here: every candidate is a passage the retriever actually returned.
        rows.push({
          id: p.id, stratum: p.stratum,
          ...gradeQuestion({ stratum: p.stratum, expectRepo: p.expectRepo },
            { grounded: cur.results.length > 0,
              citations: top ? [{ repo: top.repo, fullPath: idOf(top), ce: top.ceScore }] : [],
              bannerPresent: cur.results.some((r) => r.gist) }),
        });
      }
      detail[policy.key] ??= {};
      detail[policy.key][p.id] = { pairs: cur.pairs, top1: idOf2(cur.results[0]) };
    }
    const agg = aggregate(rows);
    const pairs = median(pools.map((p) => policy.keep(p).length));
    console.log(`| ${policy.label} | ${pairs} | ${top1Same}/${pools.length} (${pct(top1Same / pools.length)}) | ${keptNum}/${keptDen} (${pct(keptNum / keptDen)}) | ${agg.routed.k}/${agg.routed.n} (${pct(agg.routed.lo)}) | ${agg.abstain.k}/${agg.abstain.n} | ${agg.banner.k}/${agg.banner.n} |`);
    if (changed.length && changed.length <= 12) detail[`changed@${policy.key}`] = changed;
  }

  console.log('\n## winners that changed, per policy (empty = the policy changed no answer)');
  for (const policy of policies) {
    if (policy.key === 'depth-0') continue;
    const c = detail[`changed@${policy.key}`];
    console.log(`\n### ${policy.label}`);
    if (!c) console.log('  (too many to list — see the top1-same column)');
    else if (!c.length) console.log('  none');
    else for (const line of c) console.log(`  ${line}`);
  }

  if (argv.includes('--json')) fs.writeFileSync(path.join(TRACES, 'report.json'), JSON.stringify(detail, null, 2));
}

const idOf2 = (r) => (r ? `${r.repo}/${r.path}` : '(no result)');
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };

if (argv.includes('--collect')) await collect();
else if (argv.includes('--report')) await report();
else { console.error('usage: rerank-cap-eval.mjs --collect | --report'); process.exit(2); }
