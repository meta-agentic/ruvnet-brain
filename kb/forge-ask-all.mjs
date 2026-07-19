#!/usr/bin/env node
// forge-ask-all.mjs — ONE question → the best source-grounded answer across the ENTIRE RuvNet brain.
//
// The per-repo forge-ask.mjs answers about one repo. This wrapper makes the bundle behave like a
// single brain: it retrieves a candidate pool from EVERY repo (reusing the proven searchKb engine,
// which auto-selects each repo's sharp `big` variant when present), pools the candidates, then
// re-scores the whole pool with ONE cross-encoder pass (rerankPairs) so hits from different repos —
// and different embedders/dimensions — are ranked on a single common scale. Returns the globally
// best whole-document passages, each labeled with the repo it came from (so a consumer always knows
// WHICH part of RuvNet the answer is grounded in, and can cite repo + path).
//
//   node forge-ask-all.mjs --dir <bundle-dir> --q "how does RVF store vectors?" [--k 6] [--pool 8]
//   node forge-ask-all.mjs --dir . --repos ruflo,ruvector --q "..."        # restrict to some repos
//   import { searchAll } from './forge-ask-all.mjs'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchKb } from './forge-ask.mjs';
import { rerankPairs } from './forge-rerank.mjs';
import { tokenize, buildCorpusStats, bm25Score } from './forge-hybrid.mjs';

// TRANSCRIPT/dialogue stores need LEXICAL (BM25) candidate generation, not dense alone. A fact spoken
// in passing ("…876 commits…") embeds poorly against a conceptual question, so dense buries it past
// rank 40 — but it shares literal words with the question ("commits", "contributors") that BM25 catches
// (measured: 876→BM25 #4, meta-wrapper→#1, DDoS→#5, all dense-absent past 40). We add each transcript
// store's BM25-top-N passages to the pool so the ONE global cross-encoder can promote the true answer.
// Grounded in cognitum-learn's dense+BM25+reranker design (cognitum-learn DDD-001). Repo stores are
// untouched: dense already works there, and this only fires for stores in KB_TRANSCRIPT_STORES.
// NOTE: this is only effective once the transcript store's passages carry UNIQUE paths (else doc-collapse
// in forge-ask.mjs crushes them back into a few windows — the ruv-meetings 317→4 collapse bug).
const TRANSCRIPT_STORES = new Set(
  (process.env.KB_TRANSCRIPT_STORES || 'ruv-meetings').split(',').map((s) => s.trim()).filter(Boolean),
);
const isTranscriptStore = (name) => TRANSCRIPT_STORES.has(String(name).replace(/\.big$/, ''));
const _mbm = new Map(); // dir|name -> { passages, toks, stats } (built once per process)
function meetingBm25Candidates(dir, name, query, topN = 40) {
  const key = `${dir}|${name}`;
  let e = _mbm.get(key);
  if (!e) {
    const big = path.join(dir, `${name}.big.passages.jsonl`);
    const small = path.join(dir, `${name}.passages.jsonl`);
    const pf = fs.existsSync(big) ? big : small;
    const passages = fs.readFileSync(pf, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const toks = passages.map((p) => tokenize(p.text || ''));
    e = { passages, toks, stats: buildCorpusStats(toks) };
    _mbm.set(key, e);
  }
  const qt = tokenize(query);
  return e.passages
    .map((p, i) => ({ p, s: bm25Score(qt, e.toks[i], e.stats) }))
    .sort((a, b) => b.s - a.s).slice(0, topN).filter((x) => x.s > 0)
    .map(({ p }) => ({ path: p.path, title: p.title, fullText: p.text, text: p.text, bestDistance: 1.0, distance: 1.0 }));
}

// Discover the repos present in a bundle dir: every <repo>.rvf (the `.big.rvf` is the same repo's
// sharp variant, not a separate repo; idmap/embed/passages sidecars are not stores). Returns the
// unique base names, so searchKb can then pick big-vs-small per repo on its own.
export function discoverRepos(dir) {
  const names = new Set();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+?)(\.big)?\.rvf$/);
    if (!m) continue;                                  // not an rvf store
    if (/\.(idmap|embed)\b/.test(f)) continue;         // sidecar, not a store
    names.add(m[1]);
  }
  return [...names].sort();
}

