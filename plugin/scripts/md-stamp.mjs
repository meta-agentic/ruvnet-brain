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
import { parseHookEvent, toolName, field } from './hook-input.mjs';

// ── date, from the system clock, formatted in the repo's standard timezone ─────────────────────────
// Same idiom as scripts/self-update.mjs's README badge stamp: Intl.DateTimeFormat is a Node builtin
// (ICU is bundled), never a guessed/hardcoded string.
export function todayNY(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
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

/** Pure: given a .md file's current bytes, return the bytes it should have. Identical in ⇒ identical out. */
export function computeStampedContent(content, today = todayNY()) {
  return refreshPlainStamp(refreshFrontmatterStamp(content, today), today);
}

// ── the hook body ────────────────────────────────────────────────────────────────────────────────
function readHookInput() {
  // Never block waiting on stdin: a TTY (someone running this file by hand) has none to give.
  if (process.stdin.isTTY) return null;
  try { return parseHookEvent(fs.readFileSync(0, 'utf8')); } catch { return null; }
}

function main() {
  const ev = readHookInput();
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
  try { main(); } catch { /* fail open, always — see CONTRACT above */ }
  process.exit(0);
}
