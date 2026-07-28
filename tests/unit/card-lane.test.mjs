// tests/unit/card-lane.test.mjs — kb/card-lane.mjs: the FAST LANE first responder over
// kb/capability-cards.md (see kb/card-lane.mjs header for the full "measured 19.6s warm / 73s
// cold heavy path" backstory).
//
// RED FIRST — recorded, verbatim, before kb/card-lane.mjs existed:
//
//   $ npx vitest run tests/unit/card-lane.test.mjs
//   Error: Cannot find module '/…/kb/card-lane.mjs' imported from
//     '/…/tests/unit/card-lane.test.mjs'
//    Test Files  1 failed (1)
//
// House rule: "a test that cannot fail on broken code is not a test." The suite below is built to
// prove TWO invariants, each with its own counter-example so neither is vacuous:
//   1. A confidently-covered question gets a real, cited, non-empty answer (positive).
//   2. A question the cards do NOT cover returns hit:false — NEVER a fabricated card (negative,
//      including an ADVERSARIAL near-miss: a question that NAMES a covered repo but asks about a
//      specific feature the card never mentions, which a naive "repo named → confident" rule would
//      wrongly answer).
//
// The representative question set is REAL, first-party material already used to gate by-description
// routing (plugin/test/capability-questions{,.heldout}.json) — not invented for this test.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseCards, loadCards, answerFromCards, renderCardHit } from '../../kb/card-lane.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KB = path.join(REPO, 'kb');
const PRIVATE_STORES = JSON.parse(fs.readFileSync(path.join(KB, 'PRIVATE-STORES.json'), 'utf8')).privateStores;

