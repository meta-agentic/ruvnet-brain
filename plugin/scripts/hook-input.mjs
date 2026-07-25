#!/usr/bin/env node
// plugin/scripts/hook-input.mjs — the ONE parser every PreToolUse gate uses to read Claude Code's
// hook event.
//
// WHY (2026-07-18, ADR-0021). Every gate hand-rolled a bash regex to pull fields out of the JSON
// payload: field() { local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""; ... }. `([^"]*)` cannot
// cross a `"`, and a JSON-escaped `\"` is still a literal `"` byte in the raw text — so ANY command
// containing a quote was silently TRUNCATED at the first one. That fails OPEN on exactly the commands
// most worth inspecting (issue #13 fixed this in verify-interface.sh, but design-wall.sh — written
// AFTER — reintroduced the identical bug, because the fix lived in one file's inline `node -e` instead
// of a shared, tested module). JSON string escaping is not a regular language; only a real parser is
// correct. This is that parser, in ONE place, with ONE known-bad fixture test (hook-input.test.mjs),
// imported by every gate.
//
// CLI (what the bash gates call — mirrors the inline `node -e` they used to each carry):
//   printf '%s' "$INPUT" | node hook-input.mjs tool_name        -> prints event.tool_name
//   printf '%s' "$INPUT" | node hook-input.mjs command          -> prints tool_input.command (|| .command)
//   printf '%s' "$INPUT" | node hook-input.mjs field a.b.c      -> prints an arbitrary dotted path
//   printf '%s' "$INPUT" | node hook-input.mjs skeleton         -> prints the command with quoted
//                                                                   CONTENT masked (issue #41)
//
// CONTRACT: prints "" and exits 0 on ANY parse failure or missing field. It NEVER throws to the caller
// and NEVER exits nonzero on bad input — a gate that breaks the shell protects nothing, so fail-open
// (empty string, exit 0) is the invariant. The gate decides policy from the (possibly empty) value.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Parse the raw stdin payload into the hook event object, or null if it isn't valid JSON. */
export function parseHookEvent(raw) {
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

/** The tool being invoked ("Bash", "Write", …), or "" if absent. */
export function toolName(ev) {
  return ev && typeof ev.tool_name === 'string' ? ev.tool_name : '';
}

/**
 * The Bash command, read from tool_input.command (Claude Code's real shape) with a top-level
 * `.command` fallback. Correctly returns the WHOLE string including embedded quotes — the bug the
 * old bash regex could not: `git commit -m "fix \"x\""` came back truncated at the first quote.
 */
export function commandOf(ev) {
  if (!ev) return '';
  const c = (ev.tool_input && ev.tool_input.command) ?? ev.command;
  return typeof c === 'string' ? c : '';
}

/** Arbitrary dotted-path lookup (e.g. "tool_input.file_path"); "" if any segment is missing. */
export function field(ev, dottedPath) {
  if (!ev || !dottedPath) return '';
  let cur = ev;
  for (const k of String(dottedPath).split('.')) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = cur[k];
  }
  if (cur == null) return '';
  return typeof cur === 'string' ? cur : String(cur);
}

/**
 * The command with quoted CONTENT masked to '_', so only shell-level metacharacters remain visible.
 * Quote characters themselves survive (offsets are preserved); a backslash-escaped char inside a
 * double-quoted string masks as two bytes (the backslash and the char it escapes). Single quotes take
 * no escapes, matching real shell semantics. An unterminated quote simply masks to the end of the
 * string — never throws, never loops.
 *
 * WHY (issue #41): a command-position regex matched against the RAW command reads a `|`, `;`, `&`,
 * `(`, or newline INSIDE a quoted string (e.g. `grep -E "foo|ruflo init"`) as a real shell separator,
 * so whatever follows is misread as command position. Matching against the skeleton instead removes
 * separators that are not actually shell separators. Outside quotes the skeleton is byte-identical to
 * the original, so capture-group offsets for a real match are unaffected.
 */
export function shellSkeleton(cmd) {
  let out = '';
  let q = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (q === '"' && ch === '\\' && i + 1 < cmd.length) { out += '__'; i++; continue; } // escaped char
    if (q) { if (ch === q) { q = null; out += ch; } else out += '_'; continue; }
    if (ch === '"' || ch === "'") { q = ch; out += ch; continue; }
    out += ch;
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
function isMain() {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) {
  const which = process.argv[2] || '';
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    const ev = parseHookEvent(raw);
    let out = '';
    if (which === 'tool_name') out = toolName(ev);
    else if (which === 'command') out = commandOf(ev);
    else if (which === 'field') out = field(ev, process.argv[3] || '');
    else if (which === 'skeleton') out = shellSkeleton(commandOf(ev));
    process.stdout.write(out);
    // ALWAYS exit 0: a parse miss is an empty string, never a crash the gate has to survive.
    process.exit(0);
  });
  // Empty/again-fail-open: if stdin never sends 'end' with content, don't hang the shell forever.
  process.stdin.on('error', () => { process.stdout.write(''); process.exit(0); });
}
