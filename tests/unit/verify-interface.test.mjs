// tests/unit/verify-interface.test.mjs — the gate that stops me guessing at a CLI's flags.
//
// WHY (2026-07-13). Stuart: "Why are you still so fascinated with efficiency that you won't take the
// split second to check you're making the call the right way? EFFECTIVE WINS OVER EFFICIENCY EVERY
// SINGLE TIME. Stop skipping steps. You are destroying your credibility."
//
// He is describing a mechanical defect, not a mood. I reported AgentDB BROKEN THREE TIMES. It was
// never broken:
//   1. I called `ruflo memory search "query"` POSITIONALLY. The CLI wants `-q`. Empty result → I
//      declared the product broken to his face.
//   2. My canary test then "failed" because MY OWN grep filtered the rows out.
//   3. My broken-state test printed nothing because I set the test up wrong.
// Every one was MY defect, reported as a PRODUCT defect. Cost: hours of his time, and his trust.
//
// THE GAP: the brain holds 2GB of rUv's SOURCE. It does NOT hold a compiled CLI's runtime flags —
// `-q` lives in `--help` output, not in the indexed corpus. I ground FACTS in the brain and never
// ground INTERFACES in the tool. A rule would not fix that (I ignored rules all night). A wall does.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GATE = path.resolve(import.meta.dirname, '../../plugin/scripts/verify-interface.sh');
const hasBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

function run(command, { optedIn = true, home = null } = {}) {
  const h = home || fs.mkdtempSync(path.join(os.tmpdir(), 'vi-'));
  if (optedIn) {
    fs.mkdirSync(path.join(h, '.claude/model-router'), { recursive: true });
    fs.writeFileSync(path.join(h, '.claude/model-router/profile.json'), '{}');
  }
  const r = spawnSync('bash', [GATE], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env: { ...process.env, HOME: h },
    encoding: 'utf8',
  });
  return { status: r.status, stderr: r.stderr || '', home: h };
}