const QUESTION_SETS = [
  JSON.parse(fs.readFileSync(path.join(REPO, 'plugin/test/capability-questions.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(REPO, 'plugin/test/capability-questions.heldout.json'), 'utf8')),
].flat();

describe('parseCards — the same "## <repo>" shape scripts/build-concepts.mjs reads', () => {
  it('parses the real kb/capability-cards.md into repo/body cards, at least 30 of them', () => {
    const md = fs.readFileSync(path.join(KB, 'capability-cards.md'), 'utf8');
    const cards = parseCards(md);
    expect(cards.length).toBeGreaterThanOrEqual(30);
    const byRepo = Object.fromEntries(cards.map((c) => [c.repo, c.body]));
    expect(byRepo.ruflo).toMatch(/orchestrat/i);
    expect(byRepo.ruvector).toMatch(/HNSW/);
    expect(byRepo.agentdb).toMatch(/graph/i);
  });

  it('never carries a card for a privately-fenced repo — the source file is already curated', () => {
    const md = fs.readFileSync(path.join(KB, 'capability-cards.md'), 'utf8');
    const cards = parseCards(md);
    const leaked = cards.filter((c) => PRIVATE_STORES.includes(c.repo.toLowerCase()));
    expect(leaked.map((c) => c.repo)).toEqual([]);
  });

  it('ignores a malformed section (no repo name) rather than throwing', () => {
    expect(() => parseCards('## \nno repo name here\n## real\nbody text here')).not.toThrow();
    const cards = parseCards('## \nno repo name here\n## real\nbody text here');
    expect(cards).toEqual([{ repo: 'real', body: 'body text here' }]);
  });
});

describe('loadCards — reads capability-cards.md from a bundle dir, honestly absent when missing', () => {
  let tmp;
  it('returns null (never a fabricated empty-but-present card list) when the file is absent', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-lane-empty-'));
    expect(loadCards(tmp)).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('parses a real fixture file and memoizes by mtime (cache invalidates on real edit)', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-lane-fixture-'));
    const file = path.join(tmp, 'capability-cards.md');
    fs.writeFileSync(file, '## widget\nA thing that widgets. Reach for widget whenever you need widgeting.\n');
    const first = loadCards(tmp);
    expect(first).toHaveLength(1);
    expect(first[0].repo).toBe('widget');

    // same mtime (no write) -> cache hit, same array reference
    expect(loadCards(tmp)).toBe(first);

    // real edit -> mtime changes -> cache must invalidate, not serve stale content
    fs.writeFileSync(file, '## widget\nUpdated body.\n\n## gadget\nA second card.\n');
    const second = loadCards(tmp);
    expect(second).not.toBe(first);
    expect(second.map((c) => c.repo)).toEqual(['widget', 'gadget']);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('answerFromCards — POSITIVE: a real, representative "does rUv ship X" question set', () => {
  const results = QUESTION_SETS.map((q) => ({ q, hit: answerFromCards(q.query, KB) }));

  it('measures and reports the REAL hit fraction on this representative set (no estimate)', () => {
    const hitCount = results.filter((r) => r.hit.hit).length;
    // eslint-disable-next-line no-console
    console.log(`[card-lane] representative set: ${hitCount}/${results.length} answered by the fast lane`);
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.hit.hit ? 'HIT ' : 'MISS'} repo=${r.hit.repo || '-'}  "${r.q.query}"`);
    }
    // A real, non-trivial slice of this domain-matched set must be answerable — this is the whole
    // point of the fast lane. The exact fraction is reported above from a REAL run, never assumed.
    expect(hitCount).toBeGreaterThanOrEqual(Math.ceil(results.length * 0.6));
  });

  it('every hit on this set names one of the repos the question itself expects', () => {
    for (const r of results) {
      if (!r.hit.hit) continue;
      expect(r.q.expectRepo, `unexpected hit for "${r.q.query}"`).toContain(r.hit.repo);
    }
  });

  it('a plain "what is <repo> and what does it do" question is answered — the degenerate, ideal case', () => {
    const hit = answerFromCards('What is dspy.ts and what does it do?', KB);
    expect(hit.hit).toBe(true);
    expect(hit.repo).toBe('dspy.ts');
    expect(hit.text).toMatch(/DSPy/i);
  });

  it('an unnamed, purely DESCRIBED need still resolves to the right repo (no repo named at all)', () => {
    const hit = answerFromCards('what should I reach for to cache repeated vector queries in front of a vector store so lookups come back faster', KB);
    expect(hit.hit).toBe(true);
    expect(hit.repo).toBe('rulake');
  });
});

describe('answerFromCards — NEGATIVE: silence-or-fallthrough, NEVER a fabricated hit', () => {
  it('an empty query is refused, not guessed', () => {
    expect(answerFromCards('', KB).hit).toBe(false);
    expect(answerFromCards('   ', KB).hit).toBe(false);
  });

  it('a domain-irrelevant question (nothing to do with RuvNet) is not fabricated into a hit', () => {
    const hit = answerFromCards('How do I center a div vertically with CSS flexbox?', KB);
    expect(hit.hit).toBe(false);
  });

  it('a question about a repo that does not exist in this ecosystem at all is not fabricated', () => {
    const hit = answerFromCards('Does RuvNet ship a repo called zephyr-quantum-blockchain for supply chain logistics?', KB);
    expect(hit.hit).toBe(false);
  });

  // A subtler case than the fictional-repo one above: "cognitum-seed" (private, no card of its
  // own) shares the generic word "cognitum" with the PUBLIC "cognitum-cogs" card, whose own prose
  // legitimately discusses Cognitum Seed hardware (cognitum-cogs is the public crate ecosystem FOR
  // it). Measured while writing this suite: an earlier scorer treated the shared word fragment as
  // "the query named cognitum-cogs", which is the wrong kind of match — identity must require the
  // query to contain the repo's WHOLE name, never a shared prefix fragment (see wholeTokens() in
  // card-lane.mjs). This is NOT asserting hit:false here — cognitum-cogs' card is real, public, and
  // genuinely on-topic for "what capabilities does Cognitum Seed ship" (it answers via the public
  // half of the story) — it asserts the SPECIFIC failure mode is gone: a hit here must never be
  // reported as naming a repo the query never actually named.
  it('a generic shared word-fragment (not the whole repo name) does not count as "named"', () => {
    const hit = answerFromCards('What capabilities does the cognitum-seed appliance ship?', KB);
    if (hit.hit) expect(hit.namedRepo).toBe(false);
  });

  // THE ADVERSARIAL CASE. This is the one a naive "the query names a covered repo -> confident"
  // rule gets wrong: AgentDB IS a covered repo, but its card never mentions reinforcement learning,
  // Thompson-Sampling, or bandits. Naming the repo must NOT be sufficient on its own — the card's
  // OWN content must actually speak to what was asked, or this must fall through honestly.
  it('naming a covered repo is NOT enough on its own — the card must speak to the SPECIFIC ask', () => {
    const hit = answerFromCards('Does AgentDB include reinforcement-learning algorithms and a Thompson-Sampling bandit?', KB);
    expect(hit.hit).toBe(false);
  });

  it('BREAK IT: the same repo-naming DOES confidently hit when the card actually covers the ask', () => {
    // The counterfactual proving the assertion above is not vacuous — same repo, a question its
    // own card really does answer.
    const hit = answerFromCards('Can AgentDB run graph queries over agent memory?', KB);
    expect(hit.hit).toBe(true);
    expect(hit.repo).toBe('agentdb');
  });

  it('no card in this bundle ever cites a privately-fenced repo, even under adversarial phrasing', () => {
    for (const term of PRIVATE_STORES) {
      const hit = answerFromCards(`what does ${term} do and how do I use it`, KB);
      if (hit.hit) expect(hit.repo.toLowerCase()).not.toBe(term.toLowerCase());
    }
  });
});

describe('renderCardHit — the answer must be usable and cited on its own', () => {
  it('carries the fast-lane marker, the citation path, the repo, and the full card body', () => {
    const hit = answerFromCards('Can ruflo orchestrate agent swarms, and what implements it?', KB);
    expect(hit.hit).toBe(true);
    const text = renderCardHit(hit);
    expect(text).toMatch(/FAST LANE/);
    expect(text).toContain('capability-cards.md');
    expect(text).toContain('ruflo');
    expect(text).toBe(text); // sanity: renders without throwing
    expect(text.length).toBeGreaterThan(hit.text.length); // more than just the bare card body
  });
});
