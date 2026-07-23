#!/usr/bin/env node
/**
 * continuation-gate.mjs — the gate that fires on STOPPING, because nothing else can.
 *
 * THE HOLE THIS CLOSES, and it is a real architectural gap in ADR-030, not a missing feature.
 *
 * Every gate in this project fires on an ACTION: a Write, an Edit, a push, a claim, a status
 * report. That is what makes them enforceable — there is a tool call to intercept.
 *
 * **Stopping is the absence of an action.** When the model finishes a unit of work, writes a
 * summary, and waits — no tool fires, no text is classified, nothing is intercepted. The single
 * most costly failure of 2026-07-22 had NO TRIGGER, which is why a system explicitly built to
 * prevent it did not prevent it.
 *
 * The owner, 05:45, and it is the correct indictment: *"This was exactly the stuff that RuvNet-Brain
 * was designed to stop, so the fact that you didn't is yet another failure... you agree you are
 * going to finish something and you stop because you have some excuse, and then you don't start
 * yourself up again."*
 *
 * L13 was recorded and ratified an hour earlier and did not help, because it fires on
 * `report-status` — it can only catch a stop that ANNOUNCES itself. A silent stop is invisible to
 * every gate in the system.
 *
 * HOW THIS WORKS. A `Stop` hook runs when a turn ends. It reads the work ledger — a plain list of
 * committed-to items with a done state — and if authorized work remains unfinished, it says so, in
 * the last place the model looks before going quiet.
 *
 * WHAT IT DOES, verified against code.claude.com/docs/en/hooks.md (2026-07-23, not recalled, ADR-043):
 * a Stop hook's `additionalContext` at exit 0 DOES force a continuation — under the same loop
 * protections as decision:block (the `stop_hook_active` input + the 8-consecutive-continuation cap). An
 * earlier version of this header claimed "a Stop hook cannot force another turn"; that was wrong. The
 * gate still exits 0 always — continuation is driven by the envelope, never by a non-zero exit code.
 *
 * FAILS OPEN ALWAYS. Exit 0 unconditionally. A gate that breaks a turn's completion because it
 * could not read a JSON file would be disabled within a day, and a disabled gate protects nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();

// The only exit code this file may ever use. A Stop hook that exits non-zero refuses to let the turn
// end; this gate informs and never refuses, so every path below returns exactly this.
const EXIT_ALLOW = 0;
/**
 * PROJECT-SCOPED, because this runs machine-wide.
 *
 * The owner runs three projects simultaneously. A single global ledger would mix their commitments
 * and fire "you did not finish X" in a repo that never heard of X — which is a false alarm, and
 * ADR-028 fixes the false-alarm rate at ZERO. So the ledger is keyed by the git repo root (falling
 * back to cwd), stored centrally under ~/.config so it survives `--update`, but partitioned per
 * project so the three never see each other's work.
 */
function projectKey() {
  let dir = process.cwd();
  // Walk up to the git root — the stable identity of a project, regardless of which subdirectory
  // a hook happens to fire from. (A CWD-derived key was exactly the bug that scattered ledgers
  // through users' project trees in issue #36.)
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) break;
    const up = path.dirname(dir);
    if (up === dir) { dir = process.cwd(); break; }
    dir = up;
  }
  return path.basename(dir).replace(/[^a-zA-Z0-9._-]/g, '_');
}

const LEDGER = process.env.RUVNET_WORK_LEDGER
  || path.join(HOME, '.config', 'ruvnet-brain', 'work-ledgers', `${projectKey()}.json`);

const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; };
const has = (f) => argv.includes(f);

function load() {
  try {
    const j = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    return Array.isArray(j.items) ? j : { items: [] };
  } catch { return { items: [] }; }
}
function save(led) {
  try {
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    fs.writeFileSync(LEDGER, JSON.stringify({ ...led, updated: new Date().toISOString() }, null, 2) + '\n');
  } catch { /* the ledger is advisory — never break a turn over it */ }
}

// ── commands ─────────────────────────────────────────────────────────────────────────────────────
if (has('--commit-to')) {
  // Record work the model AGREED to do. The agreement is the thing that makes stopping a defect —
  // without it, ending a turn is simply finishing, and this gate must stay silent.
  const led = load();
  const text = arg('--commit-to');
  if (text && !led.items.some((i) => i.text === text && !i.done)) {
    led.items.push({ text, done: false, at: new Date().toISOString() });
    save(led);
  }
  console.log(`committed: ${text}`);
  process.exit(0);
}

if (has('--done')) {
  const led = load();
  const needle = arg('--done');
  const openItems = led.items.filter((i) => !i.done);
  // Exact match; else an UNAMBIGUOUS substring (exactly one open item). This kills the `--done "e"` /
  // `--done " "` barn door that could silently clear the whole ledger — a zero-cost fake-completion
  // valve under a gate that now applies real continuation pressure (ADR-043, Fable red-team #3).
  let targets = openItems.filter((i) => i.text === needle);
  if (!targets.length && needle) {
    const subs = openItems.filter((i) => i.text.includes(needle));
    if (subs.length === 1) targets = subs;
    else if (subs.length > 1) {
      console.error(`--done "${needle}" is ambiguous (matches ${subs.length} items); use the exact item text.`);
      process.exit(1);
    }
  }
  for (const i of targets) { i.done = true; i.doneAt = new Date().toISOString(); }
  save(led);
  console.log(`marked done: ${targets.length}`);
  process.exit(0);
}

