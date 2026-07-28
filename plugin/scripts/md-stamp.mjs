#!/usr/bin/env node
// plugin/scripts/md-stamp.mjs — PostToolUse (Write|Edit|MultiEdit). Refreshes an EXISTING doc
// stamp's date to today, in-place, whenever a touched .md file's stamp has gone stale.
//
// WHY. The owner: "I told you to update all .md docs with time/date stamps when touched. I don't
// want to have to remind you again in any repo." Today that convention lives only in the model's
// memory — it forgets, in this repo and in every other one. This makes it a mechanism instead:
// the date on a doc's own `Updated:` line (or an ADR/DDD frontmatter `updated:` key) is corrected
// by the harness itself, the instant the file is touched, with zero model involvement.
//
// SCOPE, DELIBERATELY NARROW. This does not invent a stamp format (a file with none is left alone —
// "only maintain existing stamps, never impose a format") and it does not implement ADR-034's larger
// doc-currency system (governs:, verified:, digests, a currency log) — that is a separate, heavier,
// push-time gate over docs/adr/ + docs/ddd/ (scripts/doc-currency.mjs). This hook is the small,
// always-on half: keep the date people actually read from going stale, on every .md file in the repo.
//
// CONTRACT (matches every other advisory hook body in this dir): dispatched via hook-shim.mjs
// (mode: advisory), fed the Claude Code tool-event JSON on stdin exactly like learn-capture.sh /
// continuation-gate.mjs. ALWAYS exits 0 — a hook that can block a turn over a markdown date is a
// hook that gets disabled within a day. On any parse/IO error: do nothing, exit 0, silently.
//
// IDEMPOTENCY IS THE WHOLE SAFETY ARGUMENT. A write here re-fires this same PostToolUse hook. If a
// file already carries today's date, this script MUST NOT touch it — no write, byte-for-byte
// identical — or every `Write`/`Edit` of an up-to-date doc would loop forever. Every code path below
// is built around that: compute the new content, and only call fs.writeFileSync if it actually
// differs from what's on disk.
//
// PURITY: node builtins only (fs, path, url) plus this dir's own hook-input.mjs (ADR-0021's shared,
// tested payload parser) — no npm dependency, no shelling out.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHookEvent, toolName, field, readStdinBounded } from './hook-input.mjs';

// ── date, from the system clock, formatted in the repo's standard timezone ─────────────────────────
// Same idiom as scripts/self-update.mjs's README badge stamp: Intl.DateTimeFormat is a Node builtin
// (ICU is bundled), never a guessed/hardcoded string.
// The date is computed in the MACHINE'S OWN timezone by default — this plugin ships to other
// machines, and a user in Tokyo editing their own doc should get Tokyo's date, not New York's.
// Overridable with RUVNET_MD_STAMP_TZ for anyone who wants their docs pinned to a fixed zone (e.g.
// a team standardising on ET). Name kept `todayNY` for import stability; the "NY" is now only the
// legacy default's ghost, not a hardcode. An invalid TZ value falls back to system-local, never throws.
export function todayNY(now = new Date(), tz = process.env.RUVNET_MD_STAMP_TZ) {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (tz) opts.timeZone = tz;
  let parts;
  try { parts = new Intl.DateTimeFormat('en-CA', opts).formatToParts(now); }
  catch { parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now); }
  const g = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

// ── the two known stamp conventions (grepped from this repo's real docs, not guessed) ──────────────
//   1. Plain docs (README/SPEC/docs/*.md): a line near the top reading
//        Updated: 2026-07-22 01:40:00 EDT | Version 1.0.0
//      (sometimes backtick-wrapped, sometimes date-only, sometimes a trailing comment instead of a
//      version — the DATE is the only part every observed variant shares, so it's the only part
//      touched: time/TZ/version/comment text survive byte-for-byte).
//   2. ADR/DDD YAML frontmatter: a bare `updated: 2026-07-22` key inside the leading `---` block.

