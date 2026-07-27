// brain-state.mjs — is the brain ON or OFF? One question, one file, no third state. (ADR-054 §2)
//
// THE ONE IDEA: THE SENTINEL *IS* THE SWITCH.
//
// `~/.config/ruvnet-brain/brain-off` present = off. Absent = on. There is deliberately no "enabled"
// value anywhere that a reader has to parse, interpret, version-negotiate, or repair — because every
// one of those verbs is a place where the user's stated choice can be silently lost, and the
// 2026-07-26 adversarial duel found all of them in the JSON-settings design this replaced:
//
//   • SKEW. An older release's validate() DROPS unknown keys ("Dropped, not preserved" —
//     user-settings.mjs). A user turns the brain off on v4, opens a project still running v3, v3
//     saves any unrelated setting, and `brainEnabled` is gone. The next session the brain is back on
//     and nothing anywhere reports it. Gate test 1 reproduces exactly that sequence.
//   • CORRUPTION AND FAIL POLARITY. A truncated write, an EACCES, or a file written by a future
//     version all make loadSettings() fall back to DEFAULTS — and the default is ON. Every failure
//     mode in a settings file therefore fails toward "enabled", which is the wrong direction for a
//     consent record. `[ -f ]` has no failure mode that resolves to "the user must have meant on".
//   • READERS. Three bash gates and a bundled MCP child have to answer this question. `[ -f x ]`
//     works in bash 3.2 with no jq, no node and no parsing; `fs.existsSync` works in any node
//     vintage. A JSON schema does not.
//
// settings.json keeps a MIRROR key (`brainEnabled`) so the console has a UI record and so the choice
// shows up where a user goes looking for their choices. The mirror is a record, never the switch:
// when the two disagree the sentinel wins and `disagreement()` hands the console the fact to show,
// rather than letting one surface quietly pick a winner.
//
// DELIBERATELY DEPENDENCY-FREE. node builtins only. This module is imported by the console and by
// the installer's siblings; the boot-frozen hook shim and the bundled KB child re-derive the same
// path inline instead of importing it, because neither can reach outside its own frozen tree. Those
// three copies are held together by tests, not by hope (tests/unit/brain-off.test.mjs asserts the
// real path from bash, from the shim and from the bundle).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * WHERE IT LIVES. Same directory, and the same argument, as user-settings.mjs's STORE_PATH: grepping
 * bin/install.mjs for `.config/ruvnet-brain` shows the installer has no code path that writes there
 * during `--update`, so a preference stored here survives every release. `--uninstall` is the ONE
 * exception and it is deliberate (ADR-054 §5): a removed product must not leave an invisible OFF
 * behind for its own reinstall to inherit.
 *
 * Resolved per call, not once at module load, so a test (or a second machine profile) can point it
 * somewhere else with RUVNET_BRAIN_STATE_DIR and have every function in this file agree immediately.
 */
export function stateDir() {
  return process.env.RUVNET_BRAIN_STATE_DIR || path.join(os.homedir(), '.config', 'ruvnet-brain');
}

/** The switch. Its EXISTENCE is the entire protocol; its contents are metadata for humans. */
export function sentinelPath() {
  return path.join(stateDir(), 'brain-off');
}

/**
 * IS THE BRAIN OFF? The only question this module exists to answer.
 *
 * Note what it does NOT do: read the file, parse it, validate it, or consult settings.json. A
 * `touch`ed, empty, corrupt or hand-written sentinel all mean the same thing, because a user who put
 * a file there meant it. Anything cleverer would reintroduce a parse step, and a parse step is a
 * failure mode, and a failure mode on a consent record resolves to "we ignored what you asked for".
 */
export function isBrainOff(file = sentinelPath()) {
  try { fs.statSync(file); return true; }
  catch (e) { return !isAbsent(e); }
}

/**
 * ONLY "the file is genuinely not there" counts as ON. Everything else counts as OFF.
 *
 * This distinction was NOT in the first draft and gate test 5 caught it, which is the whole reason
 * that test exists. `fs.existsSync` does not throw on EACCES — it returns FALSE. So a state
 * directory the process cannot read reported "no sentinel" and the brain came back on, silently,
 * for a user who had switched it off: the exact fail-open polarity ADR-054 §2 chose the sentinel to
 * dissolve, reproduced inside the sentinel's own reader.
 *
 * The tradeoff is stated rather than hidden. An unreadable state dir now reads as OFF even for a
 * user who never switched it off — and that is the direction to be wrong in. Wrong-toward-off is
 * VISIBLE (session-start prints its one state line every session, the console shows the switch,
 * both name the file) and recoverable in one `chmod`. Wrong-toward-on is INVISIBLE and overrides a
 * choice the user already made, which is a consent violation rather than a bug.
 */
function isAbsent(e) {
  return !!e && (e.code === 'ENOENT' || e.code === 'ENOTDIR');
}

/**
 * READ THE STATE, including the parts we might not know.
 *
 * `since` falls back to the file's own mtime when the contents are unparseable, so the session-start
 * line can still name a date instead of printing "since undefined". `reason` does NOT get a fallback:
 * we either know why or we say null. Inventing a plausible reason on a consent record is precisely
 * the fabrication this repo has a standing order against.
 */
