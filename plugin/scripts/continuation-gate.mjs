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
 * WHAT IT CANNOT DO, stated plainly rather than overclaimed: a Stop hook cannot force another turn.
 * It can make the unfinished work the last thing in context, which is the strongest available
 * intervention at that boundary. Claiming more would be the fabrication this project exists to kill.
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
  let hit = 0;
  for (const i of led.items) {
    if (!i.done && (i.text === needle || i.text.includes(needle))) { i.done = true; i.doneAt = new Date().toISOString(); hit++; }
  }
  save(led);
  console.log(`marked done: ${hit}`);
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
  if (process.stdin.isTTY) return {};
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}
const hookInput = readHookInput();

/**
 * THE LOOP GUARD. This is the single most important line in the file.
 *
 * `additionalContext` at Stop is NOT a passive message — it CONTINUES THE TURN, and it counts
 * against the same 8-consecutive-continuation cap as `decision: "block"`. From the live hooks doc:
 *
 *   "It keeps the conversation going through the same loop protections as decision: 'block',
 *    namely the stop_hook_active input and the 8-consecutive-continuation cap"
 *   "Claude Code overrides the hook and ends the turn after 8 consecutive blocks."
 *
 * So a Stop hook that speaks unconditionally will continue the turn eight times and be overridden
 * on the ninth. That is not a hypothetical: it happened on 2026-07-22 across three projects, and
 * the harness's own error text named this exact fix — "check stop_hook_active in the input and
 * return success while it's true."
 *
 * `stop_hook_active` is true once Claude Code is already continuing because of a stop hook. Honouring
 * it means the nudge is delivered EXACTLY ONCE and the turn then ends normally.
 */
if (hookInput.stop_hook_active === true) process.exit(EXIT_ALLOW);

const led = load();
const open = led.items.filter((i) => !i.done);

if (!open.length) process.exit(EXIT_ALLOW);   // nothing outstanding: silence is correct

/**
 * ONE NUDGE PER SESSION, not one per turn.
 *
 * The state gate above is necessary but not sufficient for a well-behaved hook. A ledger carries
 * items across sessions, so "work remains" stays true for days — and a nudge that fires on every
 * turn-end for days is a forced extra model turn every single time the user talks. That is the
 * ham-fisted behaviour that gets a tool switched off, and being technically correct about the
 * unfinished work does not redeem it.
 *
 * Keyed on session_id from the payload, so a genuinely new session hears it again.
 */
if (hookInput.session_id && led.nudgedSession === hookInput.session_id) process.exit(EXIT_ALLOW);
if (hookInput.session_id) save({ ...led, nudgedSession: hookInput.session_id });

/**
 * DELIVERY. `additionalContext` on STDOUT is the only channel the model reads at exit 0.
 *
 * This file previously wrote all ten of these lines to console.error. On exit 0, stderr is not a
 * delivery channel — the doc lists it nowhere among the exit-0 paths that reach the model. So the
 * one Stop hook that actually knew whether work was outstanding had been shouting into a void since
 * the day it was written, while the one that knew nothing was heard on every turn. Built, tested,
 * unwired: the exact defect class this project exists to catch, in the file written to catch it.
 */
const lines = [
  'You committed to work that is not finished. This is advisory — if the remaining items are genuinely',
  'blocked or already done, say so and finish the turn; do not manufacture an action to satisfy it.',
  '',
  ...open.slice(0, 8).map((i) => `  ☐ ${i.text}`),
  ...(open.length > 8 ? [`  … and ${open.length - 8} more`] : []),
  '',
  'Mark items done as you complete them:  node plugin/scripts/continuation-gate.mjs --done "<item text>"',
];

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'Stop',            // must name the firing event or the envelope is discarded
    additionalContext: lines.join('\n'),
  },
}));

// Exit 0 regardless. This gate informs at the boundary; it never breaks the turn.
process.exit(EXIT_ALLOW);
