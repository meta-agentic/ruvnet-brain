#!/usr/bin/env node
/**
 * adr-backfill.mjs — lift status and dates into frontmatter where tooling can read them.
 *
 * THE GAP, measured 2026-07-22: 12 of 32 ADRs carried NO frontmatter status and NO dates, and 9
 * more had a creation date but no `updated`. The owner's requirement is exact: *"One thing I ALWAYS
 * want you to do is indicate in an ADR what the status is... they should have a time and date
 * stamped on when they were initially written and a time and date stamped on the last time they
 * were updated and why. That way I know I'm never looking at out-of-date documents."*
 *
 * NOTHING HERE IS INVENTED, and that constraint is the whole design:
 *
 *   status   LIFTED from the document's own body. All 12 already say `**Status**: Accepted (date)`
 *            — the information was never missing, it just sat where no tool could read it. A status
 *            is a judgement; deriving one from git would be fabrication, so a document that does
 *            not state its own status is REPORTED and skipped, never guessed at.
 *   date     LIFTED from the body's `**Date**:`, falling back to git's first-commit date.
 *   updated  DERIVED from `git log -1` — the last commit that actually touched the file. A typed
 *            date can be wrong; a git object cannot.
 *
 * Every written value is therefore traceable to either the document itself or the repository's
 * history. This matters because a fabricated timestamp is worse than a missing one: a missing
 * stamp is visibly unknown, while a wrong stamp is confidently misleading — the exact failure mode
 * this project has paid for repeatedly.
 *
 *   node scripts/adr-backfill.mjs           report what WOULD change (default; writes nothing)
 *   node scripts/adr-backfill.mjs --apply   write it
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(import.meta.dirname, '..');
const ADR_DIR = path.join(REPO, 'docs', 'adr');
const apply = process.argv.includes('--apply');

const git = (args) => {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch { return ''; }
};

/** First-commit date — the honest "created", when the body does not state one. */
const gitCreated = (rel) =>
  (git(['log', '--follow', '--diff-filter=A', '--format=%ad', '--date=short', '--', rel]).split('\n').filter(Boolean).pop() || '');

/** Last commit that touched the file — the honest "updated". */
const gitUpdated = (rel) => git(['log', '-1', '--format=%ad', '--date=short', '--', rel]);

const VALID = ['Proposed', 'Accepted', 'Implemented', 'Superseded', 'Deprecated'];

function parseBody(src) {
  // `**Status**: Accepted (2026-06-27)` → Accepted, 2026-06-27
  const sm = src.match(/^\*\*Status\*\*:\s*([A-Za-z]+)(?:\s*\((\d{4}-\d{2}-\d{2})\))?/m);
  const dm = src.match(/^\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/m);
  const status = sm && VALID.find((v) => v.toLowerCase() === sm[1].toLowerCase());
  return { status: status || null, statusDate: sm?.[2] || null, date: dm?.[1] || null };
}

function frontmatter(src) {
  const lines = src.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return null;
  const keys = {};
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^(\w+):\s*(.*)$/);
    if (m) keys[m[1]] = m[2];
  }
  return { keys, end, lines };
}

const results = [];
for (const f of fs.readdirSync(ADR_DIR).filter((n) => /^\d{4}-.*\.md$/.test(n)).sort()) {
  const rel = path.join('docs', 'adr', f);
  const abs = path.join(ADR_DIR, f);
  const src = fs.readFileSync(abs, 'utf8');
  const fm = frontmatter(src);
  if (!fm) { results.push({ f, skip: 'no frontmatter block to extend' }); continue; }

  const body = parseBody(src);
  const need = {};
  if (!fm.keys.status && body.status) need.status = body.status;
  if (!fm.keys.date) { const d = body.date || body.statusDate || gitCreated(rel); if (d) need.date = d; }
  if (!fm.keys.updated) { const u = gitUpdated(rel); if (u) need.updated = u; }

  if (!fm.keys.status && !body.status) {
    // A status is a judgement. Refuse to guess; report it so a human can decide.
    results.push({ f, skip: 'no status stated anywhere — a human must set this, it cannot be derived' });
    continue;
  }
  if (!Object.keys(need).length) { results.push({ f, ok: true }); continue; }

  if (apply) {
    const insert = Object.entries(need).map(([k, v]) => `${k}: ${v}`);
    const out = [...fm.lines.slice(0, fm.end), ...insert, ...fm.lines.slice(fm.end)];
    fs.writeFileSync(abs, out.join('\n'));
  }
  results.push({ f, need });
}

const changed = results.filter((r) => r.need);
const skipped = results.filter((r) => r.skip);
console.log(`\n  ${results.length} ADR(s) · ${changed.length} ${apply ? 'updated' : 'would change'} · ${skipped.length} skipped · ${results.filter((r) => r.ok).length} already complete\n`);
for (const r of changed) console.log(`    ${apply ? '✓' : '·'} ${r.f}  +${Object.entries(r.need).map(([k, v]) => `${k}=${v}`).join(' +')}`);
for (const r of skipped) console.log(`    ⚠ ${r.f}  — ${r.skip}`);
if (!apply && changed.length) console.log(`\n  Nothing written. Re-run with --apply.\n`);
else console.log('');
