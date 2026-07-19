#!/usr/bin/env node
// ingest-meeting.mjs — turn a Read.ai meeting transcript into brain passages (the ruv-meetings store).
//
// WHY (2026-07-17, Stuart): rUv's community calls are where he explains HOW HE THINKS — the
// doctrine behind the repos (meta-proxy load balancing, flywheel economics, oracle memory,
// harness-vs-model philosophy). The repos hold the WHAT; the calls hold the WHY. This makes them
// citable: search_ruvnet returns "ruv-meetings/<date>-<slug>" passages alongside source code.
//
// PRIVACY — this store is PRIVATE BY CONSTRUCTION and that is load-bearing:
//   • kb/ruv-meetings.* is gitignored (never committed to the public repo)
//   • "ruv-meetings" is listed in kb/PRIVATE-STORES.json, so scripts/build-bundle.mjs excludes it
//     from every publishable bundle (same fail-closed fence as the cognitum stores)
//   Participants of a community call did not consent to public redistribution. Local brain only.
//
// Output contract mirrors ingest-gists.mjs: kb/ruv-meetings.passages.jsonl (+ .meta.json), then:
//   node kb/forge-big.mjs both --dir kb --name ruv-meetings
//
// Usage:
//   node scripts/ingest-meeting.mjs --file "docs/Ruv_advice/Ruv hackerspace Transcript.txt" \
//        --title "Ruv hackerspace" --date 2026-07-16 [--append]
//   --append keeps existing passages (multi-meeting store grows over time); default rebuilds.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB = path.join(path.dirname(__dirname), 'kb');
const OUT_PASSAGES = path.join(KB, 'ruv-meetings.passages.jsonl');
const OUT_META = path.join(KB, 'ruv-meetings.meta.json');

const args = process.argv.slice(2);
const get = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const file = get('file');
const title = get('title') || 'community call';
const date = get('date') || 'unknown-date';
const APPEND = args.includes('--append');
if (!file || !fs.existsSync(file)) { console.error('need --file <transcript.txt>'); process.exit(2); }

const raw = fs.readFileSync(file, 'utf8');

// Read.ai format: blocks of "H:MM(:SS) - Speaker Name\n<text>\n". Parse into turns, then pack turns
// into passages of ~2,200 chars, never splitting inside a turn — a speaker's thought stays whole
// (the same clean-thought law the explainer's line breaks follow).
const turnRe = /^(\d{1,2}:\d{2}(?::\d{2})?) - (.+)$/;
const lines = raw.split('\n');
const turns = [];
let cur = null;
for (const line of lines) {
  const m = line.match(turnRe);
  if (m) {
    if (cur && cur.text.trim()) turns.push(cur);
    cur = { ts: m[1], speaker: m[2].trim(), text: '' };
  } else if (cur) {
    cur.text += (cur.text ? '\n' : '') + line;
  }
}
if (cur && cur.text.trim()) turns.push(cur);

const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const HEADER = `SOURCE: rUv community call — "${title}" (${date}), Read.ai transcript.\n`
  + `STATUS: spoken, informal — rUv's live thinking and practice. Treat as INTENT and doctrine;\n`
  + `verify shipped behavior against repo source before asserting a capability exists.\n`;

const TARGET = 2200;
const passages = [];
let buf = [];
let bufLen = 0;
let firstTs = null;
const flush = () => {
  if (!buf.length) return;
  const seg = String(passages.length).padStart(4, '0');
  passages.push({
    id: String(passages.length),
    // UNIQUE path per segment (verified fix, 2026-07-19). A shared path made forge-ask.mjs doc-collapse
    // crush every segment of a meeting into ONE ~12k window — the 317-passages→4-paths collapse that
    // made meeting recall unretrievable (facts were IN the corpus but never surfaced; meeting recall
    // 3/28). One path = one segment, the same granular convention ingest-gists.mjs uses (gist-id/file#N).
    // With this + the reader's transcript-store BM25 candidates, meeting recall went 3/28 → 25/28. See
    // docs/adr/0025.
    path: `ruv-meetings/${date}/${slug}-seg-${seg}`,
    title: `${title} — ${firstTs}`,
    text: `${HEADER}segment starting ${firstTs} —\n\n` + buf.join('\n\n'),
    meeting: slug, date, ts: firstTs,
  });
  buf = []; bufLen = 0; firstTs = null;
};
for (const t of turns) {
  const block = `[${t.ts}] ${t.speaker}:\n${t.text.trim()}`;
  if (bufLen + block.length > TARGET && buf.length) flush();
  if (!buf.length) firstTs = t.ts;
  buf.push(block); bufLen += block.length;
}
flush();

let existing = [];
if (APPEND && fs.existsSync(OUT_PASSAGES)) {
  existing = fs.readFileSync(OUT_PASSAGES, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // Re-ingesting the same meeting replaces its old passages instead of duplicating them.
  existing = existing.filter((p) => p.meeting !== slug);
}
const all = [...existing, ...passages].map((p, i) => ({ ...p, id: String(i) }));
fs.writeFileSync(OUT_PASSAGES, all.map((p) => JSON.stringify(p)).join('\n') + '\n');
fs.writeFileSync(OUT_META, JSON.stringify({
  builder: 'ingest-meeting',
  builtUtc: new Date().toISOString(),
  private: true,
  fence: 'kb/PRIVATE-STORES.json + .gitignore — never bundle, never commit',
  meetings: [...new Set(all.map((p) => `${p.date} ${p.meeting}`))],
  passages: all.length,
}, null, 2) + '\n');

console.log(`ingest-meeting: ${turns.length} turns → ${passages.length} passages for "${title}" (${date})`);
console.log(`total store: ${all.length} passages → ${path.relative(process.cwd(), OUT_PASSAGES)}`);
console.log(`next: node kb/forge-big.mjs both --dir kb --name ruv-meetings   (embed → ruv-meetings.big.rvf)`);
