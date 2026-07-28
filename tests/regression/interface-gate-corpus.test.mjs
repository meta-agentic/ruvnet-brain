// tests/regression/interface-gate-corpus.test.mjs — ADR-058 §D7: the seeded regression corpus
// verify-interface.sh never had.
//
// THE DEDUCTION THIS FILE CLOSES (ADR-058 §D7): "the same defect class has now recurred across
// issues #12, #13, #41, #44" — FOUR issues on ONE file (plugin/scripts/verify-interface.sh), each
// fixed by hand, none of them leaving behind a durable, self-checking regression corpus. The
// structural classifier (hook-input.mjs `commandNodes()`/`invocations`) landed 2026-07-27 and MATCH_RE
// is genuinely gone — verified by reading verify-interface.sh before writing a line of this file.
// What did not land is the corpus that PROVES a fifth recurrence would be caught. This is that corpus.
//
// WHY EVERY CASE FIRES `node plugin/scripts/hook-shim.mjs verify-interface`, NEVER THE .sh BODY
// DIRECTLY (the "adjacent-door" defect, ADR-055 F16, recorded in scripts/selfcheck.mjs,
// scripts/hook-registry.mjs and tests/unit/selfcheck-battery.test.mjs): hooks.json registers
// `node "${CLAUDE_PLUGIN_ROOT}/scripts/hook-shim.mjs" verify-interface` — never the .sh directly.
// tests/unit/verify-interface.test.mjs spawns `bash plugin/scripts/verify-interface.sh`, which is a
// perfectly good way to unit-test the classifier in isolation, but it is NOT the path a real Claude
// Code session ever executes: the shim resolves an active spine generation (or falls back to the
// frozen plugin tree) before the body ever runs. A corpus that only ever fires the body cannot prove
// the REGISTERED command behaves the same way — proving the classifier and proving the product are
// two different claims, and this repo has already shipped the gap between them once. Every case below
// goes through the shim, exactly as a real PreToolUse hook fire does.
//
// THE FIVE FORMS, READ VERBATIM FROM verify-interface.sh BEFORE WRITING A SINGLE CASE (per the task
// brief's own instruction — "read lines ~80-125 first, use those forms, do not invent your own"):
//   #44 (verify-interface.sh:87-89), the three reporter escapes, copied character for character:
//       bash -lc 'ruflo memory search -q x'
//       x=`ruflo memory search -q x`
//       printf '%s\n' "$(ruflo memory search -q x)"
//   #41 (verify-interface.sh:71-75): a shell separator INSIDE quotes is content, never a real
//       boundary — `grep -E "foo|ruflo init" file.txt` must never block on the `|`.
//   #12 (verify-interface.sh:44-54): a tool's name inside ordinary prose (a commit message) is not
//       command position.
//   #13 (verify-interface.sh:34-42): a JSON-escaped embedded quote must not truncate or otherwise
//       corrupt the parse — the payload must be read in full and classified correctly regardless.
//   2026-07-27 heredoc bite (verify-interface.sh:117-120): a heredoc BODY line opening with a tool
//       name is DATA, never command position.
//
// CI CONSTRAINT (2 vCPU vs this machine's 16): subprocess-heavy suites here have been starved twice
// tonight, coming back with EMPTY stdout/stderr that a naive check would misread as "allowed" (empty
// == nothing blocked == pass, is the exact wrong inference). So: (a) every subprocess call carries a
// generous, explicit timeout sized for a starved runner, not this machine; (b) every assertion checks
// the ACTUAL EXIT CODE and, for BLOCK, the ACTUAL DECISION TEXT — never emptiness as a stand-in for a
// verdict. A starved/timed-out call reports `status: null`, which matches neither 0 nor 2 and therefore
// FAILS LOUD, exactly as a real miss should — starvation can never quietly read as a pass here.
//
// TWO MUTANT DIRECTIONS ARE MANDATORY, NOT ONE (ADR-058 §D7, "four of the five incidents were false
// positives; a corpus that only catches misses recreates the one-sided fix pattern"):
//   FN — commandNodes() stops recursing into `bash -lc` payloads → the #44 BLOCK cases sail through
//        (ALLOW where BLOCK is required) → this corpus goes red.
//   FP — commandNodes() starts treating a single-quoted `$( … )` as live (single quotes must SUPPRESS
//        substitution) → the single-quote ALLOW case below starts blocking → this corpus goes red.
// Both were applied by hand against a real checkout, the real failing vitest output was captured, and
// the patch was reverted before this file was committed. The verbatim transcripts are recorded in
// PROGRESS.md / the commit message for this change, not pasted inline here, to keep this file the
// thing that runs rather than a transcript of a thing that once ran.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const SHIM = path.join(REPO, 'plugin/scripts/hook-shim.mjs');
const hasBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

