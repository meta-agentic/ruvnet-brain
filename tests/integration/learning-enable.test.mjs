/**
 * learning-enable.mjs — guards the answer to "is rUv learning actually on?"
 *
 * Context (2026-07-21): the headline finding of the night was "26 learning hooks installed, ZERO
 * enabled — learning is off." It was read off `ruflo hooks list`, and it was false. That table's
 * "Enabled" column is a field-name bug: the MCP handler returns a hardcoded `status: "active"` and
 * no `enabled` key at all, so the renderer prints "No" 26 times regardless of anything. Meanwhile
 * the real learner had 457 trajectories and 457 patterns, last adapted 67 minutes earlier.
 *
 * This repo has already shipped one detector that reported a misleading state. These are therefore
 * SAFETY tests, not happy-path tests. The properties held here are the ones whose violation would
 * make the tool lie:
 *
 *   1. A missing learner file reports "not checked" — NEVER 0. ("0 patterns" claims the learner ran
 *      and learned nothing; that is a different, false statement.)
 *   2. Real counters produce ON, and the numbers rendered are the ones in the file.
 *   3. Fresh-machine (empty HOME) renders honestly instead of crashing or inventing a state.
 *   4. --enable and --disable REFUSE, and — the blast-radius property — write nothing at all.
 *      settings.json must be byte-identical afterwards.
 *   5. Absence of ruflo hooks in settings.json is never treated as "learning is off", because on
 *      the real machine that count was 0 while learning was demonstrably running.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'learning-enable.mjs');

let home;
beforeEach(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-enable-')); });
afterEach(() => { fs.rmSync(home, { recursive: true, force: true }); });

/** Run the CLI against a temp HOME so no test can ever touch the real ~/.claude. */
function run(args = []) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, HOME: home },
  });
  return { out: `${r.stdout || ''}${r.stderr || ''}`, json: r.stdout, code: r.status };
}

function seedLearner({ trajectories = 457, patterns = 457, ageMs = 60 * 60 * 1000 } = {}) {
  const dir = path.join(home, '.claude-flow', 'neural');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify({
    trajectoriesRecorded: trajectories,
    patternsLearned: patterns,
    signalsProcessed: 2,
    lastAdaptation: Date.now() - ageMs,
  }));
}

function seedSettings(hooks = {}) {
  const dir = path.join(home, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({ hooks }, null, 2));
  return p;
}

describe('learning-enable --status', () => {
  it('reports "not checked" — never 0 — when there is no learner file', () => {
    const { out, code } = run(['--status']);

    expect(code).toBe(0);
    expect(out).toMatch(/NOT LEARNING YET/);
    expect(out).toMatch(/patterns learned\s*:\s*not checked/);
    expect(out).toMatch(/trajectories recorded\s*:\s*not checked/);
    // The exact failure mode being guarded: a confident zero where we simply never looked.
    expect(out, 'absence must never be rendered as a measured 0').not.toMatch(/patterns learned\s*:\s*0\b/);
  });

  it('derives ON from real counters, and renders the numbers that are actually in the file', () => {
    seedLearner({ trajectories: 457, patterns: 457 });

    const { out, code } = run(['--status']);

    expect(code).toBe(0);
    expect(out).toMatch(/ON — the learner is accumulating/);
    expect(out).toMatch(/trajectories recorded\s*:\s*457/);
    expect(out).toMatch(/patterns learned\s*:\s*457/);
  });

  it('does NOT conclude "off" from an empty settings.json — the real machine was learning with 0 wired', () => {
    seedLearner();
    seedSettings({});

    const { out } = run(['--status']);

    expect(out).toMatch(/ON — the learner is accumulating/);
    expect(out, 'the count must be shown as explicitly not required').toMatch(/NOT required/i);
  });

  it('calls a week-stale learner IDLE rather than ON or OFF', () => {
    seedLearner({ ageMs: 30 * 86400000 });

    const { out } = run(['--status']);

    expect(out).toMatch(/IDLE — learned before/);
    expect(out).toMatch(/nothing in 30 days/);
  });

  it('distinguishes an initialised-but-empty learner from a missing one', () => {
    seedLearner({ trajectories: 0, patterns: 0, ageMs: 0 });

    const { out } = run(['--status']);

    expect(out).toMatch(/INITIALISED BUT EMPTY/);
  });

  it('reports UNKNOWN (not off, not on) when the learner file is corrupt', () => {
    const dir = path.join(home, '.claude-flow', 'neural');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'stats.json'), '{not json');

    const { out } = run(['--status']);

    expect(out).toMatch(/UNKNOWN/);
    expect(out, 'unreadable is not the same as empty').not.toMatch(/INITIALISED BUT EMPTY/);
  });

  it('renders honestly on a completely fresh machine (empty HOME, nothing installed)', () => {
    const { out, code } = run([]);

    expect(code, 'empty-first must be a normal report, not an error').toBe(0);
    expect(out).toMatch(/rUv learning — actual state/);
    expect(out).toMatch(/not checked/);
  });

  it('warns that the `ruflo hooks list` Enabled column is not evidence', () => {
    seedLearner();

    const { out } = run(['--status']);

    expect(out).toMatch(/Not evidence/);
    expect(out).toMatch(/field-name bug/);
  });

  it('emits machine-readable state with --json', () => {
    seedLearner({ trajectories: 12, patterns: 9 });

    const { json, code } = run(['--json']);
    const state = JSON.parse(json);

    expect(code).toBe(0);
    expect(state.verdict.code).toBe('ON');
    expect(state.learner.trajectories).toBe(12);
    expect(state.learner.patterns).toBe(9);
  });
});

describe('learning-enable --enable / --disable', () => {
  it('REFUSES --enable and explains what actually drives the learner', () => {
    const { out, code } = run(['--enable']);

    expect(code, 'a refusal is a deliberate non-action, distinct from an error').toBe(2);
    expect(out).toMatch(/REFUSING --enable/);
    expect(out).toMatch(/nothing to enable/);
    expect(out, 'a refusal is only useful if it hands back the real commands')
      .toMatch(/ruflo hooks intelligence --train/);
  });

  it('REFUSES --disable for the same reason', () => {
    const { out, code } = run(['--disable']);

    expect(code).toBe(2);
    expect(out).toMatch(/REFUSING --disable/);
  });

  it('BLAST RADIUS: --enable leaves settings.json byte-identical', () => {
    const p = seedSettings({
      PostToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: '/existing/hook.sh' }] }],
    });
    const before = fs.readFileSync(p);

    run(['--enable']);

    expect(fs.readFileSync(p), 'the global settings file must not be touched').toEqual(before);
  });

  it('BLAST RADIUS: --disable writes nothing anywhere in HOME', () => {
    seedLearner();
    const p = seedSettings({});
    const snapshot = (d) => fs.readdirSync(d, { recursive: true }).sort().join('\n');
    const before = snapshot(home);
    const settingsBefore = fs.readFileSync(p);

    run(['--disable']);

    expect(snapshot(home), 'no file may be created or removed').toBe(before);
    expect(fs.readFileSync(p)).toEqual(settingsBefore);
  });

  it('is idempotent by construction: repeated refusals produce identical output and no writes', () => {
    const p = seedSettings({});
    const before = fs.readFileSync(p);

    const a = run(['--enable']);
    const b = run(['--enable']);

    expect(a.out).toBe(b.out);
    expect(a.code).toBe(b.code);
    expect(fs.readFileSync(p)).toEqual(before);
  });
});