export function readOffState(file = sentinelPath()) {
  let stat;
  try { stat = fs.statSync(file); }
  catch (e) {
    // Same polarity as isBrainOff(): only genuine absence is ON. An unreadable state dir reports OFF
    // with everything it does not know set to null, rather than inventing an "on" it cannot see.
    if (isAbsent(e)) return { off: false, since: null, reason: null, host: null, path: file };
    return { off: true, since: null, reason: null, host: null, path: file, unreadable: e.code || 'unknown' };
  }

  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { /* touched / truncated / hand-written — existence still decides */ }

  const valid = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  return {
    off: true,
    since: (valid && typeof parsed.since === 'string' && !Number.isNaN(Date.parse(parsed.since)))
      ? parsed.since
      : new Date(stat.mtimeMs).toISOString(),
    reason: valid && typeof parsed.reason === 'string' && parsed.reason ? parsed.reason : null,
    host: valid && typeof parsed.host === 'string' ? parsed.host : null,
    path: file,
  };
}

/**
 * TURN IT OFF — atomically, so no reader can ever observe a half-written sentinel.
 *
 * temp-file + rename, the same primitive and the same reason as user-settings.mjs's writeAtomic():
 * two console tabs, two Claude Code windows and a CLI can all be writing this at once, and a reader
 * that catches a zero-byte file mid-write must still read "off" rather than crash or, far worse,
 * read "on". The temp name carries the pid so concurrent writers cannot collide on it.
 *
 * The write is best-effort about its CONTENT and strict about its EXISTENCE: if the JSON body cannot
 * be written we still report the failure honestly rather than claiming the brain is off when it is
 * not. A switch that lies about having been flipped is worse than a switch that refuses.
 */
export function setBrainOff(reason = null, { file = sentinelPath() } = {}) {
  const dir = path.dirname(file);
  try { fs.mkdirSync(dir, { recursive: true }); }
  catch (e) { return { ok: false, path: file, log: `could not create ${dir}: ${e.message}` }; }

  const body = `${JSON.stringify({
    off: true,
    since: new Date().toISOString(),
    reason: reason ? String(reason) : null,
    host: os.hostname(),
    // Legible to a human who finds this file and has no idea what it is. Support reads it in one go.
    note: 'RuvNet Brain is switched OFF. This file IS the switch — deleting it turns the brain back on.',
  }, null, 2)}\n`;

  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, body, { flag: 'wx' });
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* leave the temp rather than throw over it */ }
    return { ok: false, path: file, log: `could not write the switch: ${e.message}` };
  }
  return { ok: true, path: file, off: true, log: 'the brain is off' };
}

/**
 * TURN IT ON — remove the sentinel. Idempotent by construction: "already on" is a success, not an
 * error, because the caller asked for a STATE and got it. The installer's uninstall path relies on
 * exactly this shape.
 */
export function setBrainOn({ file = sentinelPath() } = {}) {
  try {
    if (!fs.existsSync(file)) return { ok: true, path: file, off: false, log: 'the brain was already on' };
    fs.rmSync(file);
    return { ok: true, path: file, off: false, log: 'the brain is on' };
  } catch (e) {
    return { ok: false, path: file, log: `could not remove the switch (${file}): ${e.message}` };
  }
}

/**
 * DO THE SWITCH AND ITS MIRROR AGREE? Returns null when they do, and the FACT when they do not.
 *
 * The console renders this rather than resolving it silently. The two can legitimately drift — an
 * older release drops the mirror key (gate test 1), a user hand-edits one of the two files, a
 * `--update` from a different line lands in between — and in every one of those cases the honest
 * surface says "these disagree, here is which one is in force" instead of showing a toggle whose
 * position is a guess.
 */
export function disagreement(mirrorEnabled, { file = sentinelPath() } = {}) {
  const off = isBrainOff(file);
  const mirrorSaysOff = mirrorEnabled === false;
  if (off === mirrorSaysOff) return null;
  return {
    sentinelWins: true,
    inForce: off ? 'off' : 'on',
    sentinel: off ? 'off' : 'on',
    mirror: mirrorSaysOff ? 'off' : 'on',
    note: off
      ? 'The switch file says OFF and your saved settings say ON. The switch is what every part of the brain actually reads, so the brain is OFF.'
      : 'Your saved settings say OFF but the switch file is gone, so the brain is ON. Set it again here if you meant it to stay off.',
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
// Read-only. Turning the brain on or off is the console's job (it takes a backup of the mirror and
// records the change); this prints what is true right now so support can diagnose in one command.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('brain-state.mjs');
if (invokedDirectly) {
  const state = readOffState();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(state, null, 2));
  } else if (state.off) {
    console.log(`\n  RuvNet Brain: OFF since ${state.since.slice(0, 10)}${state.reason ? ` — ${state.reason}` : ''}`);
    console.log(`  Switch file : ${state.path.replace(os.homedir(), '~')}\n`);
  } else {
    console.log(`\n  RuvNet Brain: ON (no switch file at ${state.path.replace(os.homedir(), '~')})\n`);
  }
}
