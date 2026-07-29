// tests/unit/forge-ask-all.test.mjs — forge-ask-all makes the whole bundle behave like ONE brain:
// discover the repos in a bundle, pool per-repo hits, rerank on a common scale, and boost the repo the
// question names. discoverRepos is tested against a REAL temp dir; searchAll's orchestration is tested
// with the two heavy deps (per-repo retrieval + cross-encoder rerank) mocked, so we assert the
// observable cross-repo contract without the 512MB brain or any model. Drafted by agentic-qe
// (`aqe test generate kb/forge-ask-all.mjs`, 30 assertions); rewritten here to be runnable + contract-focused.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock the two heavy collaborators by the SAME absolute path forge-ask-all.mjs imports them from.
vi.mock('../../kb/forge-ask.mjs', () => ({ searchKb: vi.fn() }));
vi.mock('../../kb/forge-rerank.mjs', () => ({ rerankPairs: vi.fn() }));

import { discoverRepos, searchAll } from '../../kb/forge-ask-all.mjs';
import { searchKb } from '../../kb/forge-ask.mjs';
import { rerankPairs } from '../../kb/forge-rerank.mjs';

function mkdirWith(names) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faa-'));
  for (const n of names) fs.writeFileSync(path.join(d, n), 'x');
  return d;
}
const hit = (over = {}) => ({ path: 'p/doc.md', title: 'T', fullText: 'body', bestDistance: 0.1, ...over });

describe('discoverRepos — which repos live in a bundle dir', () => {
  it('lists sorted, unique repo base names from *.rvf stores', () => {
    const d = mkdirWith(['zebra.rvf', 'alpha.rvf', 'beta.rvf']);
    expect(discoverRepos(d)).toEqual(['alpha', 'beta', 'zebra']);
  });
  it('collapses a repo\'s plain + .big variant into ONE repo', () => {
    const d = mkdirWith(['ruvector.rvf', 'ruvector.big.rvf', 'safla.rvf']);
    expect(discoverRepos(d)).toEqual(['ruvector', 'safla']);
  });
  it('excludes .idmap/.embed sidecars and non-.rvf files', () => {
    const d = mkdirWith(['ruvector.rvf', 'ruvector.idmap.rvf', 'ruvector.embed.rvf', 'readme.md', 'meta.json', 'plain']);
    expect(discoverRepos(d)).toEqual(['ruvector']);
  });
  it('keeps dotted repo names intact (dspy.ts)', () => {
    const d = mkdirWith(['dspy.ts.rvf']);
    expect(discoverRepos(d)).toEqual(['dspy.ts']);
  });
  it('returns [] for a dir with no stores', () => {
    const d = mkdirWith(['README.md']);
    expect(discoverRepos(d)).toEqual([]);
  });
});