if (has('--clear')) { save({ items: [] }); console.log('ledger cleared'); process.exit(0); }

// ── the Stop hook itself (default action) ────────────────────────────────────────────────────────
/**
 * READ THE PAYLOAD. Every Stop hook receives a JSON object on stdin, and until 2026-07-22 this file
 * ignored it completely — which made the loop guard below not merely absent but UNREACHABLE.
 *
 * Never block waiting for stdin: the CLI paths (--commit-to / --done) are invoked from a terminal
 * with no piped input, and a gate that hangs is worse than a gate that is silent.
 */
function readHookInput() {
  // Three cases, treated DIFFERENTLY (ADR-043, Fable red-team #1):
  //  - 'tty'        : run bare in a terminal, not as a hook → never force.
  //  - 'unreadable' : stdin present but read/parse FAILED. `fs.readFileSync(0)` throws EAGAIN
  //                   intermittently on macOS — a real footgun. The old code returned {} here, which
  //                   under a forcing gate LAUNDERS a read error into a fresh-stop verdict → a forced
  //                   loop. We must not force when we could not confirm the payload.
  //  - 'stdin'      : a payload we actually parsed → the only case allowed to force.
  if (process.stdin.isTTY) return { __source: 'tty' };
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return { ...JSON.parse(raw || '{}'), __source: 'stdin' };
  } catch { return { __source: 'unreadable' }; }
}
const hookInput = readHookInput();

// LOOP-SAFETY 1 (ADR-043 / Fable #1) — only an affirmatively-parsed hook payload may force. A 'tty' or
// 'unreadable' source cannot be confirmed a fresh stop, so it never forces.
if (hookInput.__source !== 'stdin') process.exit(EXIT_ALLOW);

/**
 * LOOP-SAFETY 2 — the documented guard. `stop_hook_active` is true once Claude Code is already
 * continuing because of a stop hook (verified against code.claude.com/docs/en/hooks.md, ADR-043).
 * Honouring it caps each natural-stop episode at EXACTLY ONE forced continuation. Truthy, not
 * `=== true`, so a future string/number drift ("true", 1) cannot slip past into a loop.
 */
if (hookInput.stop_hook_active) process.exit(EXIT_ALLOW);

const led = load();
const nowMs = Date.now();

/**
 * LOOP-SAFETY 3 (belt-and-braces, a cap this file OWNS — Fable #1). The two guards above rest on one
 * harness field behaving as documented across all future versions; this one does not trust it. Never
 * force twice within the cooldown: a tight loop (empty payload, field rename, post-compaction reset) is
 * bounded to one force per window, while genuine re-engagement across real work (minutes apart) is
 * untouched. Configurable so tests exercise both re-engagement (0) and suppression (default).
 */
const COOLDOWN_MS = Number(process.env.RUVNET_CONTINUATION_COOLDOWN_MS ?? 20000);
if (led.lastForcedAt && (nowMs - Date.parse(led.lastForcedAt)) < COOLDOWN_MS) process.exit(EXIT_ALLOW);

const open = led.items.filter((i) => !i.done);
if (!open.length) process.exit(EXIT_ALLOW);   // nothing outstanding: silence is correct

/**
 * FRESHNESS (ADR-043 / Fable #3) — only FORCE for recently-committed work. A week-old abandoned item
 * that compels a continuation every turn breeds the exact fabrication this project kills
 * (mark-done-without-doing). Items with no timestamp are treated as fresh — they predate the `at`
 * field; fail toward the owner's intent. Stale items simply stop forcing; they are not re-nagged.
 */
const STALE_MS = 24 * 60 * 60 * 1000;
const forceable = open.filter((i) => !i.at || (nowMs - Date.parse(i.at)) < STALE_MS);
if (!forceable.length) process.exit(EXIT_ALLOW);

// RE-ENGAGE (ADR-043): no once-per-session cap — the loop-safety above bounds it, not a session counter.
// Record this force so LOOP-SAFETY 3's cooldown can see it. `save` fails silently, so a read-only fs just
// degrades to guards 1+2 rather than breaking the turn.
save({ ...led, lastForcedAt: new Date().toISOString() });

/**
 * DELIVERY. `additionalContext` in a Stop envelope forces the continuation (same protection as
 * decision:block). Directive copy — continue, do not look for an exit.
 */
const lines = [
  'You have unfinished work you committed to. Do NOT end the turn — continue now.',
  'Pick the highest-leverage open item below and make real progress on it this turn. Stop only when',
  'EVERY item is genuinely done or blocked; if one is blocked, say why in a single line and move to',
  'the next — never stop on the first obstacle, and never manufacture a reason to go quiet.',
  '',
  ...forceable.slice(0, 8).map((i) => `  ☐ ${i.text}`),
  ...(forceable.length > 8 ? [`  … and ${forceable.length - 8} more`] : []),
  '',
  'Mark each item done as you complete it:  node plugin/scripts/continuation-gate.mjs --done "<exact item text>"',
];

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'Stop',            // must name the firing event or the envelope is discarded
    additionalContext: lines.join('\n'),
  },
}));

// Exit 0 regardless. This gate informs at the boundary; it never breaks the turn.
process.exit(EXIT_ALLOW);
