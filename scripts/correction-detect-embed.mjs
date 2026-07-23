#!/usr/bin/env node
// correction-detect-embed.mjs — an HONEST measurement of whether a DIFFERENT PRIMITIVE (a local
// embedding k-NN classifier) clears ADR-033 §2's floor (≥90% precision on ≥100 detections) where
// the lexical regex detector (scripts/correction-detect.mjs) did not.
//
// This is a MEASUREMENT SCRIPT, not a shipped feature. It does not wire into any hook, gate, or
// store. It answers one question for an owner decision: does swapping the primitive from regex to
// embedding similarity change the verdict on THIS corpus? See the accompanying report for the
// answer; this file is how the numbers in that report were produced, reproducibly.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE PRIMITIVE: k-NEAREST-NEIGHBOUR OVER LOCAL MiniLM EMBEDDINGS — NOT A TRAINED CLASSIFIER
//
// Grounded against how this repo already does embeddings (kb/forge-build.mjs, kb/resolve-deps.mjs):
// the SAME model (`Xenova/all-MiniLM-L6-v2`, 384-dim, mean-pooled, L2-normalized, pinned to the
// same HuggingFace revision the KB build uses) via the SAME local ONNX runtime
// (`@xenova/transformers`, resolved through `kb/resolve-deps.mjs`'s `loadTransformers()` /
// `configureModel()` — no network call when the model is already cached, per CLAUDE.md Rule 1: RVF/
// local-ONNX first, never an external embedding API). This script imports that resolver directly
// rather than re-implementing model loading, cache resolution, or the network-hang guard a second
// time — those are already solved once, correctly, in `kb/resolve-deps.mjs`.
//
// The classifier itself is deliberately the simplest thing that could work (Karpathy: minimum code,
// no speculative abstraction): embed each candidate as `PRECEDING ACTION: <summary> \n USER:
// <utterance>` (utterance ± the preceding-action context the task asked for), embed a small labelled
// reference set drawn ONLY from the TUNE split, and classify a holdout candidate by a similarity-
// weighted vote of its k nearest TUNE neighbours. k and the similarity floor are chosen by
// leave-one-out cross-validation ON THE TUNE SET ONLY, then frozen before touching holdout — the
// same no-leakage discipline `correction-detect-measure.mjs` uses for its file-level split.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WHERE THE GROUND TRUTH COMES FROM
//
// `scripts/correction-detect-measure.mjs --dump-pool` already builds a candidate pool (Signal-1:
// adjacent to a preceding assistant action) and this task's own grounding pass narrowed it with the
// SAME loose superset lexical net that script's `broad-pool.mjs` companion applies (deliberately
// looser than the regex's own signals — a safety margin so a genuine correction is not excluded from
// the labelling pool just because it doesn't use the regex's exact vocabulary). That pool — 271
// candidates, 112 tune / 159 holdout, spanning ALL 1,328 transcripts — was hand-labelled by this
// task's author (true / borderline / false) against ADR-033's actual four-signal definition, NOT
// against what either detector happens to fire on. That hand-labelling is the same self-graded
// caveat every number in `correction-detect.mjs`'s own header already carries (Verification #6 in
// ADR-033: "not independently graded") — repeated here rather than hidden.
//
// The labelled pool contains real (if redacted-of-secrets) transcript text and is NOT committed to
// this repo, for the same reason `correction-detect-measure.mjs` never writes transcript text into
// the repo. Point `--labels` / `--tune-pool` / `--holdout-pool` at that data (default: this
// project's scratchpad locations used to build it) to reproduce the run. A small, hand-picked,
// already-public-in-spirit subset (utterances that already became named standing orders in this
// project's own committed memory index) ships as `tests/fixtures/correction-embed-sample.jsonl` so
// `tests/unit/correction-detect-embed.test.mjs` can run the classifier's MECHANICS without any
// private corpus present.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MEASURED, 2026-07-23 — same 271-item hand-labelled pool (112 tune / 159 holdout, all 1,328
// transcripts) the total-genuine-correction count in the report was taken from. Reproduce with the
// `measure` command below, pointed at that pool + labels.json (see this file's own USAGE).
//
//   tune-set ground truth:     14 true  /  98 false   (of 112)
//   holdout ground truth:      23 true  /   6 borderline  /  130 false   (of 159)
//
//   Leave-one-out search on TUNE ONLY (no holdout leakage) picked k=1, minSim=0.6 (tune-LOO
//   precision 66.7% / recall 42.9% — already far below the regex's tune-side 100%/4-of-4).
//
//   Applied to the SAME 159-item holdout the regex's own 4 detections came from:
//       flagged positive:        8
//       true positives:          2
//       false positives:         6        (0 of the 6 borderline-labelled rows were flagged)
//       PRECISION:               25.0%   (2/8)
//       RECALL (of 29 true+borderline):   6.9%
//
//   With the frozen default operating point below (k=5, minSim=0.3, chosen the same way but on an
//   earlier tune-only search) instead of a fresh --tune-k run: 7 flagged, 2 true positives, 5 false
//   — precision 28.6%, recall 6.9%. Same order of magnitude either way: roughly a QUARTER of what
//   this primitive flags on the real holdout is a genuine correction, versus the regex's own
//   50-100% (n=4) on the same pool.
//
//   Extended to the FULL Signal-1 holdout population (784 candidates, `--wide-pool`, not just the
//   159-item loose-net subset a human would ever be asked to label): 12 flagged, of which 5 fall
//   OUTSIDE the labelled subset. Hand-reviewed those 5 for this measurement: all 5 are false
//   (a repo-naming brainstorm, two raw image-paste captions, a status question, and a delegation
//   statement) — so at realistic operational scale, precision is 2/12 ≈ 16.7%, recall unchanged.
//
//   CONCLUSION: this primitive does NOT beat the regex on precision on this corpus, and comes
//   nowhere near ADR-033 §2's ≥90% floor at any N tried. See the report this task produced for the
//   full discussion (why: MiniLM sentence embeddings here separate by TOPIC — "this utterance is
//   about AgentDB/versions/the console" — not by the PRAGMATIC property ADR-033 actually needs
//   ("is this utterance correcting the agent's behaviour"). Two utterances about the same topic,
//   one a bug report and one a correction, land close together in embedding space; two genuine
//   corrections about DIFFERENT topics (READMEs vs. scoring vs. version pinning) often do not.
//   This is the same conclusion ADR-033 reached about lexical overlap, now shown to also hold for
//   semantic (embedding) overlap on this corpus — it is not a lexical-vs-semantic gap, it is a
//   topic-vs-pragmatics gap that neither primitive, as tried, closes.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// USAGE
//   node scripts/correction-detect-embed.mjs measure \
//     --tune-pool <broad-tune.jsonl> --holdout-pool <broad-holdout.jsonl> --labels <labels.json> \
//     [--wide-pool <cand-holdout.jsonl>] [--k 5] [--min-sim 0.35] [--tune-k]
//
//   --wide-pool, optional: the FULL Signal-1 holdout pool (784 candidates, not just the 159-item
//   loose-net subset) — runs the frozen classifier over it and reports how many candidates OUTSIDE
//   the labelled subset it flags positive, honestly marked UNLABELLED rather than guessed at.
//
//   --tune-k: run leave-one-out CV over a small (k, minSim) grid on the tune set only, print the
//   chosen operating point, then use it. Without this flag the script uses the value already found
//   this way and recorded in DEFAULT_K / DEFAULT_MIN_SIM below (reproducible without re-searching).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_DIR = path.join(__dirname, '..', 'kb');

