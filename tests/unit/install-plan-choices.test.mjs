// install-plan-choices.test.mjs — the interactive install checklist must be answered ONCE.
//
// The owner's complaint (2026-07-24): "the plan screen showed everything, then every offer asked
// again, one at a time." The fix collects each optional choice up front in printPlanAndConfirm()
// into PLAN_CHOICES, and every offer consumes its answer via ask(..., {planKey}) or plannedChoice()
// instead of prompting a second time. This proves that consumption path — a plan choice, once made,
// is honored WITHOUT touching stdin, and overrides the default in both directions.
//
// Imported under RUVNET_BRAIN_IMPORT_ONLY=1 so the installer main() never runs on import (same
// pattern as the offerNightly / telemetry tests).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

let ask, PLAN_CHOICES, plannedChoice;
beforeAll(async () => {
  process.env.RUVNET_BRAIN_IMPORT_ONLY = '1';
  ({ ask, PLAN_CHOICES, plannedChoice } = await import('../../bin/install.mjs'));
});
afterEach(() => { for (const k of Object.keys(PLAN_CHOICES)) delete PLAN_CHOICES[k]; });

describe('the checklist is answered once — offers consume the plan, never re-ask', () => {
  it('a planned YES resolves true without prompting, even when the offer default is false', async () => {
    PLAN_CHOICES.stack = true;
    // def=false: without the plan this would be "no" in a non-TTY. The plan choice overrides it.
    await expect(ask('Add rUv tools?', false, { planKey: 'stack' })).resolves.toBe(true);
  });

  it('a planned NO resolves false without prompting, even when the offer default is true', async () => {
    PLAN_CHOICES.nightly = false;
    // def=true (nightly is recommended): a user who unchecked it in the checklist must NOT be
    // re-defaulted back to yes. The declined plan choice wins.
    await expect(ask('Enable nightly?', true, { planKey: 'nightly' })).resolves.toBe(false);
  });

  it('with NO plan choice recorded, ask falls through to its default (non-TTY) — offer prompts as before', async () => {
    // key absent from PLAN_CHOICES: the non-interactive / no-plan path is unchanged.
    await expect(ask('Add rUv tools?', false, { planKey: 'stack' })).resolves.toBe(false);
    await expect(ask('Enable nightly?', true, { planKey: 'nightly' })).resolves.toBe(true);
  });

  it('a plan choice of false is honored, not treated as "unset" (the `in` check, not truthiness)', async () => {
    // The subtle bug this guards: `PLAN_CHOICES[key] || undefined` would turn a deliberate `false`
    // into "not answered" and re-prompt. plannedChoice uses `key in PLAN_CHOICES`, so false stays false.
    PLAN_CHOICES.telemetry = false;
    expect(plannedChoice('telemetry')).toBe(false);
    await expect(ask('Share usage counts?', true, { planKey: 'telemetry' })).resolves.toBe(false);
  });

  it('plannedChoice returns undefined for a key that was never collected', () => {
    expect(plannedChoice('statusline')).toBeUndefined();
  });

  it('ask WITHOUT a planKey ignores PLAN_CHOICES entirely (only keyed offers consume the plan)', async () => {
    PLAN_CHOICES.stack = true;
    // No planKey passed → the stack plan choice must not leak into an unrelated ask.
    await expect(ask('Some other question?', false)).resolves.toBe(false); // non-TTY → def
  });
});
