// tests/unit/claims-verify.test.mjs — the claims ledger (ADR-0011 Phase 0) is what makes every
// advertised number falsifiable, so each checker gets a test proving it FAILS on a tampered
// artifact. A ledger that can only pass verifies nothing.
//
// scripts/claims-verify.mjs is main-guarded (like scripts/eval-brain.mjs), so importing its
// checkers here runs no CLI. Every checker takes artifact paths as parameters with repo
// defaults — tampered copies go to a tmpdir and the checker is pointed at them.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ledger,
  verifyBaseline,
  verifyHeldOutStrata,
  verifyCheaperFactor,
  verifyCoverageBadge,
  verifyVersionSurfaces,
  verifyChunkCountSurfaces,
  computePublicChunkTotal,
  CHUNK_SURFACES,
  EXPECTED_STRATA,
  readBadgePct,
} from '../../scripts/claims-verify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'claims-verify-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const writeTmp = (name, content) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
};

describe('ledger shape', () => {
  it('has six claims, each with claim/source/verify', () => {
    expect(ledger.length).toBe(6);
    for (const entry of ledger) {
      expect(typeof entry.claim).toBe('string');
      expect(typeof entry.source).toBe('string');
      expect(typeof entry.verify).toBe('function');
    }
  });
});

describe('verifyBaseline — recorded truth + shape consistency', () => {
  const realBaseline = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/baseline.json'), 'utf8'));

  it('passes on the real repo artifact', () => {
    expect(verifyBaseline().status).toBe('PASS');
  });

  it('rejects k > n — an impossible count must never verify', () => {
    const b = realBaseline();
    b.score.grounded.k = b.score.grounded.n + 5;
    const res = verifyBaseline(writeTmp('baseline-k-gt-n.json', b));
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toMatch(/k=105 > n=100|p=.*≠/);
  });

  it('rejects a broken interval (p above hi)', () => {
    const b = realBaseline();
    b.score.routed.hi = b.score.routed.p - 0.1;
    const res = verifyBaseline(writeTmp('baseline-bad-interval.json', b));
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('interval broken');
  });

  it('rejects drift from the recorded truth (routed n changed)', () => {
    const b = realBaseline();
    b.score.routed.n = 81;
    b.score.routed.p = b.score.routed.k / 81;
    b.score.routed.lo = 0;
    b.score.routed.hi = 1;
    const res = verifyBaseline(writeTmp('baseline-routed-n.json', b));
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('routed n=80');
  });

  it('fails, not throws, on a missing file', () => {
    expect(verifyBaseline(path.join(TMP, 'nope.json')).status).toBe('FAIL');
  });
});

describe('verifyHeldOutStrata — the census is recounted, not trusted', () => {
  const realSet = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'evals/held-out.json'), 'utf8'));

  it('passes on the real frozen set (120 across 5 strata)', () => {
    expect(verifyHeldOutStrata().status).toBe('PASS');
  });

  it('fails on a tampered copy with a question removed', () => {
    const s = realSet();
    s.questions = s.questions.slice(1);
    const res = verifyHeldOutStrata(writeTmp('held-out-minus-one.json', s));
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('119 ≠ 120');
  });

  it('fails on a tampered copy with a question moved between strata (total still 120)', () => {
    const s = realSet();
    const q = s.questions.find((x) => x.stratum === 'named');
    q.stratum = 'described';
    const res = verifyHeldOutStrata(writeTmp('held-out-moved.json', s));
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toMatch(/named: 27 ≠ 28/);
  });

  it('fails on an unexpected sixth stratum', () => {
    const s = realSet();
    s.questions[0] = { ...s.questions[0], stratum: 'bonus' };
    const res = verifyHeldOutStrata(writeTmp('held-out-sixth.json', s));
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('unexpected stratum "bonus"');
  });

  it('advertised census matches ADR-0011', () => {
    expect(EXPECTED_STRATA).toEqual({ named: 28, described: 32, scenario: 20, adversarial: 20, provenance: 20 });
  });
});

describe('verifyCheaperFactor — ~56× regenerates from the corpus, or skips LOUDLY', () => {
  it('SKIPs (never silently passes) when the brain is not installed', async () => {
    const res = await verifyCheaperFactor(path.join(TMP, 'absent.passages.jsonl'));
    expect(res.status).toBe('SKIP');
    expect(res.evidence).toContain('brain not installed');
  });

  it('fails when the corpus fact is missing from the passages file', async () => {
    const p = writeTmp('tampered.passages.jsonl', '{"text":"a run cost $9.99 and nothing else"}\n');
    const res = await verifyCheaperFactor(p);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('$0.267');
  });

  it('passes when both corpus strings are present (streaming, first match wins)', async () => {
    const p = writeTmp(
      'good.passages.jsonl',
      '{"text":"total run cost $0.267"}\n{"text":"vs $15 direct — 51.33 dollars-per-run baseline"}\n',
    );
    const res = await verifyCheaperFactor(p);
    expect(res.status).toBe('PASS');
    expect(res.evidence).toContain('56.2');
  });
});