// Query every repo, pool, rerank on a common scale, return global top-k labeled by repo.
export async function searchAll({ dir, query, k = 6, pool = 8, repos }) {
  const list = (repos && repos.length) ? repos : discoverRepos(dir);
  const perRepo = {};
  // Fan out across repos concurrently — but BOUNDED (issue #30, found+fixed by Jan Lafko). The
  // unbounded Promise.all here was a real OOM bomb: each repo's searchKb() spins up its own store
  // handles, and an unscoped query fanned ~53+ repos at once — measured 513MB peak for ONE repo,
  // extrapolating past his container's 17GB (dmesg: oom-kill, anon-rss 17.2GB, MCP server dead).
  // His bounded batch (default 5, KB_CONCURRENCY to tune) cut peak RSS to ~2.4GB with identical
  // results. Implemented as a SLIDING WINDOW rather than chunk barriers — at most KB_CONCURRENCY
  // repos in flight, and a finishing repo immediately admits the next, so big-memory machines keep
  // most of the parallel wall-clock win while small containers keep the same hard memory bound.
  // Each repo's error stays isolated to its own perRepo entry.
  const CONCURRENCY = Math.max(1, parseInt(process.env.KB_CONCURRENCY || '5', 10) || 5);
  const searchOne = async (name) => {
    try {
      // The concepts store holds ALL repos' prose primers in one place, so it needs a deeper pool than a
      // single source repo — otherwise the queried repo's own primer is crowded out by the other 18 before
      // the cross-encoder ever scores it (the dilution that buried ruflo's primer and lost safla).
      // Transcript stores get a deeper dense pool (24) AND BM25 candidates; concepts gets 24; others 8.
      const repoPool = (name === 'concepts' || isTranscriptStore(name)) ? Math.max(pool, 24) : pool;
      const hits = await searchKb({ dir, name, query, k: repoPool, n: repoPool });
      let cands = hits;
      if (isTranscriptStore(name)) {
        const seen = new Set(hits.map((h) => h.path));
        const bm = meetingBm25Candidates(dir, name, query, 40).filter((c) => !seen.has(c.path));
        cands = hits.concat(bm); // the global cross-encoder (rerankPairs below) then promotes the real answer
      }
      perRepo[name] = cands.length;
      return cands.map((h) => ({ ...h, repo: name }));
    } catch (e) {
      perRepo[name] = `ERR: ${e.message}`;
      return [];
    }
  };
  const perRepoHits = new Array(list.length);
  let nextIdx = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    for (let i = nextIdx++; i < list.length; i = nextIdx++) {
      perRepoHits[i] = await searchOne(list[i]);
    }
  }));
  const candidates = perRepoHits.flat();
  // ONE cross-encoder pass over the whole cross-repo pool → a single comparable relevance scale.
  const ranked = await rerankPairs(query, candidates);
  // Repo-name affinity: when the question explicitly NAMES a repo ("Does QuDAG…", "what can SAFLA do",
  // "can ruflo orchestrate…"), that repo should win ties/near-ties over a sibling that merely mentions it.
  // Capability questions almost always name their repo; without this the larger/prose-richer sibling wins
  // the tie (daa over qudag, dspy.ts over safla, agentic-flow over ruflo). A modest additive boost only
  // re-orders near-ties — it never lifts an unrelated repo, since non-named repos are untouched.
  // Word-boundary match on the repo name (not substring) so `fact` doesn't fire on "facts", while
  // multi-word names like `agent-harness-generator` still match. Boost clears a sibling that merely
  // *contains a file named after* the repo (e.g. dspy.ts/…/safla.ts) when the question names the repo.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A repo can be known by a different name than its kb-store name (e.g. GitHub renamed
  // ruvnet/agent-harness-generator -> ruvnet/metaharness; the kb store stays named
  // agent-harness-generator to avoid re-keying FULL_HINTS + served-cache filenames, but a
  // query naming "metaharness" should still get the boost). Extend here as repos rename.
  const ALIASES = { 'agent-harness-generator': ['metaharness'] };
  // Length floor 3, not 4: the floor exists to keep trivial tokens from matching, but two REAL
  // stores have 3-char names (rvm, daa) and the old >=4 floor silently exempted them from the
  // affinity boost — "Can RVM partition hardware…" lost to ruvector's vendored crates/rvm/ copy
  // because rvm's own userguide never got the boost its name earned. Word-boundary matching
  // already prevents substring hits, so 3-char store names are safe to honor.
  const isNamed = (repo) => {
    const names = [repo, ...(ALIASES[repo] || [])];
    return names.some((n) => n.length >= 3 && new RegExp(`\\b${esc(n)}\\b`, 'i').test(query));
  };
  const NAME_BOOST = 2.0;
  for (const r of ranked) {
    // A concepts hit is labelled repo="concepts" but its path is "<repo>/<kind>/<slug>" — attribute the
    // boost to the UNDERLYING repo so a named repo's PRIMER (which lives in the concepts store) counts too.
    const eff = (r.repo === 'concepts' && r.path) ? (r.path.split('/')[0] || r.repo) : r.repo;
    if (r.ceScore != null && isNamed(eff)) { r.ceScore += NAME_BOOST; r.nameBoosted = true; }
  }
  ranked.sort((a, b) => (b.ceScore ?? -Infinity) - (a.ceScore ?? -Infinity));
  return { repos: list, perRepo, results: ranked.slice(0, k), pooled: candidates.length };
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  return {
    dir: get('--dir') || '.',
    query: get('--q') || get('--query'),
    k: parseInt(get('--k') || '6', 10),
    pool: parseInt(get('--pool') || '8', 10),
    repos: (get('--repos') || '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

async function main() {
  const { dir, query, k, pool, repos } = parseArgs();
  if (!query) { console.error('Usage: node forge-ask-all.mjs --dir <bundle-dir> --q "question" [--k 6] [--pool 8] [--repos a,b]'); process.exit(2); }
  const { repos: used, perRepo, results, pooled } = await searchAll({ dir, query, k, pool, repos });
  // ── GONG LAYER (CLI): all repos erroring is an OUTAGE, not a quiet zero. Banner + exit 1 + alarm.
  // The non-zero exit is load-bearing: scripts/nightly-wrapper.sh's canary and any cron/CI caller
  // rely on it — a total failure that exits 0 is exactly the silent death this exists to kill.
  const failed = Object.entries(perRepo).filter(([, v]) => typeof v === 'string' && v.startsWith('ERR:'));
  if (used.length > 0 && failed.length === used.length) {
    console.error('\n🚨🚨🚨  RUVNET BRAIN IS DOWN — ALL ' + used.length + ' repos failed to search.  🚨🚨🚨');
    console.error('This is NOT an empty result; retrieval itself is broken.');
    console.error('First error: ' + failed[0][1]);
    console.error('Fix:    cd ~/.cache/ruvnet-brain/kb && npm i');
    console.error('Verify: npx github:stuinfla/ruvnet-brain --doctor\n');
    try {
      const alarm = await import(new URL('./brain-alarm.mjs', import.meta.url).href);
      await alarm.reportBrainDown({ error: failed[0][1], source: 'cli:forge-ask-all' });
    } catch { /* alarm module absent — the banner + exit code above still gong */ }
    process.exit(1);
  }
  if (failed.length > 0) {
    console.error(`⚠ DEGRADED: ${failed.length}/${used.length} repos failed (${failed.map(([n]) => n).join(', ')}) — results cover only the healthy repos.`);
  } else {
    // All repos healthy: clear any standing DOWN state (transition-only write inside).
    import(new URL('./brain-alarm.mjs', import.meta.url).href)
      .then((m) => m.reportBrainUp({ source: 'cli:forge-ask-all' }))
      .catch(() => {});
  }
  console.log(`\n=== RuvNet Brain (cross-repo) — "${query}" ===`);
  console.log(`repos searched: ${used.join(', ')}  |  per-repo hits: ${JSON.stringify(perRepo)}  |  pooled candidates: ${pooled}\n`);
  results.forEach((r, i) => {
    console.log(`#${i + 1}  repo=${r.repo}  ce=${r.ceScore == null ? 'n/a' : r.ceScore.toFixed(3)}  vec=${r.bestDistance?.toFixed(4)}${r.kind ? `  kind=${r.kind}` : ''}${r.statusLabel ? `  [${r.statusLabel}]` : ''}`);
    console.log(`path : ${r.repo}/${r.path}`);
    console.log(`title: ${r.title}`);
    if (r.designIntentWarning) console.log(r.designIntentWarning);
    console.log(`chars: ${(r.fullText || '').length} | chunks: ${r.chunksJoined}${r.truncated ? ' (truncated)' : ''}`);
    console.log('----- full document -----');
    console.log(r.fullText || r.text || '');
    console.log('===================================================================\n');
  });
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
