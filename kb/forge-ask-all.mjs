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
  // CORPUS AGE (issue #31, Jan Lafko): the brain is a periodic snapshot, and a model quoting a
  // version from it had NO signal that the fact might trail live reality. Derive the queried
  // stores' ages from the store files' own mtimes (always present, no extra plumbing) so every
  // response can carry an honest staleness caveat instead of implying liveness.
  const corpusAge = (() => {
    let oldest = null, newest = null;
    for (const name of list) {
      for (const cand of [`${name}.big.rvf`, `${name}.rvf`]) {
        const p = path.join(dir, cand);
        if (!fs.existsSync(p)) continue;
        const t = fs.statSync(p).mtimeMs;
        if (oldest === null || t < oldest.t) oldest = { t, name };
        if (newest === null || t > newest.t) newest = { t, name };
        break;
      }
    }
    if (!oldest) return null;
    const days = (t) => (Date.now() - t) / 86400000;
    return { oldestDays: +days(oldest.t).toFixed(1), oldestRepo: oldest.name, newestDays: +days(newest.t).toFixed(1) };
  })();
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

  // EXACT-NAME RESCUE (issue #33 Part A, Jan Lafko / @lafinak).
  // The scoped names the query explicitly contains. Hoisted ABOVE the per-repo pool cutoff because
  // of the bug Jan found: #31's exact-name boost runs after reranking, but each repo only contributes
  // its top-`pool` passages by RAW relevance, so `@ruvector/rvf`'s own manifest was discarded before
  // the boost could ever see it — in a large repo the exact artifact simply never reached the pool.
  // A boost cannot rescue what was never a candidate. (#31's own verification missed this because it
  // used a target that was already pool-competitive, so it never exercised the exclusion path.)
  const queriedNames = new Set(
    [...String(query).matchAll(/@[a-z0-9][a-z0-9._-]*\/[a-z0-9._-]+/gi)].map((m) => m[0].toLowerCase()),
  );
  // Searching deeper costs real time, so it happens ONLY when the query names an artifact exactly —
  // the deeper hits are then discarded except for exact title matches, which are force-kept. Ordinary
  // prose questions retrieve exactly as before.
  const RESCUE_DEPTH = Math.max(64, pool);

  const searchOne = async (name) => {
    try {
      // The concepts store holds ALL repos' prose primers in one place, so it needs a deeper pool than a
      // single source repo — otherwise the queried repo's own primer is crowded out by the other 18 before
      // the cross-encoder ever scores it (the dilution that buried ruflo's primer and lost safla).
      // Transcript stores get a deeper dense pool (24) AND BM25 candidates; concepts gets 24; others 8.
      const repoPool = (name === 'concepts' || isTranscriptStore(name)) ? Math.max(pool, 24) : pool;
      // Deepen ONLY for exact-name queries (#33 Part A), and only in repos that could PLAUSIBLY hold
      // the named artifact. The first version deepened every one of ~69 repos to depth 64 whenever a
      // query contained any @scope/name token — an 8x HNSW cost across the entire corpus to rescue an
      // artifact that, by definition, lives in one or two of them. Scope it by name overlap: a query
      // for @ruvector/rvf deepens ruvector-ish stores, not agentic-robotics.
      // The trade is deliberate and bounded: a package whose manifest sits in an unrelated repo is
      // still found by the normal pool + boost, it just doesn't get the deep rescue. Paying 8x on 67
      // irrelevant repos to cover that case is the wrong bargain.
      const plausibleForName = queriedNames.size > 0 && [...queriedNames].some((n) => {
        const [scope, pkg] = n.replace(/^@/, '').split('/');
        const lower = name.toLowerCase();
        return (scope && (lower.includes(scope) || scope.includes(lower)))
            || (pkg && (lower.includes(pkg) || pkg.includes(lower)));
      });
      const depth = plausibleForName ? Math.max(repoPool, RESCUE_DEPTH) : repoPool;
      const hits = await searchKb({ dir, name, query, k: depth, n: depth });
      let cands = hits;
      if (queriedNames.size && hits.length > repoPool) {
        const top = hits.slice(0, repoPool);
        const keptPaths = new Set(top.map((h) => h.path));
        // Force-keep any deeper hit whose TITLE is exactly a name the query asked for. This is the
        // whole fix: the artifact now REACHES the pool, so #31's boost can act on it.
        const rescued = hits
          .slice(repoPool)
          .filter((h) => h.title && queriedNames.has(String(h.title).toLowerCase()) && !keptPaths.has(h.path));
        cands = rescued.length ? top.concat(rescued) : top;
      }
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
  // EXACT PACKAGE-NAME boost (issue #31, found by Jan Lafko): a query naming a package EXACTLY
  // ("@ruvector/rvf") must rank that package's own manifest above near-name siblings — measured
  // live: rvf-node's package.json beat rvf's by ce 7.13 vs 6.67 on rvf's own exact name. The repo
  // affinity above can't see this (both hits are the same repo). Scoped @-package tokens only —
  // precise, zero prose false-positives — and the match is the manifest's own `"name": "<token>"`
  // field (the self-identifying artifact), never a substring of the path.
  const pkgTokens = [...new Set(query.match(/@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*/gi) || [])];
  if (pkgTokens.length) {
    for (const r of ranked) {
      if (r.ceScore == null) continue;
      const body = r.fullText || r.text || '';
      if (pkgTokens.some((p) => body.includes(`"name": "${p}"`) || body.includes(`"name":"${p}"`))) {
        r.ceScore += NAME_BOOST; r.exactPkgBoosted = true;
      }
    }
  }
  // EXACT-ARTIFACT-NAME boost (issue #31, found by @lafinak): an exact package/module-name query must
  // rank the EXACT-named artifact first, not a prefix-sibling — `@ruvector/rvf` was losing to
  // `@ruvector/rvf-node` for a query that named `@ruvector/rvf` exactly. Extract the scoped names the
  // query explicitly contains; a candidate whose TITLE equals one exactly gets a boost strong enough to
  // clear a sibling that merely shares the prefix. Narrow by construction (needs an `@scope/name` in the
  // query AND an exact title match), so repo/prose questions are untouched.
  // (`queriedNames` is computed once, above the pool cutoff — see the EXACT-NAME RESCUE note there.)
  if (queriedNames.size) {
    const EXACT_NAME_BOOST = 3.0; // > NAME_BOOST (2.0) so the exact artifact clears a prefix-sibling
    for (const r of ranked) {
      if (r.ceScore != null && r.title && queriedNames.has(String(r.title).toLowerCase())) {
        r.ceScore += EXACT_NAME_BOOST; r.exactNameBoosted = true;
      }
    }
  }
  ranked.sort((a, b) => (b.ceScore ?? -Infinity) - (a.ceScore ?? -Infinity));

  // ── BARE ADR-NUMBER QUERIES ARE AMBIGUOUS (issue #33 Part B, Jan Lafko / @lafinak) ────────────
  // ADR numbering is PER-REPO, not global: "ADR-085" names a completely different decision
  // depending which repo you mean. Confirmed against the corpus — ADR-085 is "Temporal Tensor
  // Pattern Compression" in one repo and "Public Benchmark Harness" in another; ADR-086 collides
  // three ways. A bare-number query returned exactly ONE repo's answer with no hint the others
  // existed, so a reader with a specific repo in mind could not tell they had been handed a
  // different repo's decision unless they already knew the content well enough to notice. That is
  // the failure this project cares most about: a confident answer to a question nobody asked.
  //
  // The fix is DISCLOSURE, not guessing. We deliberately do not infer which repo was meant — a bare
  // "chapter 5" with no book named is genuinely ambiguous input, and picking one silently is the
  // bug. Instead every colliding repo is guaranteed a slot, and the collision is reported so the
  // caller can say "there are three of these — which repo did you mean?"
  const adrMatch = String(query).match(/\bADR[-\s]?(\d{1,4})\b/i);
  let adrCollision = null;
  let results = ranked.slice(0, k);
  if (adrMatch) {
    const num = adrMatch[1].replace(/^0+/, '') || '0';   // ADR-085 and ADR-85 are the same number
    const sameNumber = (r) => {
      const m = `${r.title || ''} ${r.path || ''}`.match(/\bADR[-\s]?(\d{1,4})\b/i);
      return m ? (m[1].replace(/^0+/, '') || '0') === num : false;
    };
    // Best-scoring representative per repo — the collision set.
    const byRepo = new Map();
    for (const r of ranked) {
      if (sameNumber(r) && !byRepo.has(r.repo)) byRepo.set(r.repo, r);
    }
    if (byRepo.size > 1) {
      const repos = [...byRepo.keys()];
      // Echo the number the way THEY wrote it (ADR-085, not ADR-85). Zero-stripping is only for
      // matching; showing a user a different number than they typed makes them doubt the answer.
      const asTyped = adrMatch[1];
      adrCollision = {
        number: num,
        asTyped,
        repos,
        note: `ADR-${asTyped} exists in ${repos.length} repos (${repos.join(', ')}). ADR numbers are ` +
              `per-repo, so these are DIFFERENT decisions — name the repo to disambiguate.`,
      };
      // ONLY REORDER FOR AN ACTUAL ADR LOOKUP — and NEVER return more than k.
      //
      // The first version forced one hit per colliding repo to the front and sliced to
      // max(k, forced.length). Adversarial review proved both halves wrong against the live corpus:
      //   • ADR-1 collides across 23 repos, so `--k 6` returned TWENTY-TWO results. forge-mcp-all
      //     renders each result's FULL document, so search_ruvnet silently shipped several times the
      //     token volume its own schema promises.
      //   • Forcing ignored the cross-encoder entirely. Adding an aside ("...see ADR-201") to an
      //     unrelated question promoted a passage scored ce=-1.860 — explicitly judged NOT relevant —
      //     to position #2, pushing out genuinely on-topic answers. The disclosure fix was actively
      //     degrading answers, which is worse than the ambiguity it set out to expose.
      //
      // So: the NOTE is the disclosure and it always fires. Reordering only happens when the query
      // really is a bare ADR lookup ("ADR-085", "what does ADR-085 say") rather than a question that
      // merely mentions one — and it is always capped at k, because a caller asking for k means k.
      const residual = String(query).replace(adrMatch[0], ' ').replace(/[^a-z0-9]+/gi, ' ').trim();
      const isBareLookup = residual.split(/\s+/).filter(Boolean).length <= 4;
      if (isBareLookup) {
        const forced = [...byRepo.values()].slice(0, k);
        const forcedSet = new Set(forced);
        results = [...forced, ...ranked.filter((r) => !forcedSet.has(r))].slice(0, k);
      }
    }
  }

  // ── EVIDENCE GRADE — the tool reports its OWN confidence, as data ─────────────────────────────
  //
  // THE FAILURE THIS FIXES, in the user's words: "every shallow sweep concluded, wrongly, that we'd
  // have to build it ourselves." A thin-coverage query ("audio DSP speech enhancement") returned four
  // results formatted exactly like four answers — but only the first (ce 3.71) was real; the rest
  // scored 1.04, -1.28, -2.77. The cross-encoder had ALREADY judged those irrelevant and we handed
  // them over anyway. A reasonable reader sees four mostly-useless hits and concludes the ecosystem
  // has nothing. That is the worst outcome this product can produce: the tool whose entire purpose is
  // preventing hand-rolling CAUSED hand-rolling — not by hiding the answer, but by making thin
  // evidence indistinguishable from strong evidence.
  //
  // This is NOT agentdb_explainable_recall's job (that explains why a given match scored where it
  // did); this is "is this result set trustworthy enough to act on at all".
  //
  // Thresholds DERIVED from measured runs on this corpus, never invented:
  //   10.22  exact package-name match          8.43  AgentDB capability question
  //    6.73  solid conceptual hit              5.56  ADR lookup
  //    4.37  the WEAKEST question in the answer-quality suite that has a known-good answer
  //    3.71  the query that wrongly read as "nothing exists"
  const STRONG = 6.0, OK = 4.0;
  const topScore = results.length && results[0].ceScore != null ? results[0].ceScore : null;

  // Never hand back what the reranker already rejected. A negative cross-encoder score means "not
  // relevant to this query"; passing it along as a result is how noise becomes a conclusion. The
  // single best hit is always kept, so a caller can still see the strongest thing that exists.
  const kept = results.filter((r, i) => i === 0 || (r.ceScore ?? -Infinity) >= 0);
  const droppedIrrelevant = results.length - kept.length;
  results = kept;

  const grade = topScore == null ? 'insufficient_evidence'
    : topScore >= STRONG ? 'strong'
    : topScore >= OK ? 'ok'
    : topScore >= 0 ? 'thin'
    : 'insufficient_evidence';

  // The sentence that matters. Retrieval finding little is NOT evidence the thing does not exist —
  // it is evidence THIS QUERY did not reach it. Said explicitly, because a model reading weak
  // results will otherwise supply the wrong conclusion on its own, and that conclusion is expensive.
  const evidence = {
    grade,
    topScore: topScore == null ? null : Number(topScore.toFixed(3)),
    droppedIrrelevant,
    caveat: (grade === 'thin' || grade === 'insufficient_evidence')
      ? 'WEAK COVERAGE for this query. Do NOT conclude the ecosystem lacks this capability — absence '
        + 'of retrieval is not absence of code. Narrow the query, name a specific repo, or search for a '
        + 'concrete artifact (function, struct, or package name) before deciding to build it yourself.'
      : null,
  };

  return { repos: list, perRepo, results, pooled: candidates.length, corpusAge, adrCollision, evidence };
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
  const { repos: used, perRepo, results, pooled, adrCollision, evidence } = await searchAll({ dir, query, k, pool, repos });
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
  // Surface the ambiguity BEFORE the results, so it is read as a caveat on everything below rather
  // than a footnote after the reader has already accepted the first hit as "the" answer.
  if (adrCollision) console.log(`⚠ ${adrCollision.note}`);
  // Confidence BEFORE the results, so it is read as a caveat on everything below rather than a
  // footnote after the reader has already drawn a conclusion from a thin list.
  if (evidence?.caveat) {
    console.log(`⚠ EVIDENCE: ${evidence.grade.toUpperCase()} (top score ${evidence.topScore}) — ${evidence.caveat}`);
  }
  if (evidence?.droppedIrrelevant > 0) {
    console.log(`  (${evidence.droppedIrrelevant} result(s) the reranker judged irrelevant were withheld rather than padded in)`);
  }
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

// REALPATH BOTH SIDES, not path.resolve(). REPRODUCED LIVE 2026-07-27: path.resolve() normalizes
// a path but does NOT follow symlinks, while `import.meta.url` IS symlink-resolved by Node. So
// invoking this file through ANY symlink — an npm bin shim, a wrapper script, a symlinked KB dir —
// made the two sides disagree, main() never ran, and the process printed NOTHING and exited 0.
// Silent success is the worst failure this repo has: the brain looks like it answered and returned
// no answer, and every caller downstream treats exit 0 as "searched, found nothing". Found by
// accident while building a benchmark harness out of symlinks; the same defect class was
// independently found in plugin/scripts/hook-input.mjs's isMain by the D9 hook audit the same day,
// where it fails every write-gate OPEN. realpath can throw (broken link, permissions), so each side
// falls back to its unresolved form rather than crashing the entry point.
const __filename = fileURLToPath(import.meta.url);
const realOrSelf = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && realOrSelf(process.argv[1]) === realOrSelf(__filename)) {
  main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
