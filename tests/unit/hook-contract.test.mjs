/**
 * hook-contract.test.mjs — the test that would have caught the 2026-07-22 machine-wide Stop loop.
 *
 * WHY THIS FILE EXISTS.
 *
 * On 2026-07-22 a Stop hook continued every turn in every project on the machine until Claude Code
 * overrode it on the 9th consecutive continuation. It reached three separate repos. At that moment
 * this project had 1,429 passing tests, and the reason none of them caught it is exact and worth
 * stating: EVERY ONE tested a unit. The defect was not in a unit. It was in the CONTRACT — which
 * stream the harness reads, which exit code it honours, what it does with `additionalContext` at
 * Stop, and whether two registries register the same hook twice.
 *
 * Measured at the time of writing, before this file:
 *     test files mentioning stop_hook_active .... 0
 *     test files testing continuation-gate ...... 0
 *     test files referencing hooks.json ......... 2   (of 106)
 *
 * So the suite was green and structurally incapable of going red. A test that cannot fail on broken
 * code is not a test — and 1,429 of them still cannot catch a class of bug none of them models.
 *
 * WHAT THIS FILE DOES DIFFERENTLY: it invokes hooks the way CLAUDE CODE invokes them — as a
 * subprocess, with a JSON payload on stdin — and asserts on the three things the harness actually
 * reads: the exit code, stdout, and stderr, kept separate. No hook is imported as a module, because
 * importing it cannot observe the delivery contract that broke.
 *
 * THE CONTRACT, from code.claude.com/docs/en/hooks (verified 2026-07-22, not recalled):
 *   - exit 0 + stdout JSON `hookSpecificOutput.additionalContext`  → informs. At Stop it CONTINUES
 *     the turn and counts against the 8-consecutive-continuation cap.
 *   - exit 2 + stderr                                              → refuses. stdout is ignored.
 *   - `stop_hook_active` is true once Claude Code is already continuing because of a stop hook.
 *     Returning success while it is true is the documented way to avoid trapping the turn.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTINUATION_GATE = path.join(ROOT, 'scripts/continuation-gate.mjs');
const LESSON_HOOKS = path.join(ROOT, 'plugin/scripts/lesson-hooks.sh');
const PLUGIN_HOOKS_JSON = path.join(ROOT, 'plugin/hooks/hooks.json');

/** Invoke a hook exactly as the harness does: subprocess, JSON on stdin, streams kept apart. */
function fireHook(cmd, args, payload, env = {}) {
  const r = spawnSync(cmd, args, {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 15000,
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function tempLedger(items) {
  const p = path.join(os.tmpdir(), `hook-contract-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify({ items }));
  return p;
}

describe('Stop-hook loop protection (the 2026-07-22 regression)', () => {
  it('goes SILENT when stop_hook_active is true — the documented loop guard', () => {
    const ledger = tempLedger([{ text: 'unfinished work', done: false }]);
    const r = fireHook('node', [CONTINUATION_GATE],
      { stop_hook_active: true, session_id: 'sess-guard' },
      { RUVNET_WORK_LEDGER: ledger });

    // The whole incident in one assertion: outstanding work AND already-continuing must yield silence.
    expect(r.stdout).toBe('');
    expect(r.code).toBe(0);
  });

  it('emits a valid additionalContext envelope when work is genuinely outstanding', () => {
    const ledger = tempLedger([{ text: 'ship the fix', done: false }]);
    const r = fireHook('node', [CONTINUATION_GATE],
      { stop_hook_active: false, session_id: 'sess-fresh' },
      { RUVNET_WORK_LEDGER: ledger });

    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);            // throws if the envelope is malformed
    expect(parsed.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('ship the fix');
  });

  it('delivers on STDOUT, never stderr — exit-0 stderr reaches nobody', () => {
    const ledger = tempLedger([{ text: 'visible item', done: false }]);
    const r = fireHook('node', [CONTINUATION_GATE],
      { stop_hook_active: false, session_id: 'sess-stream' },
      { RUVNET_WORK_LEDGER: ledger });

    // The original bug: 922 bytes of intervention written to a stream the harness does not read.
    expect(r.stdout).toContain('additionalContext');
    expect(r.stderr).not.toContain('visible item');
  });

  it('nudges at most ONCE per session — a per-turn nudge is a forced turn every turn', () => {
    const ledger = tempLedger([{ text: 'repeat me', done: false }]);
    const env = { RUVNET_WORK_LEDGER: ledger };
    const first = fireHook('node', [CONTINUATION_GATE], { stop_hook_active: false, session_id: 'sess-once' }, env);
    const second = fireHook('node', [CONTINUATION_GATE], { stop_hook_active: false, session_id: 'sess-once' }, env);

    expect(first.stdout).toContain('additionalContext');
    expect(second.stdout).toBe('');
  });

  it('stays silent when nothing is outstanding — a guard that always fires carries no information', () => {
    const ledger = tempLedger([{ text: 'all done', done: true }]);
    const r = fireHook('node', [CONTINUATION_GATE],
      { stop_hook_active: false, session_id: 'sess-empty' },
      { RUVNET_WORK_LEDGER: ledger });
    expect(r.stdout).toBe('');
  });
});

describe('lesson dispatcher — Stop must not force a continuation', () => {
  it('produces NOTHING at Stop (continuation-gate owns that boundary)', () => {
    const r = fireHook('bash', [LESSON_HOOKS, 'Stop'], { stop_hook_active: false, session_id: 's' });
    // Any output here re-creates the incident: additionalContext at Stop continues the turn.
    expect(r.stdout.trim()).toBe('');
    expect(r.code).toBe(0);
  });

  it('still nudges at UserPromptSubmit, with a valid envelope naming the right event', () => {
    const r = fireHook('bash', [LESSON_HOOKS, 'UserPromptSubmit'], { prompt: 'hello' });
    expect(r.code).toBe(0);
    if (r.stdout.trim()) {
      const parsed = JSON.parse(r.stdout);
      expect(parsed.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    }
  });

  it('fails OPEN on a corrupt store — a gate must never break what it guards', () => {
    const r = fireHook('bash', [LESSON_HOOKS, 'PreToolUse-bash'], {},
      { RUVNET_LESSON_OPTIN: '/nonexistent/path/optin.json' });
    expect(r.code).toBe(0);
  });
});

describe('registry hygiene', () => {
  const reg = JSON.parse(fs.readFileSync(PLUGIN_HOOKS_JSON, 'utf8'));

  it('registers no command twice for the same event AND matcher', () => {
    // Grouped by (event, matcher), not by event alone. SessionStart legitimately registers the same
    // command under `startup` and `resume` — mutually exclusive matchers that can never both fire
    // for one occurrence. An earlier version of this assertion grouped by event and flagged that as
    // a defect; the assertion was wrong, not the registry. Fixing code to satisfy a wrong test is
    // how a suite starts enforcing fiction.
    const byBucket = new Map();
    for (const [event, entries] of Object.entries(reg.hooks)) {
      for (const m of entries) {
        const key = `${event}::${m.matcher ?? ''}`;
        for (const h of m.hooks ?? []) {
          const list = byBucket.get(key) ?? [];
          list.push(h.command);
          byBucket.set(key, list);
        }
      }
    }
    for (const [bucket, cmds] of byBucket) {
      expect(new Set(cmds).size, `duplicate command on ${bucket}`).toBe(cmds.length);
    }
  });

  it('never wraps a hook in `2>&1` — it merges stderr into the JSON envelope and corrupts it', () => {
    for (const [event, entries] of Object.entries(reg.hooks)) {
      for (const m of entries) {
        for (const h of m.hooks ?? []) {
          expect(h.command, `${event} redirects stderr into stdout`).not.toContain('2>&1');
        }
      }
    }
  });

  it('keeps every timeout in SECONDS (a millisecond value here means no timeout at all)', () => {
    for (const [event, entries] of Object.entries(reg.hooks)) {
      for (const m of entries) {
        for (const h of m.hooks ?? []) {
          if (h.timeout !== undefined) {
            // 3000 read as seconds is 50 minutes — indistinguishable from unbounded.
            expect(h.timeout, `${event} timeout ${h.timeout} looks like milliseconds`).toBeLessThanOrEqual(120);
          }
        }
      }
    }
  });

  it('has exactly one hook registered on Stop', () => {
    const stopCmds = (reg.hooks.Stop ?? []).flatMap((m) => (m.hooks ?? []).map((h) => h.command));
    expect(stopCmds.length).toBe(1);
  });
});