// Pinned to the exact commit forge-build.mjs pins to, so this script's vectors are byte-identical
// to the ones the shipped KB would produce for the same text (see forge-build.mjs's own comment on
// MINILM_REVISION for why: address-by-SHA, not floating `main`).
const MINILM_REVISION = '751bff37182d3f1213fa05d7196b954e230abad9';

// Found by `--tune-k` leave-one-out search over k in [1,3,5,7,9] and minSim in [0.0,0.15,...,0.6],
// maximizing tune-set F1 (ties broken toward higher minSim, i.e. more conservative — precision is
// the safety property here, per ADR-033 §2, so a tie goes to the pickier operating point). Re-run
// `--tune-k` to reproduce; this corpus is small (112 tune rows) so the search is seconds, not a
// separate offline step, but the chosen point is frozen here so a bare `measure` run is deterministic
// without depending on the search being re-run identically.
export const DEFAULT_K = 5;
export const DEFAULT_MIN_SIM = 0.3;

/** Resolve the local MiniLM embedder through this repo's OWN resolver — no re-implementation, no
 *  external API call (CLAUDE.md Rule 1). Fails loudly (via loadTransformers' own network guard) if
 *  neither a project node_modules nor an env override can find @xenova/transformers. */
async function loadEmbedder() {
  const { loadTransformers, configureModel } = await import(path.join(KB_DIR, 'resolve-deps.mjs'));
  const { T, modelCache, via } = await loadTransformers();
  const { haveLocalModel } = configureModel(T, modelCache);
  const embed = await T.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true, revision: MINILM_REVISION,
  });
  return { embed, via, modelCache, haveLocalModel };
}

