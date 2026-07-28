// tests/unit/grounding-receipt-lanes.test.mjs — EVERY lane that answers must mint a receipt.
//
// TWO DEFECTS, BOTH LIVE ON MAIN ON 2026-07-27, BOTH SILENT, BOTH FOUND THE SAME HOUR:
//
//  1. SHADOWING. `kb/forge-mcp-all.mjs` imported the substance writer into a module-level binding
//     called `evidence`. Later, inside the request handler, `searchAll()`'s return value — which has
//     an unrelated member ALSO called `evidence` (a plain {grade, topScore, caveat} object) — was
//     destructured into the same block. From that moment `evidence.recordAnswer(...)` resolved to
//     the plain object, threw TypeError, and was swallowed by the `catch { /* never */ }` that
//     exists so evidence capture can never break a query. The substance writer was DEAD ON EVERY
//     PATH; the ledger silently stopped growing; every test and every gate stayed green.
//
//  2. THE RACE THE SPEED CREATED. Once fixed, the card lane STILL minted nothing — measured live.
//     The writer is loaded with a lazy `import()` that assigns a mutable on a later tick, and the
//     card lane answers in ~0.02ms p50. It beat the import and read `null`. The heavy path never
//     showed this: 19.6s is an eternity next to a module load. Making the lane fast reintroduced a
//     latent race that had been hidden by slowness — the receipt vanished for exactly the question
//     class (does rUv already ship X?) the founding esm.sh incident came from.
//
// What both have in common is the thing this file tests: a capability that quietly does nothing
// looks EXACTLY like a capability that is working. So these assertions bind to the mechanism —
// no shadowing, and an awaited promise rather than a hopeful mutable read — not to the outcome
// on one lucky run.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { recordAnswer, evidenceFile } from '../../kb/forge-evidence.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const SERVER = path.join(REPO, 'kb/forge-mcp-all.mjs');
const src = () => fs.readFileSync(SERVER, 'utf8');

/** Brace-depth scope walk — the same check that found defect 1. */
function shadowReport(source, importedName) {
  const lines = source.split('\n');
  let depth = 0;
  let declDepth = null;
  const shadows = [];
  const uses = [];
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].replace(/'[^']*'|"[^"]*"|`[^`]*`|\/\/.*$/g, '');
    if (new RegExp(`^\\s*(let|const|var)\\s+${importedName}\\b`).test(code)) declDepth ??= depth;
    if (declDepth !== null && depth > declDepth
        && new RegExp(`(const|let|var)\\s*\\{[^}]*\\b${importedName}\\b[^}]*\\}`).test(code)) {
      shadows.push({ line: i + 1, depth });
    }
    if (new RegExp(`\\b${importedName}\\.recordAnswer`).test(code)) uses.push({ line: i + 1, depth });
    for (const c of code) { if (c === '{') depth++; else if (c === '}') depth--; }
  }
  return { declDepth, shadows, uses };
}

describe('defect 1 — the substance writer must not be shadowable', () => {
  it('the binding holding the forge-evidence module is never re-declared in an inner scope', () => {
    const rep = shadowReport(src(), 'evidenceWriter');
    expect(rep.declDepth, 'no module-level binding for the evidence writer was found').not.toBeNull();
    expect(
      rep.shadows,
      `the evidence writer binding is shadowed at line(s) ${rep.shadows.map((s) => s.line).join(', ')} — `
        + 'this is defect 1 verbatim: the call site would resolve to a different object and throw into a silent catch',
    ).toEqual([]);
  });

  it('KNOWN-BAD: the old name IS shadowed — proving the checker can fail, not just pass', () => {
    // The guard above only means something if it goes red on the real historical code. This
    // reproduces it: bind the module to `evidence`, then destructure searchAll's `evidence` into an
    // inner block, exactly as main did. A checker that cannot fail is not a checker.
    const broken = `
let evidence = null;
import('./forge-evidence.mjs').then((m) => { evidence = m; });
async function handler() {
  {
    {
      {
        const { results, repos, evidence } = await searchAll({});
        let receipt = null;
        try { if (evidence) receipt = evidence.recordAnswer({ query, repos, results }); } catch {}
      }
    }
  }
}`;
    const rep = shadowReport(broken, 'evidence');
    expect(rep.shadows.length, 'the historical shadowing must be detected').toBeGreaterThan(0);
    expect(rep.uses.length).toBeGreaterThan(0);
    // and the use sits at or below the shadow's depth — i.e. the shadow wins at the call site
    expect(rep.uses[0].depth).toBeGreaterThanOrEqual(rep.shadows[0].depth);
  });
});

describe('defect 2 — no lane may read a lazily-imported writer without awaiting it', () => {
  it('every recordAnswer call site awaits the import promise', () => {
    const live = src().split('\n').filter((l) => !l.trim().startsWith('//'));
    const callSites = live.filter((l) => /\.recordAnswer\s*\(/.test(l));
    expect(callSites.length, 'no recordAnswer call sites found — the writer is not wired at all').toBeGreaterThan(0);

    // Each call must be reached through a value obtained by awaiting the import, never by reading
    // the mutable the .then() eventually assigns. On the fast lane those are different answers.
    const text = live.join('\n');
    const awaits = (text.match(/await\s+evidenceReady/g) || []).length;
    expect(
      awaits,
      `${callSites.length} recordAnswer call site(s) but only ${awaits} \`await evidenceReady\` — `
        + 'a lane that reads the mutable directly loses the race whenever it answers faster than a module load',
    ).toBeGreaterThanOrEqual(callSites.length);
  });

  it('BOTH lanes are wired — the fast lane is not exempt because it is fast', () => {
    const text = src();
    // the card lane's early return must sit AFTER a recordAnswer call, not before every one of them
    const cardReturn = text.indexOf('cardLane: true');
    const firstRecord = text.indexOf('.recordAnswer(');
    expect(cardReturn, 'card lane not found').toBeGreaterThan(-1);
    expect(
      firstRecord < cardReturn,
      'the card lane returns before any receipt is minted — this is the exact regression the fast '
        + 'lane introduced when it became the first responder',
    ).toBe(true);
  });
});

describe('the writer itself still writes — the guard above is about wiring, not about this', () => {
  it('a card-shaped result carrying real facts appends exactly one ledger line', () => {
    const f = evidenceFile();
    const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').length : 0;
    const r = recordAnswer({
      query: 'receipt-lane test',
      repos: ['synaptic-mesh'],
      results: [{
        repo: 'synaptic-mesh',
        path: 'capability-cards.md#synaptic-mesh',
        text: 'npm install synaptic-mesh — runs fully local, no backend required.\nimport { Mesh } from "synaptic-mesh";',
        score: 0.4,
      }],
    });
    const after = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').length : 0;
    expect(r?.receiptId, 'a successful answer must produce a receipt id').toBeTruthy();
    expect(r.sources.length).toBeGreaterThan(0);
    expect(after, 'exactly one line appended').toBe(before + 1);
  });

  it('a factless source mints a receipt but writes NO ledger line — extraction is deterministic', () => {
    // Not a bug, and worth pinning so nobody "fixes" it: the ledger holds FACTS (install commands,
    // packages, symbols, verbatim posture), never prose. A card with none contributes none. This is
    // why the live card-lane run showed a receipt on the wire and an unchanged ledger.
    const f = evidenceFile();
    const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').length : 0;
    recordAnswer({
      query: 'factless',
      repos: ['x'],
      results: [{ repo: 'x', path: 'a/b.md', text: 'This document discusses ideas in general terms.', score: 0.1 }],
    });
    const after = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').length : 0;
    expect(after).toBe(before);
  });
});