describe.skipIf(!hasBash || process.platform === 'win32')('verify-interface.sh — you may not call a tool whose interface you have not read', () => {
  it('BLOCKS the EXACT call that started this: ruflo memory search, with the help unread', () => {
    const r = run('npx ruflo@latest memory search -q test');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/BLOCKED — you have not read the interface/);
    expect(r.stderr).toMatch(/ruflo memory search --help/); // it tells me EXACTLY what to run
  });

  it('ALWAYS allows reading the help — and records it, so the next call goes through', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-'));
    expect(run('npx ruflo@latest memory search --help', { home }).status).toBe(0);
    // My FIRST version used a different (weaker) regex on the help-recording path — it did not absorb
    // `@latest`, so nothing was recorded and the next call was STILL blocked. The break-test caught it.
    // Two regexes for one concept is how you get a gate that never opens.
    expect(run('npx ruflo@latest memory search -q test', { home }).status).toBe(0);
  });

  it('granularity matches the mistake: reading `memory search` help does NOT unlock `memory distill`', () => {
    // `ruflo memory --help` lists subcommands but never shows search's `-q` — the exact flag I guessed
    // wrong. So the stamp must be per-subcommand, not per-tool.
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-'));
    run('npx ruflo@latest memory search --help', { home });
    expect(run('npx ruflo@latest memory distill run', { home }).status).toBe(2);
  });

  it('does NOT tax ordinary work — a gate that annoys you gets switched off, and then protects nothing', () => {
    for (const cmd of ['git status', 'npm test', 'ls -la', 'node scripts/falsify.mjs', 'sqlite3 db "SELECT 1"']) {
      expect(run(cmd).status, `${cmd} must pass untouched`).toBe(0);
    }
  });

  it('never touches a user who did not opt in — consent is the default', () => {
    expect(run('npx ruflo@latest memory search -q test', { optedIn: false }).status).toBe(0);
  });

  it('FAILS OPEN on garbage — a blocking hook must never brick a session', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-'));
    fs.mkdirSync(path.join(home, '.claude/model-router'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude/model-router/profile.json'), '{}');
    const r = spawnSync('bash', [GATE], { input: 'not json', env: { ...process.env, HOME: home }, encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('uses BASH BUILTINS ONLY — no python3/jq/cat: a hook that can BLOCK must depend on nothing', () => {
    const src = fs.readFileSync(GATE, 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    for (const bin of ['python3', 'jq', '$(cat', '| grep', '| sed']) {
      expect(src, `verify-interface.sh must not depend on ${bin}`).not.toContain(bin);
    }
    // MATCH_RE (which CLI, which subcommand) is still bash regex — only JSON payload parsing moved
    // to node (issue #13). BASH_REMATCH must still be how the tool/subcommand are captured.
    expect(src).toMatch(/BASH_REMATCH/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Regression tests for issues #12 and #13 (github.com/stuinfla/ruvnet-brain), filed by a real user
// this gate blocked mid-session — including a `git commit` whose message merely mentioned a tool
// name. Both issues are about the SAME gate but different layers: #13 is what the gate is GIVEN
// (payload parsing), #12 is what it MATCHES against once it has the real command.
describe.skipIf(!hasBash || process.platform === 'win32')('verify-interface.sh — issue #13: JSON payload parsing, not a truncating regex', () => {
  it('quoted commands parse in full: a real invocation AFTER a quoted argument is still seen and blocked', () => {
    // The OLD field() regex — "([^"]*)" — cannot cross a `"`, and a JSON-escaped `\"` still contains
    // a literal `"` byte in the raw text. So `field(command)` on this payload used to truncate at the
    // very first quote, capturing only `echo ` — the entire tail, including the real `ruflo memory
    // search` invocation after `&&`, was NEVER SEEN by the gate. That is issue #13's false negative:
    // the exact call this gate exists to catch sailed through unchecked. With real JSON parsing the
    // full string survives, and the invocation after `&&` is still at command position (issue #12's
    // anchor), so it correctly blocks.
    const r = run('echo "a quoted note" && ruflo memory search -q x');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/BLOCKED — you have not read the interface for: ruflo memory search/);
  });

  it('malformed JSON (truncated, not just non-JSON garbage) FAILS OPEN, not just totally-invalid input', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vi-'));
    fs.mkdirSync(path.join(home, '.claude/model-router'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude/model-router/profile.json'), '{}');
    const truncated = '{"tool_name":"Bash","tool_input":{"command":"ruflo memory search';
    const r = spawnSync('bash', [GATE], { input: truncated, env: { ...process.env, HOME: home }, encoding: 'utf8' });
    expect(r.status).toBe(0);
  });
});

describe.skipIf(!hasBash || process.platform === 'win32')('verify-interface.sh — issue #12: word-boundary command-position matching, and a working override', () => {
  it('does NOT block a different binary that merely shares a hyphenated prefix: ruflo-source-patch', () => {
    // The OLD version-suffix class `[@a-z0-9.-]*` absorbed an arbitrary hyphenated tail, not just
    // `@latest` — so `ruflo-source-patch adr-index status` (a DIFFERENT binary, its own CLI) was
    // misread as `ruflo` with subcommand `adr-index status`, and the gate demanded `ruflo adr-index
    // status --help` — a command that does not exist. The fix requires an explicit `@` for the
    // version suffix, so `ruflo-source-patch` no longer matches `ruflo` at all.
    const r = run('ruflo-source-patch adr-index status');
    expect(r.status).toBe(0);
  });

  it('does NOT block prose that merely mentions a tool name — it is not at command position', () => {
    const r = run('git commit -m "explained how ruflo memory search returns results for this query"');
    expect(r.status).toBe(0);
  });

  it('DOES block a real, direct invocation of the exact gated CLI with no --help read', () => {
    const r = run('ruflo memory search -q x');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/BLOCKED — you have not read the interface for: ruflo memory search/);
    expect(r.stderr).toMatch(/ruflo memory search --help/);
  });

  it('the documented override actually works: RUVNET_SKIP_INTERFACE_CHECK=1 prefixed on the command', () => {
    // The OLD check read `RUVNET_SKIP_INTERFACE_CHECK` from the HOOK PROCESS's own environment — but
    // a PreToolUse hook only ever receives the proposed command as JSON on stdin and never executes
    // it, so setting the var "on the command" (exactly what the block message instructed) had zero
    // effect. The fix checks the COMMAND STRING itself for the token.
    const r = run('RUVNET_SKIP_INTERFACE_CHECK=1 ruflo memory search -q x');
    expect(r.status).toBe(0);
  });

  it('the block message documents an override that actually works, on the command string', () => {
    const r = run('ruflo memory search -q x');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/RUVNET_SKIP_INTERFACE_CHECK=1 ruflo memory search/);
  });

  it('still recognizes a real npx-wrapped invocation as command position (no regression)', () => {
    const r = run('npx ruflo@latest memory search -q test');
    expect(r.status).toBe(2);
  });
});