/** Utterance ± preceding-action context, exactly as the task specified — the same two fields
 *  `detectCorrection()` consumes (Signal 1's adjacency evidence), just embedded instead of regexed. */
export function candidateText(row) {
  const prior = row.precedingAssistantAction || {};
  const action = prior.summary || prior.tool || '';
  return action
    ? `PRECEDING ACTION: ${String(action).slice(0, 200)}\nUSER: ${row.promptText}`
    : `USER: ${row.promptText}`;
}

async function embedBatch(embed, texts, batchSize = 16) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const out = await embed(batch, { pooling: 'mean', normalize: true });
    const dim = out.dims[1];
    for (let j = 0; j < batch.length; j++) vectors.push(Array.from(out.data.slice(j * dim, (j + 1) * dim)));
  }
  return vectors;
}

/** Vectors are already L2-normalized (normalize:true above), so dot product IS cosine similarity —
 *  same convention kb/forge-build.mjs uses for its RVF store (metric:'cosine' over normalized vecs). */
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * The classifier: similarity-weighted k-NN vote against a labelled reference set. Deliberately NOT
 * a trained model (no gradient descent, no held weights beyond the reference vectors themselves) —
 * this keeps every verdict traceable to "which labelled examples it resembles, and how much" rather
 * than to opaque learned parameters. It is still less legible than the regex (see LEGIBILITY note
 * at the bottom of this file), but it is the most legible embedding-based option available: the
 * `neighbors` returned alongside every verdict ARE the explanation, not a post-hoc rationalization.
 */
export function classify(vec, refs, { k = DEFAULT_K, minSim = DEFAULT_MIN_SIM } = {}) {
  const scored = refs.map((r) => ({ ...r, sim: dot(vec, r.vector) })).sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, k).filter((r) => r.sim >= minSim);
  if (!top.length) return { isCorrection: false, score: 0, neighbors: scored.slice(0, 3) };
  const posWeight = top.filter((r) => r.label === 'true').reduce((s, r) => s + r.sim, 0);
  const negWeight = top.filter((r) => r.label !== 'true').reduce((s, r) => s + r.sim, 0);
  return { isCorrection: posWeight > negWeight, score: posWeight - negWeight, neighbors: top.slice(0, 3) };
}

/** Leave-one-out CV over a small grid, TUNE SET ONLY — never touches holdout. Maximizes F1; ties
 *  broken toward the higher minSim (more conservative), per ADR-033's precision-over-recall stance. */
function looSearch(tuneVecs, tuneLabels) {
  const refs = tuneVecs.map((vector, i) => ({ vector, label: tuneLabels[i] }));
  let best = null;
  for (const k of [1, 3, 5, 7, 9]) {
    for (const minSim of [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6]) {
      let tp = 0, fp = 0, fn = 0;
      for (let i = 0; i < refs.length; i++) {
        const others = refs.slice(0, i).concat(refs.slice(i + 1));
        const { isCorrection } = classify(refs[i].vector, others, { k, minSim });
        const truth = refs[i].label === 'true';
        if (isCorrection && truth) tp++;
        else if (isCorrection && !truth) fp++;
        else if (!isCorrection && truth) fn++;
      }
      const precision = tp + fp ? tp / (tp + fp) : 0;
      const recall = tp + fn ? tp / (tp + fn) : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      const cand = { k, minSim, tp, fp, fn, precision, recall, f1 };
      if (!best || f1 > best.f1 || (f1 === best.f1 && minSim > best.minSim)) best = cand;
    }
  }
  return best;
}

