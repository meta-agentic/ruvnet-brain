#!/usr/bin/env node
// scripts/ci/learning-replay-recorder.mjs — the ARTIFACT TAP for the D4 counterfactual replay.
//
// Registered as a PreToolUse(Bash) hook inside a fixture session (never in a user's settings). Its
// whole job is to capture the command the agent PRODUCED — the artifact the trap's oracle parses —
// and to stop it from ever executing, because a fixture agent must not run anything on a real
// machine and must not be allowed to LEARN the answer from a CLI's own output mid-run (a `--help`
// that reveals the flag would contaminate the control arm and turn a measurable difference into an
// unmeasurable one).
//
// It writes one JSON line per attempt, in order, with a monotonic timestamp. Order is the evidence
// for PASS-condition (a): the lesson must be in the transcript BEFORE the first of these lines.
//
// The payload is parsed by plugin/scripts/hook-input.mjs — the repo's ONE hook-envelope translator
// (DDD-0013's anti-corruption boundary against Claude Code's hook contract). Never a bash regex,
// never a hand-rolled JSON.parse of an envelope shape, for the reason that file already records:
// a JSON-escaped quote silently truncated a command in this exact codebase.
//
// Exit 2 + stderr is the documented BLOCK contract. Blocking is the point: the artifact is what the
// agent WOULD have run, and letting it run would both mutate the machine and feed the agent an
// answer the trap is trying to measure it for already having.
//
// Usage (as a hook):  node scripts/ci/learning-replay-recorder.mjs <attempts.jsonl>

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK_INPUT = path.resolve(HERE, '..', '..', 'plugin', 'scripts', 'hook-input.mjs');
const out = process.argv[2];
const sequenceOut = process.argv[3];

let payload = '';
try { payload = fs.readFileSync(0, 'utf8'); } catch { payload = ''; }

let command = '';
const r = spawnSync(process.execPath, [HOOK_INPUT, 'command'], { input: payload, encoding: 'utf8' });
if (r.status === 0) command = String(r.stdout || '').trim();

const atNs = process.hrtime.bigint().toString();
if (out) {
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.appendFileSync(out, JSON.stringify({ at: Date.now(), atNs, command }) + '\n');
  } catch { /* a recorder that cannot write must still block; a silent run is worse than a lost line */ }
}
if (sequenceOut) {
  try {
    fs.mkdirSync(path.dirname(sequenceOut), { recursive: true });
    fs.appendFileSync(sequenceOut, JSON.stringify({ kind: 'tool', atNs, command }) + '\n');
  } catch { /* blocking still wins over a missing receipt */ }
}

// stderr is the channel exit 2 feeds back to the model (stdout is ignored on 2). Terse on purpose:
// a long refusal is itself context, and this fixture is measuring what the agent brings IN.
process.stderr.write('Sandbox: commands are not executed here. Your command was recorded. Do not retry; state your answer.\n');
process.exit(2);