describe('searchAll — cross-repo pool + rerank + name-boost', () => {
  beforeEach(() => {
    vi.mocked(searchKb).mockReset();
    vi.mocked(rerankPairs).mockReset();
    // rerank passes candidates through, assigning a per-repo ceScore (daa ranks above safla by default).
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) =>
      cands.map((c) => ({ ...c, ceScore: c.repo === 'daa' ? 1.0 : 0.5 })));
  });

  it('reports the repos searched, per-repo hit counts, and the pooled candidate total', async () => {
    const d = mkdirWith(['safla.rvf', 'daa.rvf']);
    vi.mocked(searchKb).mockImplementation(async ({ name }) =>
      name === 'safla' ? [hit(), hit()] : [hit()]); // safla:2, daa:1
    const out = await searchAll({ dir: d, query: 'general question about vectors' });
    expect(out.repos).toEqual(['daa', 'safla']);
    expect(out.perRepo).toEqual({ safla: 2, daa: 1 });
    expect(out.pooled).toBe(3);
    expect(Array.isArray(out.results)).toBe(true);
  });

  it('labels every returned passage with the repo it came from', async () => {
    const d = mkdirWith(['safla.rvf', 'daa.rvf']);
    vi.mocked(searchKb).mockResolvedValue([hit()]);
    const out = await searchAll({ dir: d, query: 'general question' });
    for (const r of out.results) expect(['safla', 'daa']).toContain(r.repo);
  });

  it('honors k — never returns more than k results', async () => {
    const d = mkdirWith(['a.rvf', 'b.rvf', 'c.rvf']);
    vi.mocked(searchKb).mockResolvedValue([hit(), hit()]);
    const out = await searchAll({ dir: d, query: 'q', k: 2 });
    expect(out.results.length).toBeLessThanOrEqual(2);
  });

  it('boosts the repo the question NAMES so it outranks a higher-reranked sibling', async () => {
    const d = mkdirWith(['safla.rvf', 'daa.rvf']);
    vi.mocked(searchKb).mockImplementation(async ({ name }) => [hit({ repo: name })]);
    // Default rerank puts daa (1.0) above safla (0.5); naming "safla" adds +2.0 → safla wins.
    const out = await searchAll({ dir: d, query: 'what can safla do for me' });
    expect(out.results[0].repo).toBe('safla');
    expect(out.results[0].nameBoosted).toBe(true);
  });

  it('boosts a 3-char store name (rvm) — the old >=4 floor silently exempted rvm/daa', async () => {
    // Regression guard for the n-19 misroute: "Can RVM partition hardware…" names the rvm store,
    // but the boost's old length floor (>=4) never fired for it, so ruvector's vendored crates/rvm/
    // copy outranked rvm's own userguide. Word-boundary matching keeps 3-char names safe.
    const d = mkdirWith(['rvm.rvf', 'daa.rvf', 'ruvector.rvf']);
    vi.mocked(searchKb).mockImplementation(async ({ name }) => [hit({ repo: name })]);
    // Default rerank gives every repo 0.5 except daa (1.0); naming "RVM" adds +2.0 → rvm wins.
    const out = await searchAll({ dir: d, query: 'Can RVM partition hardware into isolated guests?' });
    expect(out.results[0].repo).toBe('rvm');
    expect(out.results[0].nameBoosted).toBe(true);
  });

  it('does NOT fire a 3-char name boost on a substring (word boundary still required)', async () => {
    const d = mkdirWith(['rvm.rvf', 'daa.rvf']);
    vi.mocked(searchKb).mockImplementation(async ({ name }) => [hit({ repo: name })]);
    // "rvms" / "daap" contain the store names only as substrings — no boost, daa's 1.0 stays on top.
    const out = await searchAll({ dir: d, query: 'how do rvms and daap servers work' });
    expect(out.results[0].repo).toBe('daa'); // won by rerank score, not by boost
    expect(out.results.every((r) => !r.nameBoosted)).toBe(true);
  });

  it('does NOT boost when the query names no repo (sibling ranking preserved)', async () => {
    const d = mkdirWith(['safla.rvf', 'daa.rvf']);
    vi.mocked(searchKb).mockResolvedValue([hit()]);
    const out = await searchAll({ dir: d, query: 'how are embeddings stored on disk' });
    expect(out.results[0].repo).toBe('daa'); // daa's 1.0 stays on top
    expect(out.results.every((r) => !r.nameBoosted)).toBe(true);
  });

  it('restricts the search to an explicit repos list', async () => {
    const d = mkdirWith(['safla.rvf', 'daa.rvf', 'qudag.rvf']);
    vi.mocked(searchKb).mockResolvedValue([hit()]);
    const out = await searchAll({ dir: d, query: 'q', repos: ['daa'] });
    expect(out.repos).toEqual(['daa']);
    expect(vi.mocked(searchKb).mock.calls.every(([a]) => a.name === 'daa')).toBe(true);
  });

  it('is resilient: a repo whose retrieval THROWS is recorded as an error, not a crash', async () => {
    const d = mkdirWith(['safla.rvf', 'daa.rvf']);
    vi.mocked(searchKb).mockImplementation(async ({ name }) => {
      if (name === 'daa') throw new Error('boom');
      return [hit()];
    });
    const out = await searchAll({ dir: d, query: 'q' });
    expect(out.perRepo.safla).toBe(1);
    expect(String(out.perRepo.daa)).toMatch(/^ERR:/);
  });

  it('preserves per-repo attribution when repos resolve OUT OF ORDER (Promise.all fan-out)', async () => {
    // Regression guard for the serial-loop -> Promise.all migration: each map callback must close
    // over its OWN `name`, not a shared/mutated loop variable. Forces alpha to resolve LAST (a delay)
    // while beta resolves immediately, so a broken closure would mislabel one repo's hits as the other's.
    const d = mkdirWith(['alpha.rvf', 'beta.rvf']);
    vi.mocked(searchKb).mockImplementation(async ({ name }) => {
      if (name === 'alpha') await new Promise((r) => setTimeout(r, 20));
      return [hit({ path: `${name}/doc.md` })];
    });
    const out = await searchAll({ dir: d, query: 'q' });
    const repoOf = Object.fromEntries(out.results.map((r) => [r.path, r.repo]));
    expect(repoOf['alpha/doc.md']).toBe('alpha');
    expect(repoOf['beta/doc.md']).toBe('beta');
    expect(out.perRepo).toEqual({ alpha: 1, beta: 1 });
  });

  it('gives the shared concepts store a deeper retrieval pool than a single repo', async () => {
    const d = mkdirWith(['concepts.rvf', 'safla.rvf']);
    vi.mocked(searchKb).mockResolvedValue([hit()]);
    await searchAll({ dir: d, query: 'q', pool: 8 });
    const conceptsCall = vi.mocked(searchKb).mock.calls.find(([a]) => a.name === 'concepts');
    const saflaCall = vi.mocked(searchKb).mock.calls.find(([a]) => a.name === 'safla');
    expect(conceptsCall[0].k).toBeGreaterThanOrEqual(24);
    expect(saflaCall[0].k).toBe(8);
  });

  it('accepts a strong card-routed source search without touching unrelated stores', async () => {
    const d = mkdirWith(['concepts.rvf', 'rulake.rvf', 'ruflo.rvf', 'ruvector.rvf']);
    fs.writeFileSync(path.join(d, 'capability-cards.md'), [
      '## ruvector',
      'Single-file RVF vector search with HNSW and TypeScript SDK backends.',
      '## ruflo',
      'Agent orchestration and project memory.',
      '## rulake',
      'Witness-verified vector read cache.',
    ].join('\n'));
    // This query asks what the SDK exposes, so recovery's implementation-proof boundary requires
    // source-bearing evidence before the router may accept the scoped result.
    vi.mocked(searchKb).mockImplementation(async ({ name }) => [hit({
      path: `${name}/source.ts`,
      fullText: 'export class RvfDatabase {}',
    })]);
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) =>
      cands.map((candidate) => ({ ...candidate, ceScore: 7.5 })));

    const out = await searchAll({
      dir: d,
      query: 'What does the @ruvector/rvf TypeScript SDK expose and how is its backend resolved at runtime?',
    });
    expect(out.repos).toEqual(['ruvector']);
    expect(out.routing).toMatchObject({ attempted: true, accepted: true, confidence: 'named' });
    expect(new Set(vi.mocked(searchKb).mock.calls.map(([args]) => args.name)))
      .toEqual(new Set(['ruvector']));
  });

  it('falls back to the full corpus when the scoped stage has only thin evidence', async () => {
    const d = mkdirWith(['concepts.rvf', 'rulake.rvf', 'ruflo.rvf', 'ruvector.rvf']);
    fs.writeFileSync(path.join(d, 'capability-cards.md'), [
      '## ruvector',
      'Single-file RVF vector search with HNSW and TypeScript SDK backends.',
      '## ruflo',
      'Agent orchestration and project memory.',
      '## rulake',
      'Witness-verified vector read cache.',
    ].join('\n'));
    vi.mocked(searchKb).mockImplementation(async ({ name }) => [hit({ path: `${name}/source.md` })]);
    let reranks = 0;
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) => {
      reranks++;
      return cands.map((candidate) => ({ ...candidate, ceScore: reranks === 1 ? 1.0 : 7.0 }));
    });

    const out = await searchAll({
      dir: d,
      query: 'What does the @ruvector/rvf TypeScript SDK expose and how is its backend resolved at runtime?',
    });
    expect(out.repos).toEqual(['concepts', 'ruflo', 'rulake', 'ruvector']);
    expect(out.routing).toMatchObject({ attempted: true, accepted: false, fallback: 'full-corpus' });
    expect(reranks).toBe(2);
  });

  it('lexically rescues an exact scoped-package source that dense retrieval buried', async () => {
    const d = mkdirWith(['ruvector.rvf']);
    fs.writeFileSync(path.join(d, 'ruvector.big.passages.jsonl'), [
      JSON.stringify({
        id: 'decoy',
        path: 'docs/general.md',
        title: 'General vectors',
        text: 'General discussion of vector storage.',
      }),
      JSON.stringify({
        id: 'sdk',
        path: 'npm/packages/rvf/src/index.ts',
        title: '@ruvector/rvf',
        text: 'The @ruvector/rvf TypeScript SDK exports class RvfDatabase. Runtime backend resolution selects native N-API, WASM, or fallback.',
      }),
    ].join('\n'));
    vi.mocked(searchKb).mockResolvedValue([hit({ path: 'docs/general.md', title: 'General vectors' })]);
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) =>
      cands
        .map((candidate) => ({
          ...candidate,
          ceScore: candidate.fullText.includes('RvfDatabase') ? 9 : 0,
        }))
        .sort((a, b) => b.ceScore - a.ceScore));

    const out = await searchAll({
      dir: d,
      repos: ['ruvector'],
      query: 'What does the @ruvector/rvf TypeScript SDK expose and how is its backend resolved at runtime?',
    });
    expect(out.results[0]).toMatchObject({
      repo: 'ruvector',
      path: 'npm/packages/rvf/src/index.ts',
      title: '@ruvector/rvf',
      _lane: 'rescue',
    });
  });

  it('lexically rescues a named monorepo inventory survey and executable install guide', async () => {
    const d = mkdirWith(['ruvector.rvf']);
    fs.writeFileSync(path.join(d, 'ruvector.passages.jsonl'), [
      JSON.stringify({
        id: 'decoy',
        path: 'crates/ruvector-core/fuzz/Cargo.toml',
        title: 'ruvector-core-fuzz',
        text: 'Rust crate manifest for an isolated fuzz workspace.',
      }),
      JSON.stringify({
        id: 'survey',
        path: 'docs/sdk/01-survey.md',
        title: 'What ruvector Ships Today',
        text: 'The crates directory contains about 110 directories. The Cargo workspace has 96 active members. npm packages include ruvector and @ruvector/core; core Rust crates include ruvector-core.',
      }),
      JSON.stringify({
        id: 'install',
        path: 'docs/guides/INSTALLATION.md',
        title: 'Installation Guide',
        text: 'Install the npm package with npm install ruvector. Add the Rust crate with cargo add ruvector-core. These are the workspace installation surfaces.',
      }),
    ].join('\n'));
    vi.mocked(searchKb).mockResolvedValue([hit({
      path: 'crates/ruvector-core/fuzz/Cargo.toml',
      title: 'ruvector-core-fuzz',
      fullText: 'Rust crate manifest for an isolated fuzz workspace.',
    })]);
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) =>
      cands
        .map((candidate) => ({
          ...candidate,
          ceScore: candidate.path === 'docs/sdk/01-survey.md'
            ? 5
            : candidate.path === 'docs/guides/INSTALLATION.md' ? 4 : 8,
        }))
        .sort((a, b) => b.ceScore - a.ceScore));

    const out = await searchAll({
      dir: d,
      repos: ['ruvector'],
      query: "What are RuVector's npm package and core crate names, and roughly how large is the Rust workspace?",
    });
    expect(out.results[0]).toMatchObject({
      repo: 'ruvector',
      path: 'docs/sdk/01-survey.md',
      _lane: 'rescue',
      inventoryBoosted: true,
    });
  });

  it('rescues a document that contains both quoted numeric performance claims', async () => {
    const d = mkdirWith(['agentdb.rvf']);
    fs.writeFileSync(path.join(d, 'agentdb.passages.jsonl'), [
      JSON.stringify({ id: 'decoy', path: 'docs/perf.md', title: 'Performance', text: 'General benchmark discussion.' }),
      JSON.stringify({
        id: 'readme',
        path: 'README.md',
        title: 'AgentDB',
        text: '150× faster than SQLite. Up to +36% search quality from feedback. Run the benchmark harness.',
      }),
    ].join('\n'));
    vi.mocked(searchKb).mockResolvedValue([hit({ path: 'docs/perf.md', fullText: 'General benchmark discussion.' })]);
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) =>
      cands.map((candidate) => ({ ...candidate, ceScore: candidate.path === 'README.md' ? 9 : 1 }))
        .sort((a, b) => b.ceScore - a.ceScore));
    const out = await searchAll({
      dir: d,
      repos: ['agentdb'],
      query: "How does AgentDB validate '150x faster than SQLite' and '+36% search quality from feedback'?",
    });
    expect(out.results[0]).toMatchObject({ path: 'README.md', _lane: 'rescue' });
  });

  it('rescues the exact ADR instead of a different ADR that merely cites it', async () => {
    const d = mkdirWith(['ruvector.rvf']);
    fs.writeFileSync(path.join(d, 'ruvector.passages.jsonl'), [
      JSON.stringify({ id: 'wrong', path: 'docs/adr/ADR-038.md', title: 'ADR-038: Witnesses', text: 'Related: ADR-029.' }),
      JSON.stringify({
        id: 'right',
        path: 'docs/adr/ADR-029-rvf-canonical-format.md',
        title: 'ADR-029: RVF as Canonical Binary Format',
        text: 'RVF is the canonical binary format. Supersedes ADR-001 and ADR-018.',
      }),
    ].join('\n'));
    vi.mocked(searchKb).mockResolvedValue([hit({ path: 'docs/adr/ADR-038.md', title: 'ADR-038: Witnesses' })]);
    vi.mocked(rerankPairs).mockImplementation(async (_q, cands) =>
      cands.map((candidate) => ({
        ...candidate,
        ceScore: candidate.path.includes('ADR-029-rvf') ? 9 : 3,
      })).sort((a, b) => b.ceScore - a.ceScore));
    const out = await searchAll({
      dir: d,
      repos: ['ruvector'],
      query: 'What does ADR-029 decide about RVF canonical format, and what does it supersede?',
    });
    expect(out.results[0]).toMatchObject({
      path: 'docs/adr/ADR-029-rvf-canonical-format.md',
      _lane: 'rescue',
    });
  });
});
