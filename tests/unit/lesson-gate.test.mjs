/**
 * lesson-gate.test.mjs — the enforcement CONTRACT, tested at the process boundary.
 *
 * WHY THESE TESTS EXIST, and why they look the way they do.
 *
 * On 2026-07-22 this system shipped a gate that printed "⛔ BLOCKED" and then allowed the action.
 * It survived review because it had been "proven by exit code" — proven by a human running
 * `node scripts/lesson-gate.mjs` on a terminal and reading the number. That is the one caller which
 * is NOT a hook, and it was the only caller that ever looked correct.
 *
 * So every test here asserts on THREE things at once — exit code, stdout, and stderr, from a real
 * spawned process — because the bug was invisible to any test that checked fewer. The gate exited 1
 * (an error, not a refusal), wrote its reason to stdout (which exit-2 discards), and the dispatcher
 * threw the code away with `|| true`. Each layer was individually plausible. Only the combination of
 * streams and code tells the truth, which is L01 — "verify through a channel CAPABLE of observing
 * the change" — applied to the file that enforces L01.
 *
 * Nothing here mocks the gate, the store, or the shell. Temp stores, real processes, real pipes.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GATE = path.join(ROOT, 'scripts', 'lesson-gate.mjs');
const DISPATCH = path.join(ROOT, 'plugin', 'scripts', 'lesson-hooks.sh');

let dir, storePath, optInPath;

/** A lesson the store will accept as blocking: user-stated, ratified, and carrying a real check.
 *  makeLesson refuses any weaker combination, so this mirrors what the live store actually holds. */
const blockLesson = (over = {}) => ({
  id: 'T01-verify-with-a-capable-channel',
  statement: 'Verify through a channel capable of observing the change before claiming it works.',
  trigger: 'claim-done',
  enforcement: 'block',
  origin: 'user-stated',
  status: 'ratified',
  check: 'a verification command ran against the real path',
  evidence: [{ observed: 'you said: the success check used a read-only connection' }],
  projects: ['alpha', 'beta', 'gamma'],
  repeatCount: 25,
  ...over,
});

function writeStore(lessons) {
  fs.writeFileSync(storePath, JSON.stringify({ version: 1, lessons }, null, 2));
}
function writeOptIn(ids) {
  fs.writeFileSync(optInPath, JSON.stringify({ version: 1, blocking: ids }, null, 2));
}

