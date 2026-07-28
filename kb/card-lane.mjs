#!/usr/bin/env node
// card-lane.mjs — the FAST LANE first responder over kb/capability-cards.md.
//
// WHY THIS EXISTS (measured 2026-07-27, on a quiet machine): the cross-repo heavy search
// (`searchAll` in forge-ask-all.mjs) costs ~19,620ms warm / ~72,970ms cold per query, almost
// entirely TRANSFORMER LOAD/INIT (two ONNX models: the bge/MiniLM embedder + the ms-marco
// cross-encoder reranker) — the HNSW vector search underneath is sub-millisecond. Meanwhile the
// single most common question this brain answers — "does rUv already ship this? which tool do I
// reach for?" — is fully answered by kb/capability-cards.md, a hand-written ~20KB prose file with
// one card per building block. This module answers THAT question with ZERO ML: plain
// tokenization + keyword overlap over the cards, so a covered question returns in low-single-digit
// milliseconds and never loads either ONNX model.
//
// THE CONTRACT THIS MUST HONOR (non-negotiable — "the product can never lie"):
//   1. ANSWER, not just filter. A hit returns the full card text, cited to capability-cards.md and
//      the repo it describes — usable on its own, not a "maybe check X" nudge.
//   2. SILENCE OR FALLTHROUGH, NEVER A FABRICATED HIT. A query the cards do not confidently cover
//      returns { hit: false, reason }. The caller (forge-mcp-all.mjs) then runs the heavy path
//      exactly as before — this module never stands in the way of a real answer, it only skips
//      the wait when it already knows the answer cold. NAMING a covered repo is NOT by itself
//      sufficient confidence — see the adversarial case in tests/unit/card-lane.test.mjs: "Does
//      AgentDB include a Thompson-Sampling bandit?" names a real, covered repo, but its card never
//      mentions reinforcement learning or bandits, so this must fall through honestly rather than
//      hand back a generic AgentDB description as if it answered the specific question asked.
//   3. The heavy path is UNTOUCHED. This module does not change forge-ask-all.mjs and is invoked
//      strictly BEFORE it, never instead of it for a genuine miss.
//
// Deliberately NOT ML: no embeddings, no cross-encoder, no @xenova/transformers anywhere in this
// file's module graph — if it ever needs to get smarter than keyword overlap, that is a decision
// to make explicitly, not something to drift into by accident.
import fs from 'node:fs';
import path from 'node:path';

export const CARDS_FILE = 'capability-cards.md';

// A small stopword list — just enough to stop generic question words ("what", "does", "should",
// "use") from diluting the coverage math. This is not a linguistics project; each card already
// carries ~30 real content words, and those are what should do the discriminating.
const STOPWORDS = new Set(`
  a an the of and or but if then else for to from in on at by with without into onto over under
  is are was were be been being do does did doing done can could should would will shall may might
  what which who whom whose when where why how
  this that these those it its i you he she they we my your his her their our
  need needs want wants use uses using used tool tools reach like
  have has had not no nor so such too very just about also
`.trim().split(/\s+/));

/** Lowercase alnum/dotted/hyphenated tokens (keeps package-ish names like "dspy.ts", "cve-bench" whole). */
function rawTokens(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9+.#-]*[a-z0-9]|[a-z0-9]/g) || [];
}

/**
 * Content tokens for scoring: the whole-token pass PLUS each hyphenated compound's own parts
 * (so "graph-database" also credits "graph" and "database"). Splitting only ADDS candidate
 * overlap — it can turn a miss into a hit, never the reverse — so it can only improve recall, not
 * create a false positive on its own; the confidence thresholds below still gate every hit.
 */
export function contentTokens(text) {
  const out = new Set();
  for (const t of rawTokens(text)) {
    if (t.length >= 3 && !STOPWORDS.has(t)) out.add(t);
    if (t.includes('-')) {
      for (const part of t.split('-')) {
        if (part.length >= 3 && !STOPWORDS.has(part)) out.add(part);
      }
    }
  }
  return [...out];
}

/**
 * WHOLE tokens only — deliberately NOT split on hyphens. This is the "is this repo NAMED?"
 * predicate, and splitting would break it: several real repo names share a generic hyphenated
 * prefix ("agent-harness-generator" vs "agentic-flow" vs "agenticow" all split to include
 * "agent"; "cognitum-cogs" splits to include "cognitum", the very word a question about the
 * UNRELATED, privately-fenced "cognitum-seed" would also contain). Measured live during test
 * authoring: with split identity tokens, "what capabilities does the cognitum-seed appliance
 * ship?" registered as naming cognitum-cogs, purely off the shared "cognitum" fragment. Identity
 * must match the repo's WHOLE key, never a fragment of it — content overlap (contentTokens,
 * above) is where splitting belongs, because there it can only ever ADD recall, never identity.
 */
function wholeTokens(text) {
  const out = new Set();
  for (const t of rawTokens(text)) if (t.length >= 3 && !STOPWORDS.has(t)) out.add(t);
  return out;
}