// Generous for a starved 2 vCPU GitHub runner. Measured on this 16-core machine: a single
// fire() round-trip (node -> spawns bash -> verify-interface.sh -> node hook-input.mjs) completes in
// well under 500ms. 25s per subprocess leaves real headroom under the 30s per-test ceiling below,
// which itself sits above vitest.config.mjs's file-wide default (20s POSIX) specifically because this
// file's whole job is subprocess timing under contention, not because the logic is slow.
const SPAWN_TIMEOUT_MS = 25_000;
const TEST_TIMEOUT_MS = 30_000;

/**
 * Fire the LITERAL REGISTERED COMMAND for the verify-interface hook: `node hook-shim.mjs
 * verify-interface`, real event JSON on stdin — never plugin/scripts/verify-interface.sh directly
 * (ADR-055 F16). No RUVNET_BRAIN_HOME / CLAUDE_PLUGIN_ROOT override: with a fresh, empty HOME the
 * shim finds no dev.json/active.json, so it falls back — quietly, per its own contract — to running
 * the REAL plugin/scripts/verify-interface.sh from this checkout. That is the honest first-install /
 * dev-checkout shape, and it is the same body every existing unit test already exercises directly.
 */
function fire(command, { home } = {}) {
  const h = home || fs.mkdtempSync(path.join(os.tmpdir(), 'igc-'));
  fs.mkdirSync(path.join(h, '.claude/model-router'), { recursive: true });
  fs.writeFileSync(path.join(h, '.claude/model-router/profile.json'), '{}'); // opt-in, like every other gate here
  const r = spawnSync(process.execPath, [SHIM, 'verify-interface'], {
    cwd: REPO,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env: { ...process.env, HOME: h },
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  });
  return { status: r.status, signal: r.signal, error: r.error, stderr: r.stderr || '', stdout: r.stdout || '', home: h };
}

/**
 * Assert a verdict from the ACTUAL EXIT CODE (2 = BLOCK, 0 = ALLOW) plus, for BLOCK, the ACTUAL
 * DECISION TEXT — never from stdout/stderr emptiness. A starved runner reports `status: null` (or a
 * timeout `error`), which is neither 0 nor 2, so it fails this assertion LOUDLY instead of being
 * absorbed as "nothing blocked, so it must have been allowed."
 */
function expectVerdict(cmd, verdict, opts) {
  const r = fire(cmd, opts);
  const want = verdict === 'BLOCK' ? 2 : 0;
  const diag = [
    `cmd=${JSON.stringify(cmd)}`,
    `expected ${verdict} (exit ${want})`,
    `got exit=${r.status} signal=${r.signal || ''}`,
    r.error ? `spawnError=${r.error.message}` : '',
    `stderr=${r.stderr}`,
  ].filter(Boolean).join(' | ');
  expect(r.status, diag).toBe(want);
  if (verdict === 'BLOCK') {
    expect(r.stderr, `BLOCK must carry the reason text, not just the exit code | ${diag}`)
      .toMatch(/BLOCKED — you have not read the interface/);
  }
  return r;
}

// ── The checked-in incident list — the completeness section below FAILS if any of these has zero
//    cases in CASES. This is the ADR's own requirement: "the suite fails if any listed incident has
//    zero cases," not a comment promising it does.
const INCIDENTS = ['#12', '#13', '#41', '#44', '2026-07-27-heredoc'];

// MUST-BLOCK: the three #44 escapes, copied verbatim from verify-interface.sh:87-89 (see header).
const BLOCK_CASES = [
  ['#44', 'literal bash -lc payload (reporter case 1)', "bash -lc 'ruflo memory search -q x'"],
  ['#44', 'backtick substitution (reporter case 2)', 'x=`ruflo memory search -q x`'],
  ['#44', "$() inside double quotes via printf (reporter case 3)", 'printf \'%s\\n\' "$(ruflo memory search -q x)"'],
];