/** Run the gate as a real process. Returns the full truth: code AND both streams, never one. */
function runGate(args, env = {}) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, RUVNET_LESSON_STORE: storePath, RUVNET_LESSON_OPTIN: optInPath, ...env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Run the dispatcher the way hooks.json runs it — bash, one event argument. */
function runDispatch(event, env = {}) {
  const r = spawnSync('bash', [DISPATCH, event], {
    encoding: 'utf8',
    env: { ...process.env, RUVNET_LESSON_STORE: storePath, RUVNET_LESSON_OPTIN: optInPath, ...env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-gate-'));
  storePath = path.join(dir, 'lessons.json');
  optInPath = path.join(dir, 'blocking-optin.json');
});
afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('a NUDGE informs and never refuses', () => {
  test('exits 0 — the action is allowed', () => {
    writeStore([blockLesson()]);
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
  });

  test('reaches the model via additionalContext, carrying the lesson and its evidence', () => {
    // The channel is verified, not assumed. Per code.claude.com/docs/en/hooks (2026-07-22):
    // "The additionalContext field passes a string from your hook into Claude's context window."
    // On exit 0, plain stdout goes to the DEBUG LOG for Stop/PreToolUse — so a nudge that is merely
    // printed reaches nobody. The JSON envelope is what makes it a nudge rather than a no-op.
    writeStore([blockLesson()]);
    const { stdout } = runGate(['--event', 'Stop', '--trigger', 'claim-done']);
    const payload = JSON.parse(stdout);
    expect(payload.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(payload.hookSpecificOutput.additionalContext).toContain('channel capable of observing');
    expect(payload.hookSpecificOutput.additionalContext).toContain('read-only connection');
  });

  test('says out loud that it is advisory, so the model does not read it as a refusal', () => {
    writeStore([blockLesson()]);
    const { stdout } = runGate(['--event', 'Stop', '--trigger', 'claim-done']);
    expect(JSON.parse(stdout).hookSpecificOutput.additionalContext).toMatch(/advisory/i);
  });

  test('hookEventName names the REAL harness event, or the envelope is discarded', () => {
    // "PreToolUse-write" is our internal key. Emitting it here would produce a well-formed JSON
    // document the harness throws away — a nudge that tests green and delivers nothing.
    writeStore([blockLesson({ id: 'T02-real-tool', trigger: 'write-code' })]);
    const { stdout } = runDispatch('PreToolUse-write');
    expect(JSON.parse(stdout).hookSpecificOutput.hookEventName).toBe('PreToolUse');
  });

  test('writes NOTHING to stderr — stderr on exit 0 is a dead channel, and noise there reads as an error', () => {
    writeStore([blockLesson()]);
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).stderr).toBe('');
  });

  test('emits ONE json document when an event carries several decision points', () => {
    // Stop is simultaneously report-status and claim-done. Two objects concatenated on stdout parse
    // as neither, so the whole nudge would be silently dropped by the harness.
    writeStore([
      blockLesson(),
      blockLesson({ id: 'T03-status-is-a-table', trigger: 'report-status', enforcement: 'checklist', check: null }),
    ]);
    // UserPromptSubmit, not Stop. Stop was made DELIBERATELY INERT on 2026-07-22: a non-blocking
    // nudge emitted at Stop reaches nobody (the harness surfaces stdout as context only at
    // UserPromptSubmit / SessionStart), so report-status and claim-done were moved onto
    // UserPromptSubmit where they are actually delivered. Testing Stop here would assert a channel
    // that does not exist — the same "verified through a channel incapable of observing it" error
    // this very lesson is about.
    const { stdout, code } = runDispatch('UserPromptSubmit');
    expect(code).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    expect(ctx).toContain('channel capable of observing');
    expect(ctx).toContain('Verify through');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('CONSENT: a ratified block lesson is a nudge until the user says otherwise', () => {
  test('a ratified enforcement:block lesson does NOT block without opt-in', () => {
    // The reframe, in one assertion. The owner: "Nudging somebody is very fair. Forcing them through
    // a gate is not." Six ratified block lessons ship today; none of them may refuse work on their
    // own authority. Turning the broken blocks into working ones would have shipped, for the first
    // time, the product that was explicitly rejected.
    writeStore([blockLesson()]);
    const { code, stderr } = runGate(['--event', 'Stop', '--trigger', 'claim-done']);
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  test('absent consent file means nudge, never block — consent is never inferred from silence', () => {
    writeStore([blockLesson()]);
    expect(fs.existsSync(optInPath)).toBe(false);
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
  });

  test('the nudge tells the user blocking is available, as a choice rather than a threat', () => {
    writeStore([blockLesson()]);
    const ctx = JSON.parse(runGate(['--event', 'Stop', '--trigger', 'claim-done']).stdout)
      .hookSpecificOutput.additionalContext;
    expect(ctx).toMatch(/can REFUSE/);
    expect(ctx).toMatch(/your call/i);
    expect(ctx).toContain(optInPath);
  });

  test('opting in one lesson does not opt in any other', () => {
    writeStore([
      blockLesson(),
      blockLesson({ id: 'T04-use-the-real-tool', trigger: 'write-code' }),
    ]);
    writeOptIn(['T04-use-the-real-tool']);
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
    expect(runGate(['--event', 'PreToolUse', '--trigger', 'write-code']).code).toBe(2);
  });

  test('opt-in cannot promote a lesson the store would never let block', () => {
    // Consent is necessary, not sufficient. A checklist lesson named in the consent file stays a
    // nudge: the user consents to enforcement, they do not get to invent enforceability. Without
    // this, editing one JSON file would turn any advisory note into a wall.
    writeStore([blockLesson({ id: 'T05-soft', enforcement: 'checklist', check: null })]);
    writeOptIn(['T05-soft']);
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
  });

  test('a model-inferred lesson can never block, even if named in the consent file', () => {
    // The injection path ADR-031 exists to close. makeLesson already refuses to CONSTRUCT such a
    // lesson at enforcement:block; this asserts the gate refuses to ACT on one regardless, so a
    // future loosening upstream cannot silently open the path.
    writeStore([blockLesson({ id: 'T06-planted', origin: 'model-inferred', enforcement: 'checklist', check: null })]);
    writeOptIn(['T06-planted']);
    const { code, stderr } = runGate(['--event', 'Stop', '--trigger', 'claim-done']);
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('an opted-in BLOCK actually refuses', () => {
  beforeEach(() => { writeStore([blockLesson()]); writeOptIn(['T01-verify-with-a-capable-channel']); });

  test('exits 2 — the only code the harness treats as a refusal', () => {
    // Exit 1 was the original bug: the live doc says any other non-zero is "a non-blocking error...
    // Execution continues." A gate exiting 1 has not blocked anything; it has merely complained.
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(2);
  });

  test('the reason goes to STDERR, because exit 2 discards stdout', () => {
    // "Claude Code ignores stdout and any JSON in it. Instead, stderr text is fed back to Claude as
    // an error message." The original wrote 15 console.log and 0 console.error — the refusal reason
    // was sent to the one stream a refusal cannot use.
    const { stdout, stderr } = runGate(['--event', 'Stop', '--trigger', 'claim-done']);
    expect(stderr).toContain('BLOCKED');
    expect(stderr).toContain('channel capable of observing');
    expect(stdout).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the dispatcher propagates faithfully in BOTH directions', () => {
  test('propagates a block: exit 2 with the reason on stderr', () => {
    // `|| true` plus `exit 0` used to erase this. The dispatcher printed the word BLOCKED and
    // returned ALLOW — the single most misleading state the system could be in.
    writeStore([blockLesson()]);
    writeOptIn(['T01-verify-with-a-capable-channel']);
    const { code, stderr, stdout } = runDispatch('UserPromptSubmit');
    expect(code).toBe(2);
    expect(stderr).toContain('BLOCKED');
    expect(stdout).toBe('');
  });

  test('propagates a nudge: exit 0 with json on stdout', () => {
    writeStore([blockLesson()]);
    const { code, stdout, stderr } = runDispatch('UserPromptSubmit');
    expect(code).toBe(0);
    expect(stderr).toBe('');
    // The event name must match the event the dispatcher was CALLED with — the harness keys on it,
    // and a mismatched name means the context is attached to the wrong event or silently discarded.
    expect(JSON.parse(stdout).hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
  });

  test('never says BLOCKED while returning 0 — the exact shipped defect', () => {
    // The regression test for the headline bug, stated as the invariant rather than the symptom:
    // saying "blocked" and allowing is a lie the product may not tell.
    //
    // THIS ASSERTION WAS WRONG ONCE, and the way it was wrong is worth keeping. It first searched
    // for the literal "⛔ BLOCKED" — a string that occurs in NEITHER version, because the header
    // renders "⚑ BLOCKED" (pennant) while "⛔" only ever prefixes an individual statement line. It
    // therefore passed against the known-broken code, which is the definition of a vacuous test:
    // green, specific-looking, and incapable of observing the failure it named. Caught only by
    // running the suite against the old implementation and noticing this one did not go red.
    writeStore([blockLesson()]);
    const { code, stdout, stderr } = runDispatch('UserPromptSubmit');
    expect(code).toBe(0);
    expect(stdout + stderr).not.toContain('BLOCKED');
  });

  test('an unmapped event stays silent and allows', () => {
    writeStore([blockLesson()]);
    writeOptIn(['T01-verify-with-a-capable-channel']);
    const { code, stdout } = runDispatch('SessionStart');
    expect(code).toBe(0);
    expect(stdout).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('FAILS OPEN on malfunction — but never on a decision', () => {
  test('a corrupt store allows the action', () => {
    fs.writeFileSync(storePath, '{ not json at all');
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
    expect(runDispatch('UserPromptSubmit').code).toBe(0);
  });

  test('a missing store allows the action', () => {
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
  });

  test('an unparseable consent file downgrades to nudge, never up to block', () => {
    // Failing INTO refusal would be the worst possible direction: a typo in a config file would
    // start refusing the user's work with no way to tell why.
    writeStore([blockLesson()]);
    fs.writeFileSync(optInPath, 'nonsense{{{');
    expect(runGate(['--event', 'Stop', '--trigger', 'claim-done']).code).toBe(0);
  });

  test('no lessons at a trigger produces no output at all', () => {
    writeStore([]);
    const { code, stdout, stderr } = runGate(['--event', 'Stop', '--trigger', 'claim-done']);
    expect(code).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('CLI mode stays backward compatible', () => {
  test('plain text on stdout, because version-bump-gate.sh embeds it verbatim', () => {
    // plugin/scripts/version-bump-gate.sh:78 captures this stdout and appends it under
    // "── from your own lesson store ──". Emitting JSON here, or moving it to stderr, would silently
    // empty that section of the only gate in this system that genuinely works.
    writeStore([blockLesson({ id: 'T07-version', trigger: 'ship' })]);
    const { stdout, code } = runGate(['--trigger', 'ship']);
    expect(code).toBe(0);
    expect(stdout).toContain('Verify through');
    expect(() => JSON.parse(stdout)).toThrow();
  });

  test('--json stays machine-readable and reports the consent path', () => {
    writeStore([blockLesson()]);
    const { stdout } = runGate(['--trigger', 'claim-done', '--json']);
    const j = JSON.parse(stdout);
    expect(j.blocking).toEqual([]);
    expect(j.blockCapable).toContain('T01-verify-with-a-capable-channel');
    expect(j.optInPath).toBe(optInPath);
  });

  test('no trigger prints usage and exits 0', () => {
    const { code, stdout } = runGate([]);
    expect(code).toBe(0);
    expect(stdout).toContain('--trigger');
  });
});