/** Parse "## <repo>\n<body>" sections — the same shape scripts/build-concepts.mjs reads. */
export function parseCards(md) {
  const cards = [];
  for (const sec of String(md || '').split(/^##\s+/m).slice(1)) {
    const nl = sec.indexOf('\n');
    if (nl < 0) continue;
    const repo = sec.slice(0, nl).trim();
    const body = sec.slice(nl + 1).trim();
    if (!repo || !body) continue;
    cards.push({ repo, body });
  }
  return cards;
}

// Memoized by (dir, mtime) — capability-cards.md is tiny (~20KB) and this process is typically the
// long-lived warm MCP child, so parsing once and reusing is what gets a hit down into low-single-
// digit milliseconds instead of re-parsing ~30 cards on every call.
// Keyed by (dir, mtimeMs, SIZE). mtime alone is not enough: many filesystems quantise mtime (ext4
// on CI, and some to a whole second), so two writes inside one tick are indistinguishable and the
// cache serves stale cards. Size is free from the same stat() and closes the common case. Found
// 2026-07-28 when CI went red on exactly that race — the PRODUCT was right and the test was
// clock-dependent, but the staleness window is real and worth closing rather than tolerating.
let _cache = null; // { dir, mtimeMs, size, cards }

/** Read + parse capability-cards.md from a bundle dir. Returns null (never []) when it is absent —
 *  an older/partial bundle without this file must not be silently reported as "zero cards". */
export function loadCards(dir) {
  const file = path.join(dir, CARDS_FILE);
  let stat;
  try { stat = fs.statSync(file); } catch { return null; }
  if (_cache && _cache.dir === dir && _cache.mtimeMs === stat.mtimeMs && _cache.size === stat.size) return _cache.cards;
  const raw = fs.readFileSync(file, 'utf8');
  const cards = parseCards(raw).map((c) => ({
    repo: c.repo,
    body: c.body,
    tokenSet: new Set(contentTokens(`${c.repo} ${c.body}`)),
    // Identity token: the repo's own WHOLE key, lowercased — never split (see wholeTokens above).
    repoIdentity: c.repo.toLowerCase(),
  }));
  _cache = { dir, mtimeMs: stat.mtimeMs, size: stat.size, cards };
  return cards;
}

// Thresholds for the UNNAMED path (the query never names any repo — a purely DESCRIBED need).
// Not invented: tuned against plugin/test/capability-questions{,.heldout}.json, the real
// first-party question set already used to gate by-description routing.
const MIN_OVERLAP = 2;       // at least 2 distinct content words in common with the card
const MIN_COVERAGE = 0.34;   // at least a third of the query's own content words must be explained
const MIN_MARGIN = 1;        // the winner must beat the runner-up by at least one more overlapping word

/**
 * The fast lane's one entry point. Returns a usable, cited answer when the cards confidently cover
 * the query, or { hit: false, reason } when they do not — never a guess dressed as an answer.
 */
export function answerFromCards(query, dir) {
  const q = String(query || '').trim();
  if (!q) return { hit: false, reason: 'empty query' };
  const cards = loadCards(dir);
  if (!cards || !cards.length) return { hit: false, reason: 'no capability-cards.md in this bundle' };

  const qTokens = contentTokens(q);
  if (!qTokens.length) return { hit: false, reason: 'query has no scoreable content words' };
  const qIdentity = wholeTokens(q); // exact whole-token set, for the "is this repo NAMED?" test only

  const scored = cards.map((card) => {
    const namedRepo = qIdentity.has(card.repoIdentity);
    // Once named, don't let the repo's OWN name token (e.g. "rvm") double-count against its body.
    const nonRepoTokens = qTokens.filter((t) => t !== card.repoIdentity);
    let bodyOverlap = 0;
    for (const t of nonRepoTokens) if (card.tokenSet.has(t)) bodyOverlap++;
    const totalOverlap = bodyOverlap + (namedRepo ? 1 : 0); // for ranking/margin only
    return { card, namedRepo, nonRepoCount: nonRepoTokens.length, bodyOverlap, totalOverlap };
  });
  scored.sort((a, b) => b.totalOverlap - a.totalOverlap);
  const top = scored[0];
  const second = scored[1] || { totalOverlap: 0 };

  let confident;
  if (top.namedRepo) {
    // The query names this card's repo outright ("what is X", "does X do Y"). That alone is
    // decisive ONLY when there is nothing else being asked (a plain "what is X" — the degenerate,
    // ideal case for a generic card) OR the card's own body actually speaks to the rest of the
    // question. Naming the repo is never sufficient on its own for a SPECIFIC ask the card is
    // silent on (the Thompson-Sampling/AgentDB case this file's header documents).
    confident = top.nonRepoCount === 0 || top.bodyOverlap >= 1;
  } else {
    const coverage = top.bodyOverlap / qTokens.length;
    confident = top.bodyOverlap >= MIN_OVERLAP
      && coverage >= MIN_COVERAGE
      && (top.totalOverlap - second.totalOverlap) >= MIN_MARGIN;
  }

  if (!confident) {
    return {
      hit: false,
      reason: `no card cleared the confidence bar (closest=${top.card.repo} bodyOverlap=${top.bodyOverlap}/${qTokens.length} named=${top.namedRepo})`,
    };
  }

  return {
    hit: true,
    repo: top.card.repo,
    bodyOverlap: top.bodyOverlap,
    coverage: Number((top.bodyOverlap / qTokens.length).toFixed(2)),
    namedRepo: top.namedRepo,
    path: `${CARDS_FILE}#${top.card.repo}`,
    text: top.card.body,
  };
}

/** Render a fast-lane hit into the same "text block" shape the heavy path returns, so a caller can
 *  read content[0].text uniformly either way — plus a plain marker a consumer can grep for. */
export function renderCardHit(hit) {
  const confidence = hit.namedRepo
    ? 'named directly'
    : `overlap ${hit.bodyOverlap}, coverage ${hit.coverage}`;
  return (
    `⚡ FAST LANE — capability card (kb/${hit.path}), zero-ML keyword match, repo="${hit.repo}" (${confidence})\n\n`
    + `${hit.text}\n\n`
    + `➡ This is a curated summary card, not a full-text passage. For code-level detail (exact APIs, `
    + `function signatures, ADR status), ask a more specific question — that runs the full source search.`
  );
}