// MUST-ALLOW.
const ALLOW_CASES = [
  // #41 (verify-interface.sh:65-75): a `|` INSIDE a quoted grep pattern is content, not a real
  // pipeline separator. This is the reporter's own case, named verbatim in the ADR.
  ['#41', 'grep -E alternation before a tool name, inside quotes', 'grep -E "foo|ruflo init" file.txt'],
  // #12 (verify-interface.sh:44-54): a tool's name inside ordinary prose — a commit MESSAGE — is not
  // command position. The exact shape of the real user report (a git commit blocked mid-session).
  ['#12', 'commit message mentions a tool name in prose, not as a command', 'git commit -m "explained how ruflo memory search returns results for this query"'],
  // #13 (verify-interface.sh:34-42): a JSON-escaped embedded quote must not corrupt the parse. This
  // command contains a literal escaped quote pair inside the -m argument AND mentions a tool name in
  // prose — the old bash-regex field() truncated at the FIRST quote, so a naive fix could easily
  // re-introduce a wrong classification here without anyone noticing (the truncated fragment might
  // "happen" to parse as something else). Full, correct JSON parsing must still find no invocation.
  ['#13', 'commit message with escaped embedded quotes, JSON-round-tripped', 'git commit -m "fix \\"quoted\\" edge case in ruflo memory search parsing"'],
  // 2026-07-27 heredoc bite (verify-interface.sh:117-120): a heredoc BODY line opening with a tool
  // name is DATA. `agentic-qe` is itself in the managed TOOLS list, so this is meaningful, not vacuous.
  ['2026-07-27-heredoc', 'heredoc body opens with a managed tool name (quoted delimiter)', "cat <<'EOF'\nagentic-qe integration plan\nEOF"],
  // The FP-mutant probe (verify-interface.sh:108-109 / hook-input.mjs's single-quote branch): single
  // quotes must SUPPRESS substitution — a `$( … )` written inside single quotes is literal text, never
  // a live command node. This is the exact boundary the #44 fix's recursion sits next to (widening
  // recursion into `$( … )` must not also start recursing into single-quoted text), which is why it is
  // filed under #44 rather than invented as a sixth incident.
  ['#44', 'single-quoted $() is literal text, never live (the FP-mutant probe)', "printf '%s' '$(ruflo memory search -q x)'"],
];

const CASES = [
  ...BLOCK_CASES.map(([incident, label, cmd]) => ({ incident, verdict: 'BLOCK', label, cmd })),
  ...ALLOW_CASES.map(([incident, label, cmd]) => ({ incident, verdict: 'ALLOW', label, cmd })),
];

describe('interface-gate-corpus — completeness (a corpus that cannot fail is not a corpus)', () => {
  it('every case actually cites an incident — no bare, untraceable case', () => {
    for (const c of CASES) {
      expect(c.incident, `case ${JSON.stringify(c.label)} has no incident citation`).toBeTruthy();
    }
  });

  for (const inc of INCIDENTS) {
    it(`incident ${inc} has at least one seeded case`, () => {
      const n = CASES.filter((c) => c.incident === inc).length;
      expect(n, `incident ${inc} has ZERO cases in CASES — the corpus is not actually seeded for it`).toBeGreaterThan(0);
    });
  }
});

describe.skipIf(!hasBash || process.platform === 'win32')(
  'interface-gate-corpus — MUST-BLOCK, fired through the registered hook-shim path',
  () => {
    it.each(BLOCK_CASES)('%s: %s: %s', (incident, _label, cmd) => {
      expectVerdict(cmd, 'BLOCK');
    }, TEST_TIMEOUT_MS);
  },
);

describe.skipIf(!hasBash || process.platform === 'win32')(
  'interface-gate-corpus — MUST-ALLOW, fired through the registered hook-shim path',
  () => {
    it.each(ALLOW_CASES)('%s: %s: %s', (incident, _label, cmd) => {
      expectVerdict(cmd, 'ALLOW');
    }, TEST_TIMEOUT_MS);
  },
);