const PLAIN_UPDATED_RE = /^([ \t]*`?Updated:[ \t]*)(\d{4}-\d{2}-\d{2})/m;
const FRONTMATTER_BLOCK_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/;
const FRONTMATTER_UPDATED_RE = /^(updated:[ \t]*)(\d{4}-\d{2}-\d{2})([ \t]*)$/m;

// Real stamps in this repo sit on line 1-4 (README/SPEC/docs/*.md); 10 lines is generous headroom
// without wandering into prose that merely discusses the convention (which never contains a real
// date next to the literal capitalized word "Updated:", so the risk is already low — this is a
// second, structural guard on top of that).
const PLAIN_STAMP_MAX_LINES = 10;

function headSlice(content, maxLines) {
  let idx = 0;
  for (let line = 0; line < maxLines; line++) {
    const nl = content.indexOf('\n', idx);
    if (nl === -1) return content; // whole file is shorter than the window
    idx = nl + 1;
  }
  return content.slice(0, idx);
}

/** Refresh a plain `Updated: <date>...` line near the top of the file. No-op if absent/current. */
function refreshPlainStamp(content, today) {
  const head = headSlice(content, PLAIN_STAMP_MAX_LINES);
  const m = head.match(PLAIN_UPDATED_RE);
  if (!m || m[2] === today) return content;
  const patchedHead = head.slice(0, m.index) + m[1] + today + head.slice(m.index + m[0].length);
  return patchedHead + content.slice(head.length);
}

/** Refresh a bare `updated: <date>` key inside the leading YAML frontmatter block. No-op if absent/current. */
function refreshFrontmatterStamp(content, today) {
  const block = content.match(FRONTMATTER_BLOCK_RE);
  if (!block || block.index !== 0) return content;
  const um = block[0].match(FRONTMATTER_UPDATED_RE);
  if (!um || um[2] === today) return content;
  const patchedBlock =
    block[0].slice(0, um.index) + um[1] + today + um[3] + block[0].slice(um.index + um[0].length);
  return patchedBlock + content.slice(block[0].length);
}

// ── ENSURE (ADR-056 §2/§3, 2026-07-27) ───────────────────────────────────────────────────────────
// Everything above only ever REFRESHES a stamp someone already wrote. That is deliberately half the
// job, and the duel proved it is the WRONG half: a hook that fires on edit "never reaches a stale
// file, by definition of stale" — the 166 unstamped files are unstamped precisely because nobody is
// editing them. So there is a second entry point, used by the one-time sweep
// (scripts/stamp-sweep.mjs) and available to the hook behind an explicit opt-in.
//
// PLACEMENT IS BY SHAPE, NEVER A LITERAL LINE 1. Five plugin/skills/*/SKILL.md files require YAML
// frontmatter at line 1 for Claude Code's skill loader; a blind line-1 insert stops them loading. And
// this ships to strangers, whose line 1 is load-bearing in ways this repo cannot enumerate.
//
// THE REFUSAL IS THE FEATURE. On any prologue we do not positively recognise, this returns the
// content UNCHANGED. Silence is the correct output for a shape we do not understand — an insertion
// that corrupts someone's document is far worse than a document without a date.

const H1_RE = /^(#[^\n]*\r?\n)/;
// A leading HTML comment, an MDX import/export, a Jekyll/Astro directive, a license banner: all
// prologue shapes whose first line is load-bearing. We recognise them only well enough to REFUSE.
const UNKNOWN_PROLOGUE_RE = /^\s*(<!--|<|import\s|export\s|\{\/\*|%%|\/\*|#!)/;

/** Is this document safe to insert into, and where? Returns null when the answer is "do not touch". */
export function stampInsertionPoint(content) {
  if (FRONTMATTER_BLOCK_RE.test(content)) return { kind: 'frontmatter' };
  if (UNKNOWN_PROLOGUE_RE.test(content)) return null;      // refuse — shape not understood
  const h1 = content.match(H1_RE);
  // After a leading `# Title` is where every stamped document in this repo actually puts it
  // (DDD-0008, SPEC.md, the primer). Matching the house shape beats a pedantic line 1.
  if (h1) return { kind: 'after-h1', index: h1[0].length };
  return { kind: 'top', index: 0 };
}

// A THIRD stamp shape, found 2026-07-27: README carries its date inside a shields.io badge
// ("version 3.9.85-dev — updated 2026-07-27 06:02 EDT"), maintained by self-update.mjs. Without
// this, README reported "prologue shape not recognised" — a refusal that was RIGHT IN OUTCOME and
// WRONG IN ITS REASON, which is precisely the class of accidental correctness this ADR exists to
// end. Recognising it makes the report say the true thing: already stamped, leave it alone.
// Deliberately narrow: the word `updated` adjacent to a date, inside a link/image, in the head.
const BADGE_UPDATED_RE = /!?\[[^\]]*updated[_\s-]+\d{4}-{1,2}\d{2}-{1,2}\d{2}/i;