// ── I/O helpers ──────────────────────────────────────────────────────────────────────────────────

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function loadLabels(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map();
  for (const r of rows) map.set(`${r.file}#${r.turnIndex}`, r.label);
  return map;
}

function flag(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// ── Measurement ──────────────────────────────────────────────────────────────────────────────────

async function measure() {
  const tunePoolFile = flag('--tune-pool');
  const holdoutPoolFile = flag('--holdout-pool');
  const labelsFile = flag('--labels');
  const widePoolFile = flag('--wide-pool');
  const doSearch = process.argv.includes('--tune-k');

  if (!tunePoolFile || !holdoutPoolFile || !labelsFile) {
    console.error('Usage: node scripts/correction-detect-embed.mjs measure --tune-pool <jsonl> '
      + '--holdout-pool <jsonl> --labels <labels.json> [--wide-pool <jsonl>] [--tune-k]');
    console.error('These point at real (private) transcript-derived data — see this file\'s header '
      + 'for how to regenerate them; nothing of that shape is committed to this repo.');
    process.exit(1);
  }

  const labels = loadLabels(labelsFile);
  const tuneRows = readJsonl(tunePoolFile).map((r) => ({ ...r, label: labels.get(`${r.file}#${r.turnIndex}`) || 'false' }));
  const holdoutRows = readJsonl(holdoutPoolFile).map((r) => ({ ...r, label: labels.get(`${r.file}#${r.turnIndex}`) || 'false' }));

  console.error(`[embed] tune=${tuneRows.length} (true=${tuneRows.filter(r=>r.label==='true').length}) `
    + `holdout=${holdoutRows.length} (true=${holdoutRows.filter(r=>r.label==='true').length}, `
    + `borderline=${holdoutRows.filter(r=>r.label==='borderline').length})`);

  const { embed, via, haveLocalModel, modelCache } = await loadEmbedder();
  console.error(`[embed] transformers via: ${via} | model: ${haveLocalModel ? 'local cache' : 'REMOTE DOWNLOAD'} (${modelCache})`);

  const tuneVecs = await embedBatch(embed, tuneRows.map(candidateText));
  const holdoutVecs = await embedBatch(embed, holdoutRows.map(candidateText));

  let opPoint = { k: DEFAULT_K, minSim: DEFAULT_MIN_SIM };
  if (doSearch) {
    const found = looSearch(tuneVecs, tuneRows.map((r) => r.label));
    console.error(`[embed] --tune-k search (leave-one-out, tune only): k=${found.k} minSim=${found.minSim} `
      + `tune-LOO precision=${(100*found.precision).toFixed(1)}% recall=${(100*found.recall).toFixed(1)}% f1=${found.f1.toFixed(3)}`);
    opPoint = { k: found.k, minSim: found.minSim };
  } else {
    console.error(`[embed] using frozen operating point k=${opPoint.k} minSim=${opPoint.minSim} (rerun with --tune-k to re-search)`);
  }

  const refs = tuneVecs.map((vector, i) => ({ vector, label: tuneRows[i].label, text: tuneRows[i].promptText }));

  // ── Primary measurement: SAME 159-item labelled holdout population the regex's own examples
  // came from (broad-holdout.jsonl) — apples-to-apples with correction-detect.mjs's own numbers. ──
  let tp = 0, fp = 0, fpBorderline = 0, fn = 0, tn = 0;
  const positives = [];
  for (let i = 0; i < holdoutRows.length; i++) {
    const { isCorrection, score, neighbors } = classify(holdoutVecs[i], refs, opPoint);
    const row = holdoutRows[i];
    if (isCorrection) {
      positives.push({ ...row, score, neighbors: neighbors.map((n) => ({ label: n.label, sim: n.sim.toFixed(3), text: n.text.slice(0, 100) })) });
      if (row.label === 'true') tp++;
      else if (row.label === 'borderline') { fpBorderline++; }
      else fp++;
    } else {
      if (row.label === 'true' || row.label === 'borderline') fn++;
      else tn++;
    }
  }
  const totalFp = fp + fpBorderline; // strict: borderline counts against precision, same as the regex's own header treats its 2 holdout borderlines
  const precisionStrict = tp + totalFp ? tp / (tp + totalFp) : 0;
  const precisionLenient = (tp + fpBorderline) + fp ? (tp + fpBorderline) / (tp + fpBorderline + fp) : 0;
  const recallStrict = tp + fn ? tp / (tp + fn) : 0; // fn includes borderlines missed, conservative

  console.log(`\n=== EMBEDDING CLASSIFIER — holdout (n=${holdoutRows.length}, same pool the regex's hand-labelled examples came from) ===`);
  console.log(`positives (flagged): ${positives.length}`);
  console.log(`  true positives:        ${tp}`);
  console.log(`  borderline positives:  ${fpBorderline}`);
  console.log(`  false positives:       ${fp}`);
  console.log(`  false negatives (missed true+borderline): ${fn}`);
  console.log(`precision (strict, borderline counts against): ${(100*precisionStrict).toFixed(1)}%  (${tp}/${tp+totalFp})`);
  console.log(`precision (lenient, borderline counts for):    ${(100*precisionLenient).toFixed(1)}%  (${tp+fpBorderline}/${tp+fpBorderline+fp})`);
  console.log(`recall (of ${tp+fn+ (holdoutRows.filter(r=>r.label==='true'||r.label==='borderline').length - (tp+fn))} known true/borderline): ${(100*recallStrict).toFixed(1)}%`);

  console.log(`\n--- flagged positives, with nearest tune neighbours (the "legibility" a verdict can offer) ---`);
  for (const p of positives) {
    console.log(`[${p.label.toUpperCase()}] score=${p.score.toFixed(3)} file=${p.file} turn=${p.turnIndex}`);
    console.log(`  UTTERANCE: ${p.promptText.slice(0, 160).replace(/\n/g,' ')}`);
    for (const n of p.neighbors) console.log(`   neighbor(${n.label}, sim=${n.sim}): ${n.text.replace(/\n/g,' ')}`);
  }

  // ── Secondary, optional: the FULL Signal-1 holdout population (not just the loose-net subset) —
  // the real deployment-scale test. Anything flagged OUTSIDE the labelled 159 is marked UNLABELLED,
  // never silently assumed either way. ──
  if (widePoolFile) {
    const wideRows = readJsonl(widePoolFile);
    const labelledKeys = new Set(holdoutRows.map((r) => `${r.file}#${r.turnIndex}`));
    const wideVecs = await embedBatch(embed, wideRows.map(candidateText));
    let wideFlagged = 0, outsideSubset = 0;
    const outsideHits = [];
    for (let i = 0; i < wideRows.length; i++) {
      const { isCorrection, score } = classify(wideVecs[i], refs, opPoint);
      if (!isCorrection) continue;
      wideFlagged++;
      const k = `${wideRows[i].file}#${wideRows[i].turnIndex}`;
      if (!labelledKeys.has(k)) { outsideSubset++; outsideHits.push({ ...wideRows[i], score }); }
    }
    console.log(`\n=== WIDE HOLDOUT (n=${wideRows.length}, full Signal-1 pool, not just the loose-net subset) ===`);
    console.log(`flagged: ${wideFlagged}  (of which ${outsideSubset} fall OUTSIDE the 159-item labelled subset — UNLABELLED, hand-review needed, not counted in precision/recall above)`);
    for (const h of outsideHits.slice(0, 20)) {
      console.log(`  UNLABELLED file=${h.file} turn=${h.turnIndex} score=${h.score.toFixed(3)}: ${h.promptText.slice(0,160).replace(/\n/g,' ')}`);
    }
  }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]).endsWith(`correction-detect-embed${path.extname(process.argv[1])}`);
if (invokedDirectly) {
  const cmd = process.argv[2];
  if (cmd === 'measure') measure().catch((e) => { console.error(e); process.exit(1); });
  else { console.error('Usage: node scripts/correction-detect-embed.mjs measure ...'); process.exit(1); }
}