describe('verifyCoverageBadge — the badge % is RE-DERIVED from the real coverage run, never string-matched', () => {
  // v8 json-summary shape: { total: { statements:{pct}, branches:{pct}, functions:{pct}, lines:{pct} } }
  let seq = 0;
  const summary = (pcts) => writeTmp(`cov-summary-${seq++}.json`, {
    total: {
      statements: { pct: pcts.statements },
      branches: { pct: pcts.branches },
      functions: { pct: pcts.functions },
      lines: { pct: pcts.lines },
    },
  });
  const realVitest = path.join(ROOT, 'vitest.config.mjs');
  const realReadme = path.join(ROOT, 'README.md');
  // The four live metrics measured 2026-07-18 (min = branches 14.55 → floor 14, the shipped badge).
  const liveIsh = { statements: 16.21, branches: 14.55, functions: 19.69, lines: 17.38 };

  // Since 2026-07-26 the checker refuses to grade an artifact it cannot show is fresher than the
  // source it measures (tests/unit/claims-artifact-freshness.test.mjs). A grading test therefore
  // needs a COMPLETE fixture — config, source, summary, mtimes — not just a `total` block: the old
  // half-fixtures paired a tmp summary with the REPO's config, which is exactly the "measures a
  // source set it has never seen" shape the precondition now rejects.
  const gradable = (name, pcts, badgePct) => {
    const root = path.join(TMP, name);
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'coverage'), { recursive: true });
    const src = path.join(root, 'src', 'a.mjs');
    const vitestFile = path.join(root, 'vitest.config.mjs');
    const readmeFile = path.join(root, 'README.md');
    const summaryFile = path.join(root, 'coverage', 'coverage-summary.json');
    fs.writeFileSync(src, 'export const a = 1;\n');
    fs.writeFileSync(vitestFile, 'export default { test: { coverage: { all: true, include: ["src/*.mjs"], exclude: [] } } };\n');
    fs.writeFileSync(readmeFile, `# X\n[![coverage](https://img.shields.io/badge/coverage-${badgePct}%25%20of%20ALL%20source%20·%20honest-b58900)](#)\n`);
    fs.writeFileSync(summaryFile, JSON.stringify({
      total: { statements: { pct: pcts.statements }, branches: { pct: pcts.branches }, functions: { pct: pcts.functions }, lines: { pct: pcts.lines } },
      [src]: { statements: { pct: pcts.statements } },
    }));
    const at = (f, s) => { const t = new Date(Date.now() + s * 1000); fs.utimesSync(f, t, t); };
    at(src, -600); at(vitestFile, -600); at(summaryFile, -300); // measured AFTER the source it measures
    return { root, readmeFile, summaryFile, vitestFile };
  };

  it('readBadgePct parses the advertised integer from the real README, null when the badge is gone', () => {
    const n = readBadgePct(fs.readFileSync(realReadme, 'utf8'));
    expect(typeof n).toBe('number');
    expect(n).toBeGreaterThan(0);
    expect(readBadgePct('no badge here')).toBeNull();
  });

  it('passes: a badge that matches floor(min of the four metrics) within 1pt', async () => {
    const f = gradable('cov-pass', { statements: 17, branches: 15.4, functions: 20, lines: 18 }, 15);
    const res = await verifyCoverageBadge(f.readmeFile, f.summaryFile, f.vitestFile, f.root);
    expect(res.status, res.evidence).toBe('PASS');
    expect(res.evidence).toContain('15');
  });

  it('KNOWN-BAD (the exact live lie just fixed): badge says 10% while the real floor is 14% → FAIL naming both', async () => {
    const f = gradable('cov-lying', liveIsh, 10);
    const res = await verifyCoverageBadge(f.readmeFile, f.summaryFile, f.vitestFile, f.root);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('10%'); // the false claim
    expect(res.evidence).toContain('14%'); // the re-derived truth
  });

  it('SKIPs LOUDLY (never a silent pass) when the coverage summary has not been generated', async () => {
    const res = await verifyCoverageBadge(realReadme, path.join(TMP, 'no-such-summary.json'), realVitest);
    expect(res.status).toBe('SKIP');
    expect(res.evidence).toContain('test:cov');
  });

  it('fails when the coverage badge is gone from the README entirely', async () => {
    const noBadge = writeTmp('README-no-badge.md', '# RuvNet Brain\n\nNo badge here.\n');
    const res = await verifyCoverageBadge(noBadge, summary(liveIsh), realVitest);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('badge');
  });

  it('fails when vitest.config no longer sets all: true, even with the badge intact', async () => {
    const vitestCfg = writeTmp('vitest-no-all.config.mjs', 'export default { test: { coverage: { all: false } } };\n');
    const res = await verifyCoverageBadge(realReadme, summary(liveIsh), vitestCfg);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('all: true');
  });
});

