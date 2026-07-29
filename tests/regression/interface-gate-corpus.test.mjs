import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const SHIM = path.join(REPO, 'plugin/scripts/hook-shim.mjs');
const hasBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

const CASES = [
  ['#44 literal bash payload', "bash -lc 'ruflo memory search -q x'"],
  ['#44 backtick substitution', 'x=`ruflo memory search -q x`'],
  ['#44 double-quoted substitution', 'printf \'%s\\n\' "$(ruflo memory search -q x)"'],
  ['#41 separator inside quotes', 'grep -E "foo|ruflo init" file.txt'],
  ['#12 prose mention', 'git commit -m "explained how ruflo memory search returns results"'],
  ['#13 embedded escaped quotes', 'git commit -m "fix \\"quoted\\" edge case in ruflo parsing"'],
  ['heredoc body', "cat <<'EOF'\nagentic-qe integration plan\nEOF"],
  ['single-quoted substitution', "printf '%s' '$(ruflo memory search -q x)'"],
  ['direct invocation', 'ruflo memory search -q x'],
  ['npx invocation', 'npx ruflo@latest memory search -q x'],
  ['pipeline invocation', 'echo hi | ruflo memory search -q x'],
  ['dynamic executable', '$TOOL memory search -q x'],
];

function fire(command) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'igc-'));
  fs.mkdirSync(path.join(home, '.claude/model-router'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude/model-router/profile.json'), '{}');
  return spawnSync(process.execPath, [SHIM, 'verify-interface'], {
    cwd: REPO,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
    timeout: 25_000,
  });
}

describe.skipIf(!hasBash || process.platform === 'win32')(
  'interface advisory corpus — every historical raw-shell shape stays non-blocking',
  () => {
    it.each(CASES)('%s: %s', (_label, command) => {
      const result = fire(command);
      expect(result.status, `raw Bash must never be blocked: ${command}\n${result.stderr}`).toBe(0);
      expect(result.stderr).not.toMatch(/BLOCKED/);
    }, 30_000);
  },
);
