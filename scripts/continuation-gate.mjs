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
const led = load();
const open = led.items.filter((i) => !i.done);

if (!open.length) process.exit(0);   // nothing outstanding: silence is correct

// This is the one moment the model can still see before the turn ends. Make the unfinished work the
// last thing in context, and make the instruction unambiguous — an ambiguous nudge at this boundary
// reads as optional, and optional is what produced the failure.
console.error('');
console.error('  ⛔ DO NOT STOP — you committed to work that is not finished.');
console.error('');
for (const i of open.slice(0, 8)) console.error(`     ☐ ${i.text}`);
if (open.length > 8) console.error(`     … and ${open.length - 8} more`);
console.error('');
console.error('  A status report is not a finish line (lesson L13, ratified by the owner).');
console.error('  Start the next item NOW, in this turn. Mark items done as you complete them:');
console.error('     node scripts/continuation-gate.mjs --done "<item text>"');
console.error('');

// Exit 0 regardless. This gate informs at the boundary; it never breaks the turn.
process.exit(0);