/** Does this document already carry a stamp anywhere we would look? */
export function hasStamp(content) {
  const fm = content.match(FRONTMATTER_BLOCK_RE);
  if (fm && fm.index === 0 && FRONTMATTER_UPDATED_RE.test(fm[0])) return true;
  const head = headSlice(content, PLAIN_STAMP_MAX_LINES);
  return PLAIN_UPDATED_RE.test(head) || BADGE_UPDATED_RE.test(head);
}

/**
 * Pure. Insert a stamp when — and only when — the document has none and its shape is understood.
 * `updated` is REQUIRED and must be derived by the caller (git), never defaulted to today: stamping
 * an untouched file with today's date is the "false freshness" failure DDD-0008 invariant 4 names.
 */
export function ensureStamp(content, { updated, created } = {}) {
  if (!updated || !/^\d{4}-\d{2}-\d{2}$/.test(updated)) return content;  // no derived date ⇒ no stamp
  if (hasStamp(content)) return content;                                  // already stamped ⇒ never touch
  const at = stampInsertionPoint(content);
  if (!at) return content;                                                // shape refused

  if (at.kind === 'frontmatter') {
    // Frontmatter with no `updated:` key — add it INSIDE the block, never above it.
    const block = content.match(FRONTMATTER_BLOCK_RE)[0];
    const closing = block.lastIndexOf('---');
    const line = `updated: ${updated}\n`;
    return block.slice(0, closing) + line + block.slice(closing) + content.slice(block.length);
  }

  const stamp = created && /^\d{4}-\d{2}-\d{2}$/.test(created) && created !== updated
    ? `\nUpdated: ${updated}\nCreated: ${created}\n`
    : `\nUpdated: ${updated}\n`;
  return content.slice(0, at.index) + stamp + content.slice(at.index);
}

/** Pure: given a .md file's current bytes, return the bytes it should have. Identical in ⇒ identical out. */
export function computeStampedContent(content, today = todayNY()) {
  return refreshPlainStamp(refreshFrontmatterStamp(content, today), today);
}

// ── the hook body ────────────────────────────────────────────────────────────────────────────────
async function readHookInput() {
  // Never block waiting on stdin: a TTY (someone running this file by hand) has none to give.
  if (process.stdin.isTTY) return null;
  try { return parseHookEvent((await readStdinBounded()).toString('utf8')); } catch { return null; }
}

async function main() {
  // THE OFF SWITCH. This hook writes to the user's own files, so it must be silenceable in one move
  // — the same "nothing without you" bar anticipate.sh's RUVNET_ANTICIPATE=0 meets. Set
  // RUVNET_MD_STAMP=0 (or =off) and it becomes a no-op. Absence = on (it only ever refreshes a stamp
  // the user already put there, never invents one), but the escape hatch exists and is honoured first.
  const sw = String(process.env.RUVNET_MD_STAMP ?? '').trim().toLowerCase();
  if (sw === '0' || sw === 'off' || sw === 'false' || sw === 'no') return;

  const ev = await readHookInput();
  if (!['Write', 'Edit', 'MultiEdit'].includes(toolName(ev))) return; // wrong tool: do nothing

  const filePath = field(ev, 'tool_input.file_path');
  if (!filePath || path.extname(filePath).toLowerCase() !== '.md') return; // wrong file: do nothing

  let original;
  try { original = fs.readFileSync(filePath, 'utf8'); } catch { return; } // unreadable/gone: exit 0

  let stamped;
  try { stamped = computeStampedContent(original); } catch { return; } // malformed content: exit 0

  if (stamped === original) return; // already current (or no stamp at all) — NEVER write; loop guard

  try { fs.writeFileSync(filePath, stamped); } catch { /* advisory — a failed write is not our problem */ }
}

function isMain() {
  try { return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url); }
  catch { return false; }
}

if (isMain()) {
  try { await main(); } catch { /* fail open, always — see CONTRACT above */ }
  process.exit(0);
}
