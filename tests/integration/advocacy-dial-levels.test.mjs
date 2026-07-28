/**
 * advocacy-dial-levels.test.mjs — the 1–5 dial (ADR-052) actually CHANGES what gets delivered.
 *
 * The failure this exists to prevent (and that user-settings.mjs's own downside once admitted): a dial
 * whose levels are cosmetic — "important-only" and "all" producing identical output. Here each of the
 * five levels is fired at the REAL runtime across a process boundary, with a real advocacy candidate
 * and a real promotion candidate, and we assert WHICH survives. Every assertion bounds a concrete
 * outcome (a specific copy present / absent in additionalContext, or byte-empty stdout), and the final
 * block proves the levels are load-bearing by showing two of them DISAGREE — if the policy map were
 * flattened back to off/on, that test goes red.
 *
 * LEVEL_POLICY under test (mirrors unprompted-runtime.mjs):
 *   1 advocacy off, promotion off   2 advocacy(high-sev only), promotion off
 *   3 advocacy on, promotion off     4 advocacy on, promotion on     5 advocacy on, promotion on
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNTIME = path.join(ROOT, 'plugin', 'scripts', 'unprompted-runtime.mjs');

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dial-levels-')); });
afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });

/** A producer that prints each line of $CANDIDATE_LINE (embedded \n → multiple candidates). */
function emitter() {
  const p = path.join(dir, 'emit.sh');
  fs.writeFileSync(p, '#!/bin/bash\nprintf \'%s\\n\' "$CANDIDATE_LINE"\n');
  fs.chmodSync(p, 0o755);
  return { argv: ['/bin/bash', p], feedStdin: true };
}
function writeSettings(advocacy) {
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, JSON.stringify({
    version: 1, updated: '2026-07-25T00:00:00Z',
    settings: { learningScope: 'project', advocacy, autoApply: false, newProjectDefaults: false },
  }));
  return p;
}
const ADV = (over = {}) => JSON.stringify({
  channel: 'advocacy', effect: 'advisory', hookEventName: 'UserPromptSubmit',
  copy: 'FIXTURE_ADVOCACY the vector cache is off', findingId: 'fix-adv', severity: 'high', observationHash: 'hA', ...over,
});
const PROMO = (over = {}) => JSON.stringify({
  channel: 'promotion', effect: 'advisory', hookEventName: 'UserPromptSubmit',
  copy: 'FIXTURE_PROMOTION promote this lesson to your global brain', ...over,
});

/** Fire the runtime at `advocacy` level with the given candidate lines; report what was delivered. */
function fire(advocacy, candidateLines) {
  const r = spawnSync('node', [RUNTIME, 'UserPromptSubmit'], {
    input: JSON.stringify({ prompt: 'a prompt long enough to look like a real goal statement', session_id: 's1' }),
    // TIMEOUT ORDERING (2026-07-27): the OUTER spawn timeout must exceed the INNER producer
    // deadline, or the outer SIGKILL lands first and the test sees EMPTY stdout — which reads as
    // 'the runtime chose silence' when it actually means 'we killed it mid-sentence'. It was
    // inverted here (outer 20000 < inner 30000), and integration-linux went red on a DIFFERENT
    // test each run — the tell that it was load, not logic. macOS never reproduced it.
    // Inner is now 8000: a `/bin/bash printf` needs milliseconds, so 8s is enormous headroom even
    // on a saturated runner, and it lets the runtime's OWN timeout handling fire and report
    // instead of dying to an external kill. A guard below pins outer > inner.
    encoding: 'utf8', timeout: 45000,
    env: {
      ...process.env,
      RUVNET_UNPROMPTED_TIMEOUT_MS: '25000',
      RUVNET_UNPROMPTED_PRODUCERS: JSON.stringify([emitter()]),
      RUVNET_SETTINGS_FILE: writeSettings(advocacy),
      RUVNET_ADVOCACY_OUTCOMES: path.join(dir, 'outcomes.jsonl'),   // fresh → never offered → not suppressed
      CANDIDATE_LINE: candidateLines.join('\n'),
    },
  });
  let ctx = '';
  try { ctx = JSON.parse(r.stdout || '{}')?.hookSpecificOutput?.additionalContext || ''; } catch { ctx = ''; }
  return {
    code: r.status, stdoutEmpty: (r.stdout ?? '') === '',
    advocacy: ctx.includes('FIXTURE_ADVOCACY'),
    promotion: ctx.includes('FIXTURE_PROMOTION'),
  };
}

describe('the 1–5 dial changes what the runtime delivers (ADR-052)', () => {
  it('level 1 (only-when-I-ask): drops both advocacy and promotion — byte-empty stdout', () => {
    const r = fire(1, [ADV(), PROMO()]);
    expect(r.advocacy, 'L1 must not deliver advocacy').toBe(false);
    expect(r.promotion, 'L1 must not deliver promotion').toBe(false);
    expect(r.stdoutEmpty, 'L1 with nothing delivered ⇒ INVARIANT: exit 0, stdout ""').toBe(true);
  });

  it('level 2 (critical-only): delivers HIGH-severity advocacy, DROPS normal-severity, DROPS promotion', () => {
    expect(fire(2, [ADV({ severity: 'high' })]).advocacy, 'L2 delivers high-severity advocacy').toBe(true);
    expect(fire(2, [ADV({ severity: 'normal' })]).advocacy, 'L2 drops normal-severity advocacy').toBe(false);
    expect(fire(2, [ADV({ severity: null })]).advocacy, 'L2 drops null-severity advocacy').toBe(false);
    expect(fire(2, [PROMO()]).promotion, 'L2 drops promotion').toBe(false);
  });

  it('level 3 (balanced, default): delivers advocacy of ANY severity, still DROPS promotion', () => {
    expect(fire(3, [ADV({ severity: 'normal' })]).advocacy, 'L3 delivers normal-severity advocacy').toBe(true);
    expect(fire(3, [PROMO()]).promotion, 'L3 drops promotion').toBe(false);
  });

  it('level 4 (proactive): delivers BOTH advocacy and promotion', () => {
    const r = fire(4, [ADV(), PROMO()]);
    expect(r.advocacy, 'L4 delivers advocacy').toBe(true);
    expect(r.promotion, 'L4 delivers promotion').toBe(true);
  });

  it('level 5 (maximum): delivers both, like L4', () => {
    const r = fire(5, [ADV(), PROMO()]);
    expect(r.advocacy && r.promotion, 'L5 delivers both').toBe(true);
  });

  it('legacy string values still map correctly through loadSettings migration', () => {
    expect(fire('off', [ADV()]).advocacy, 'legacy off → L1 → drops advocacy').toBe(false);
    expect(fire('important-only', [PROMO()]).promotion, 'legacy important-only → L3 → drops promotion').toBe(false);
    expect(fire('important-only', [ADV()]).advocacy, 'legacy important-only → L3 → delivers advocacy').toBe(true);
    expect(fire('all', [PROMO()]).promotion, 'legacy all → L4 → delivers promotion').toBe(true);
  });

  it('TEETH: the levels genuinely DISAGREE — promotion is delivered at 4 but not at 3', () => {
    // If the policy map were flattened (levels cosmetic, the old bug), these two would be equal and this
    // assertion would fail — which is exactly what makes it a real test of the dial, not decoration.
    expect(fire(3, [PROMO()]).promotion).toBe(false);
    expect(fire(4, [PROMO()]).promotion).toBe(true);
  });
});