describe('verifyChunkCountSurfaces — the advertised chunk count regenerates, or skips LOUDLY', () => {
  // Build a miniature brain in tmp: two public stores + one private, with idmap sidecars.
  const idmap = (n) => {
    const idToLabel = {};
    for (let i = 0; i < n; i++) idToLabel[i] = `chunk-${i}`;
    return { idToLabel, labelToId: {}, nextLabel: n };
  };
  const mkBrain = (dirName) => {
    const kb = path.join(TMP, dirName);
    fs.mkdirSync(kb, { recursive: true });
    fs.writeFileSync(path.join(kb, 'PRIVATE-STORES.json'), JSON.stringify({ privateStores: ['secret'] }));
    fs.writeFileSync(path.join(kb, 'alpha.big.rvf.idmap.json'), JSON.stringify(idmap(1200)));
    fs.writeFileSync(path.join(kb, 'beta.big.rvf.idmap.json'), JSON.stringify(idmap(34)));
    fs.writeFileSync(path.join(kb, 'secret.big.rvf.idmap.json'), JSON.stringify(idmap(999)));
    return kb;
  };

  it('SKIPs (never silently passes) when the brain is not installed', () => {
    const empty = path.join(TMP, 'no-kb');
    fs.mkdirSync(empty, { recursive: true });
    const res = verifyChunkCountSurfaces(empty);
    expect(res.status).toBe('SKIP');
    expect(res.evidence).toContain('brain not installed');
  });

  it('computePublicChunkTotal sums public stores only — the private fence holds', () => {
    const kb = mkBrain('kb-fence');
    expect(computePublicChunkTotal(kb)).toEqual({ total: 1234, stores: 2 });
  });

  it('passes when every surface quotes the regenerated count', () => {
    const kb = mkBrain('kb-good');
    const root = path.join(TMP, 'root-good');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'S.md'), 'That is **1,234 source chunks** in the brain.\n');
    const res = verifyChunkCountSurfaces(kb, ['S.md'], root);
    expect(res.status).toBe('PASS');
    expect(res.evidence).toContain('1,234');
  });

  it('fails when a surface still quotes a STALE count, even alongside the fresh one', () => {
    const kb = mkBrain('kb-stale');
    const root = path.join(TMP, 'root-stale');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'S.md'), '1,234 chunks here, but elsewhere 128,994 source chunks.\n');
    const res = verifyChunkCountSurfaces(kb, ['S.md'], root);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('128,994');
  });

  it('fails when a surface simply does not quote the number', () => {
    const kb = mkBrain('kb-missing');
    const root = path.join(TMP, 'root-missing');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'S.md'), 'A brain of unspecified size.\n');
    const res = verifyChunkCountSurfaces(kb, ['S.md'], root);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('does not contain');
  });

  it('fails when the explainer animated counter data-count attribute is stale', () => {
    const kb = mkBrain('kb-counter');
    const root = path.join(TMP, 'root-counter');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(
      path.join(root, 'S.html'),
      '1,234 source chunks. <span data-count="9999">1,234</span> chunks\n',
    );
    const res = verifyChunkCountSurfaces(kb, ['S.html'], root);
    expect(res.status).toBe('FAIL');
    expect(res.evidence).toContain('data-count="9999"');
  });

  it('passes on the real repo artifacts when the brain is present (else skips)', () => {
    const res = verifyChunkCountSurfaces();
    expect(['PASS', 'SKIP']).toContain(res.status);
    if (res.status === 'PASS') expect(res.evidence).toContain(`${CHUNK_SURFACES.length} surfaces`);
  });
});

describe('verifyVersionSurfaces — delegates to the existing single-source-of-truth check', () => {
  it('passes on the real repo (sync-version --check exits 0)', () => {
    const res = verifyVersionSurfaces();
    // evidence in the message: on a FAIL, the runner names the drifted surface instead of just 'FAIL'
    expect(res.status, res.evidence).toBe('PASS');
    expect(res.evidence).toContain('agree');
  });
});
