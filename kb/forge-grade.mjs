#!/usr/bin/env node
// forge-grade.mjs — DUAL-METRIC ANSWER-QUALITY harness for an rvf-kb-forge knowledge base.
//
// This grades ANSWER QUALITY, not retrieval relevance. The distinction is the whole point:
// a hit can be "relevant" and still produce an INCOMPLETE answer — and an incomplete-but-not-
// wrong answer is POISON (it reads as authoritative while omitting the decisive fact). So:
//
//   GRADE SCALE 1-100, where 98 = a PERFECT answer (complete, correct, comprehensive,
//   intelligent, fully actionable — nothing material missing). An incomplete-but-not-wrong
//   answer is POISON = HARD FAIL (<50). PASS = avg >= 98 AND zero answers < 95.
//
// Two metrics per question (because an MCP/Claude consumer uses the KB BOTH ways):
//   STRICT   — judge the #1 returned document ALONE. Can the single best hit answer it fully?
//   REAL-USE — judge the answer a consumer would assemble from the TOP-5 returned documents.
//              This is how Claude/Codex actually use it (read several, synthesize).
//
// The SCRIPT cannot judge semantic completeness — only an LLM can. So this tool:
//   (1) runs each question through the REAL consumer path (forge-ask searchKb) for BOTH metrics,
//   (2) emits a graded-evidence bundle (the questions + the retrieved full text) for the LLM
//       (you, Claude) to score, AND
//   (3) when you write the scores back into the questions file, RE-RUN with --check to enforce
//       the PASS rule mechanically (avg >= 98 AND min >= 95 on BOTH metrics), exit 1 if not.
//
// Anti-overfit: keep TWO question sets — `questions.json` (the 10 you tuned on) and
// `heldout.json` (10 DIFFERENT questions you did NOT look at while tuning). Grade BOTH. A KB
// that passes the tuned set but fails held-out is form-fit, not good. Run this tool on each.
//
// QUESTIONS FILE shape (JSON array). Add `strict` / `realUse` integers after you grade:
//   [ { "q": "what is X and who is it for?", "why": "comprehension archetype 1 (what is it)",
//       "strict": null, "realUse": null, "note": "" }, ... ]
//
// Usage:
//   node forge-grade.mjs --dir <d> --name <n> --questions questions.json [--variant big|small]
//   node forge-grade.mjs --dir <d> --name <n> --questions questions.json --check   # enforce PASS
//   node forge-grade.mjs --emit-archetypes > questions.json                        # seed a template

import fs from 'node:fs';
import path from 'node:path';
import { searchKb } from './forge-ask.mjs';

