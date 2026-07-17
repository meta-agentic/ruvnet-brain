#!/usr/bin/env node
// scripts/count-chunks.mjs — recount the REAL passage total across the local PUBLIC kb stores and
// restamp it onto every public surface that advertises it. Rule: no number beats a wrong number —
// the hand-typed "129,685 source chunks" rotted (SOURCE.json advertised a corpus that had moved on)
// and was pulled from every surface in v3.2.5. This script is how it comes back honestly: computed
// fresh from disk every time, never hand-typed again.
//
// Counting logic is NOT duplicated here — it imports computePublicChunkTotal from claims-verify.mjs,
// the same function tests/unit/claims-verify.test.mjs > verifyChunkCountSurfaces recounts against.
// One counter, one gate: the stamp and the check can never disagree about HOW the number is derived,
// only about whether a surface has drifted from it. Private stores (kb/PRIVATE-STORES.json) are
// excluded by that same shared function, so the public number can never include private content.
//
// Restamping is a plain regex substitution — any comma-grouped number followed within 40 chars by
// the word "chunks" is treated as an existing chunk-count claim and its number is rewritten. This is
// the exact detector claims-verify.mjs's verifyChunkCountSurfaces uses to flag drift, so anything
// this script leaves alone is, by construction, something that checker will also accept.
//
// A surface with NO existing "N chunks" claim (e.g. explainer/index.html before this was restored)
// is reported, not silently improvised into someone else's prose — the first stamp on a new surface
// is a deliberate one-time copy edit, done by hand once; after that this script keeps it fresh.
//
// Usage:  node scripts/count-chunks.mjs            # recount + write the fresh total into every surface
//         node scripts/count-chunks.mjs --check     # report only; exit 1 if any surface would change
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePublicChunkTotal, CHUNK_SURFACES } from './claims-verify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

// Mirrors verifyChunkCountSurfaces's own drift detector in claims-verify.mjs exactly.
const CLAIM = /(\d{1,3}(?:,\d{3})+)([^0-9]{0,40}?chunks)/gi;

function main() {
  const { total, stores } = computePublicChunkTotal();
  if (!total || !stores) {
    console.error('[count-chunks] no public kb stores found under kb/*.big.rvf.idmap.json — is the local brain built? Nothing to stamp.');
    process.exit(1);
  }
  const want = total.toLocaleString('en-US');
  console.log(`[count-chunks] recounted ${want} chunks across ${stores} public stores (private stores excluded per kb/PRIVATE-STORES.json)`);

  let drifted = 0;
  let missing = 0;
  for (const rel of CHUNK_SURFACES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) { console.warn(`[count-chunks] ${rel}: file missing, skipped`); continue; }
    const s = fs.readFileSync(p, 'utf8');
    let found = false;
    let touched = false;
    const next = s.replace(CLAIM, (m, num, tail) => {
      found = true;
      if (num === want) return m;
      touched = true;
      return `${want}${tail}`;
    });
    if (!found) {
      missing++;
      console.warn(`[count-chunks] ${rel}: no existing chunk-count claim to restamp — add one by hand once (e.g. "${want} source chunks"), then this script keeps it fresh`);
      continue;
    }
    if (!touched) { console.log(`[count-chunks] ${rel}: already ${want}, no change`); continue; }
    drifted++;
    if (CHECK) { console.error(`[count-chunks] DRIFT: ${rel} would restamp -> ${want}`); continue; }
    fs.writeFileSync(p, next);
    console.log(`[count-chunks] ${rel}: restamped -> ${want}`);
  }

  if (CHECK && (drifted || missing)) {
    console.error(`\n[count-chunks] --check: ${drifted} surface(s) drifted, ${missing} surface(s) missing a claim entirely`);
    process.exit(1);
  }
  console.log(`\n[count-chunks] done — ${want} chunks is now the live count on ${CHUNK_SURFACES.length - missing}/${CHUNK_SURFACES.length} surfaces.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
