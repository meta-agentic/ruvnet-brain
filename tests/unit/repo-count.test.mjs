import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// LIE #1 (found 2026-07-18): SKILL.md (line 8, agent-facing ground truth) and primer.md both
// asserted "32 RuvNet repos" / "32-repo corpus" while data/manifest.json's real coverage was
// built=57 (catalogued=181, orgTotalApprox=248) — README carried its own stale "36 repos"/"197
// live ruvnet repos" on top of that. A wrong corpus-size literal in SKILL.md doesn't just look
// bad, it actively misleads every agent session that reads it as ground truth. This gate reads
// the live manifest and fails the build the instant any repo-count literal in these three public
// surfaces drifts from it again — same "single source of truth" shape as
// narrative-version.test.mjs (version strings) and sync-version.mjs (semver fields).
const ROOT = process.cwd();
const coverage = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8')).coverage;
const ALLOWED = new Set([coverage.built, coverage.catalogued, coverage.orgTotalApprox]);

const SURFACES = ['README.md', 'plugin/skills/ruvnet-brain/SKILL.md', 'primer/ruvnet-primer.md'];

// Below this magnitude a "N repos" mention is never a corpus-size claim in these docs — e.g.
// "the 8 newest repos are findable by name" names a small named subset, not the corpus total.
// Restricting the net to plausible corpus magnitudes avoids that whole false-positive class
// without an exemption entry per incidental small-number mention.
const MIN_CORPUS_MAGNITUDE = 20;

// Deliberate, documented exceptions: the literal is correct AS WRITTEN because it describes a
// PAST state (a "before" baseline in a receipts table), not a current claim — not stale data.
// Anything else that disagrees with ALLOWED fails. Keyed `${file}::${matched text}` so a typo'd
// exemption can't silently swallow an unrelated real regression.
const EXEMPT = new Set([
  'README.md::24 repos', // v1 (pre-2.0) baseline column in the "what 2.0 proved" before/after table
  'README.md::24→57 verified repos', // same v1-baseline row, "24→<current>" delta phrasing
]);

/** @param {string} src @returns {{text: string, n: number}[]} */
export function findRepoCountLiterals(src) {
  const found = [];
  // Covers "repo(s)" and the spelled-out "repositor(y|ies)" (SKILL.md line 8's own phrasing:
  // "32 RuvNet (rUv / Reuven Cohen) repositories" — real prose puts several filler words/
  // parentheticals between the number and the noun, so this can't be a fixed word count).
  const REPO_WORD = '(?:repos?|repositor(?:y|ies))';
  // Digit NOT immediately followed by "+": an open lower-bound like "20+ repos" is a true,
  // deliberately-vague qualifier, not a precise count claim — exempt from matching at all rather
  // than needing a per-mention exemption. Filler between the digit and the repo-word is capped at
  // 50 chars and may not cross a sentence end / table-cell boundary (".", "|", newline), so this
  // can't accidentally bridge two unrelated numbers separated by prose.
  const reSpaced = new RegExp(`\\b(\\d{1,4})(?!\\+)\\b(?:(?![.|\\n])[\\s\\S]){0,50}?\\b${REPO_WORD}\\b`, 'gi');
  const reHyphen = new RegExp(`\\b(\\d{1,4})(?!\\+)-repos?\\b`, 'gi');
  for (const re of [reSpaced, reHyphen]) {
    for (const m of src.matchAll(re)) {
      const n = Number(m[1]);
      if (n >= MIN_CORPUS_MAGNITUDE) found.push({ text: m[0], n });
    }
  }
  return found;
}

function staleLiterals(file, src) {
  return findRepoCountLiterals(src).filter(
    (h) => !ALLOWED.has(h.n) && !EXEMPT.has(`${file}::${h.text}`),
  );
}

describe(`repo-count literals match data/manifest.json coverage (built=${coverage.built}, catalogued=${coverage.catalogued}, org≈${coverage.orgTotalApprox})`, () => {
  for (const f of SURFACES) {
    it(`${f} — every repo-count literal is ${[...ALLOWED].join('/')} or a documented exemption`, () => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const bad = staleLiterals(f, src);
      expect(
        bad.map((h) => h.text),
        `${f} has stale repo-count literal(s) that disagree with the manifest: ${bad.map((h) => h.text).join(', ')}`,
      ).toEqual([]);
    });
  }

  it('sanity: the manifest coverage numbers this gate trusts are themselves internally consistent', () => {
    expect(coverage.built).toBeGreaterThan(0);
    expect(coverage.catalogued).toBeGreaterThanOrEqual(coverage.built);
    expect(coverage.orgTotalApprox).toBeGreaterThanOrEqual(coverage.catalogued);
  });

  // Self-proving: demonstrates the detector actually catches the exact historical lie (not just
  // "some test exists") without needing to corrupt a real file to prove it works. Regression-proof
  // against the detector logic itself going quietly toothless in a future refactor.
  it('detector: flags the known-bad historical literals — the actual wording that shipped', () => {
    const known_bad = [
      // the real SKILL.md line 8, pre-fix (parenthetical between number and noun)
      'You have a source-grounded brain over 32 RuvNet (rUv / Reuven Cohen) repositories, exposed through the `ruvnet-brain` MCP server.',
      '**36 repos** built (of 197 live ruvnet repos), each verified by a live retrieval query',
      'across the full 32-repo corpus, not just the 3-4 names that come to mind first',
      'a portable brain over **32 RuvNet building-block repos**, embedded and indexed at pinned SHAs',
      'any of the 173 catalogued, or any rUv repo',
    ];
    for (const src of known_bad) {
      const bad = staleLiterals('synthetic', src);
      expect(bad.length, `expected a stale hit in: ${src}`).toBeGreaterThan(0);
    }
  });

  it('detector: does not flag the correct literals (57 / 181 / 248), the documented v1 baseline, or an open "N+" qualifier', () => {
    const known_good = [
      'You have a source-grounded brain over 57 RuvNet (rUv / Reuven Cohen) repositories, exposed through the `ruvnet-brain` MCP server.',
      '**57 repos** built (of 248 in the org), each verified by a live retrieval query',
      'across the full 57-repo corpus, not just the 3-4 names that come to mind first',
      'Covers: 57/181 repos built @ pinned SHAs',
      '24 repos built | **57 repos** built (of 248 in the org)', // v1 baseline + current, same row
      '24→57 verified repos', // v1-baseline delta phrasing
      "or any of rUv's 20+ repos", // deliberately open lower-bound, not a precise count
      'This is a 20+-repo ecosystem, not just the 2-3 most commonly cited',
      'any of the 181 catalogued, or any rUv repo',
    ];
    for (const src of known_good) {
      expect(staleLiterals('README.md', src), `unexpected stale hit in: ${src}`).toEqual([]);
    }
  });
});