function arg(flag, def) { const i = process.argv.indexOf(flag); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const CHECK = process.argv.includes('--check');

// The 6 TOP-DOWN COMPREHENSION ARCHETYPES every KB must answer. A good question set covers all 6,
// twice over (10-12 questions). Use --emit-archetypes to scaffold a starting questions.json.
const ARCHETYPES = [
  '1. What is this product? (one-paragraph identity + who it is for)',
  '2. What are the concepts? (the vocabulary you must know)',
  '3. How does each concept/component work? (mechanism)',
  '4. How complete/mature is each? (honest grades — what ships vs what is proposed)',
  '5. Where is all the documentation? (ADR index, docs, tutorials — where to look)',
  '6. How exactly do I use them end-to-end? (the from-scratch playbook)',
];

if (process.argv.includes('--emit-archetypes')) {
  const tmpl = ARCHETYPES.map((a) => ({ q: `<question covering: ${a}>`, why: a, strict: null, realUse: null, note: '' }));
  // pad to 10 with two extra deep/specific questions (a named ADR, a specific subsystem)
  tmpl.push({ q: '<a specific ADR-NNN: what does it decide, and is it shipped or proposed?>', why: 'specific decision + proposal-vs-reality', strict: null, realUse: null, note: '' });
  tmpl.push({ q: '<how is <specific operation> implemented in the code (which file)?>', why: 'deep implementation lookup', strict: null, realUse: null, note: '' });
  tmpl.push({ q: '<an integration boundary: how does X talk to Y?>', why: 'cross-component', strict: null, realUse: null, note: '' });
  tmpl.push({ q: '<a config/manifest detail: which crate/package provides Z?>', why: 'manifest lookup', strict: null, realUse: null, note: '' });
  process.stdout.write(JSON.stringify(tmpl, null, 2) + '\n');
  process.exit(0);
}

const DIR = arg('--dir'), NAME = arg('--name'), QFILE = arg('--questions'), VARIANT = arg('--variant');
if (!DIR || !NAME || !QFILE) {
  console.error('Usage: forge-grade.mjs --dir <d> --name <n> --questions <file.json> [--variant big|small] [--check]');
  console.error('       forge-grade.mjs --emit-archetypes > questions.json');
  process.exit(2);
}
if (!fs.existsSync(QFILE)) { console.error(`questions file not found: ${QFILE}`); process.exit(2); }
const questions = JSON.parse(fs.readFileSync(QFILE, 'utf8'));
if (!Array.isArray(questions) || !questions.length) { console.error('questions file must be a non-empty JSON array'); process.exit(2); }

// ---- --check mode: enforce the PASS rule on already-graded questions, no retrieval needed ----
function enforce() {
  const graded = questions.filter((x) => Number.isFinite(x.strict) && Number.isFinite(x.realUse));
  if (graded.length !== questions.length) {
    console.error(`NOT all questions graded: ${graded.length}/${questions.length} have strict+realUse scores. Fill them, then --check.`);
    process.exit(1);
  }
  const stat = (key) => {
    const vals = questions.map((x) => x[key]);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const min = Math.min(...vals);
    const poison = questions.filter((x) => x[key] < 50);
    return { avg, min, poison };
  };
  const s = stat('strict'), r = stat('realUse');
  console.log(`\n=== GRADE CHECK — ${NAME} (${questions.length} questions) ===`);
  for (const m of [['STRICT (#1 doc alone)', s], ['REAL-USE (top-5 assembled)', r]]) {
    const [label, st] = m;
    console.log(`${label}: avg=${st.avg.toFixed(2)} min=${st.min} ${st.poison.length ? `POISON(<50)=${st.poison.length}` : ''}`);
  }
  // PASS rule: avg >= 98 AND min >= 95 on BOTH metrics. Any answer < 50 is poison = automatic fail.
  const passMetric = (st) => st.avg >= 98 && st.min >= 95 && st.poison.length === 0;
  const pass = passMetric(s) && passMetric(r);
  if (!pass) {
    console.log('\nFAILING QUESTIONS (score < 95 on either metric):');
    for (const x of questions) {
      if (x.strict < 95 || x.realUse < 95) console.log(`  [strict ${x.strict} / real ${x.realUse}] ${x.q}${x.note ? ` — ${x.note}` : ''}`);
    }
    console.log('\nIncomplete-but-not-wrong = POISON. Fix the gap (better --full ingest, primer section, or');
    console.log('a retrieval-layer adjustment), rebuild, re-grade. Do NOT lower the bar.');
  }
  console.log(`\n=== GRADE: ${pass ? 'PASS (avg>=98 AND min>=95 on both metrics)' : 'FAIL'} ===`);
  process.exit(pass ? 0 : 1);
}
if (CHECK) enforce();

// ---- evidence mode: run each question through the REAL path, emit the bundle to grade ----
const clip = (s, n = 1600) => (s.length > n ? s.slice(0, n) + `\n... [+${s.length - n} more chars; full text via forge-ask]` : s);

console.log(`# Answer-quality evidence — ${NAME}${VARIANT ? ` [${VARIANT}]` : ''}`);
console.log(`# ${questions.length} questions. Score each 1-100 (98 = perfect/complete; incomplete-but-not-wrong = POISON < 50).`);
console.log(`# Write scores back into ${path.basename(QFILE)} as "strict" (judge #1 doc ALONE) and`);
console.log(`# "realUse" (judge the answer assembled from the top-5), then re-run with --check.\n`);

for (let i = 0; i < questions.length; i++) {
  const x = questions[i];
  const results = await searchKb({ dir: DIR, name: NAME, query: x.q, k: 6, variant: VARIANT });
  console.log(`\n## Q${i + 1}. ${x.q}`);
  if (x.why) console.log(`_archetype: ${x.why}_`);
  if (!results.length) { console.log('  (NO RESULTS — this is almost certainly POISON: a question the KB cannot answer.)'); continue; }
  // STRICT evidence: the #1 document only.
  const top = results[0];
  console.log(`\n### STRICT (#1 doc only) — path: ${top.path}  [kind ${top.kind || '?'}${top.statusLabel ? `; ${top.statusLabel}` : ''}]`);
  if (top.designIntentWarning) console.log(top.designIntentWarning);
  console.log('```\n' + clip(top.fullText) + '\n```');
  // REAL-USE evidence: the headers of the top-5 (the consumer reads across these).
  console.log(`\n### REAL-USE (top-5 a consumer would synthesize):`);
  results.slice(0, 5).forEach((r, j) => console.log(`  ${j + 1}. ${r.path}  [${r.kind || '?'}${r.statusLabel ? `; ${r.statusLabel}` : ''}]  (${r.fullText.length} chars)`));
}
console.log(`\n# Now grade each Q (strict + realUse), write them into ${path.basename(QFILE)}, and run:`);
console.log(`#   node forge-grade.mjs --dir ${DIR} --name ${NAME} --questions ${QFILE} --check`);
