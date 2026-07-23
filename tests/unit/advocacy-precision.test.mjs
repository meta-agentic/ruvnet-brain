// advocacy-precision.test.mjs — the numerator, and only the numerator it earned.
//
// Before this build, precision() could only ever return null or 0: `applied` was recorded by nothing,
// so ADR-028's "acting ÷ offered" had a permanently empty numerator — advocacy that reads as pure
// nagging no matter how well it lands. reconcileApplied() supplies it from an OBSERVED state
// transition (offered, still pending, now `on`). These tests fail on broken code in BOTH directions:
// a no-op reconcile leaves precision null (test 1), and an over-eager one credits offers it must not
// (tests 2-4). A test that only checked "precision moved" would pass on code that credited everything.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { record, reconcileApplied, precision, ACTIONS } from '../../scripts/advocacy-outcomes.mjs';

let dir, file;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-prec-')); file = path.join(dir, 'outcomes.jsonl'); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const offer = (id, severity = 'normal') => record({ id, action: ACTIONS.OFFERED, severity }, { file });
const rows = (...specs) => specs.map(([key, state]) => ({ key, state }));

describe('reconcileApplied — the derived numerator', () => {
  it('an offered capability now observed ON is credited APPLIED, and precision becomes computable', () => {
    offer('learner');
    expect(precision({ file }).precision, 'no numerator yet → null, not 0').toBeNull();
    const done = reconcileApplied(rows(['learner', 'on']), { file });
    expect(done).toEqual(['learner']);
    const p = precision({ file });
    expect(p.applied).toBe(1);
    expect(p.offered).toBe(1);          // one RESOLVED offer
    expect(p.precision).toBe(1);        // 1 applied / 1 resolved
  });

  it('does NOT credit an offer the user already RESOLVED — a later on-state is not ours', () => {
    offer('router');
    record({ id: 'router', action: ACTIONS.DISMISSED, severity: 'normal' }, { file }); // resolved
    const done = reconcileApplied(rows(['router', 'on']), { file });
    expect(done, 'a dismissed offer that later turns on must not be miscredited').toEqual([]);
    const p = precision({ file });
    expect(p.applied).toBe(0);
    expect(p.precision).toBe(0);        // 0 applied / 1 dismissed
  });

  it('does NOT credit a still-OFF capability — no premature applied', () => {
    offer('sona');
    expect(reconcileApplied(rows(['sona', 'off']), { file })).toEqual([]);
    expect(precision({ file }).precision, 'offered but not on → still null').toBeNull();
  });

  it('does NOT credit a capability that was never offered — an on-state we did not cause is not ours', () => {
    // capability came on for reasons of the user's own; we never suggested it
    expect(reconcileApplied(rows(['moe', 'on']), { file })).toEqual([]);
    expect(precision({ file }).offered).toBe(0);
  });

  it('is idempotent — a second audit does not double-count (applied resolves the offer)', () => {
    offer('learner');
    reconcileApplied(rows(['learner', 'on']), { file });
    const second = reconcileApplied(rows(['learner', 'on']), { file });
    expect(second, 'the offer is resolved after the first apply — nothing pending to re-credit').toEqual([]);
    expect(precision({ file }).applied).toBe(1);
  });

  it('computes a mixed precision honestly — one applied, one dismissed → 0.5', () => {
    offer('a'); offer('b');
    reconcileApplied(rows(['a', 'on'], ['b', 'off']), { file });   // a applied
    record({ id: 'b', action: ACTIONS.DISMISSED, severity: 'normal' }, { file }); // b dismissed
    const p = precision({ file });
    expect(p.applied).toBe(1);
    expect(p.offered).toBe(2);
    expect(p.precision).toBe(0.5);
  });

  it('never throws on junk input — surfaces call it', () => {
    expect(reconcileApplied(null, { file })).toEqual([]);
    expect(reconcileApplied([null, 42, {}, { key: 'x' }], { file })).toEqual([]);
  });

  it('record() now accepts the OFFERED action — the two writers share one vocabulary', () => {
    expect(() => record({ id: 'z', action: ACTIONS.OFFERED, severity: 'normal' }, { file })).not.toThrow();
  });
});
