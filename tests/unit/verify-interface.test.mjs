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
    expect(src).toMatch(/BASH_REMATCH/);
  });
});
