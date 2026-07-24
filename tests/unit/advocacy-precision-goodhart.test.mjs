// advocacy-precision-goodhart.test.mjs — you cannot buy a passing precision by offering less.
//
// The 4.0 briefing named this and left it open: "the fixture's separation-of-authorities design
// guards recall; the equivalent guard for precision needs the real ledger to exist first." It does
// not need the ledger — the hole is arithmetic, and it is closable now.
//
// THE EXPLOIT. Once precision = applied/offered gates a release it becomes a target, and the cheap
// way to raise it is to OFFER LESS: suggest only the sure thing and precision approaches 1.00 while
// the product helps nobody. That is precisely the behaviour ADR-028 exists to prevent, certified by
// the metric meant to detect it.
import { describe, it, expect } from 'vitest';
import {
  precision, precisionLowerBound, PRECISION_TARGET, MIN_PRECISION_SAMPLES, PRECISION_ALPHA,
} from '../../scripts/advocacy-outcomes.mjs';

const offers = (applied, dismissed) => ([
  ...Array.from({ length: applied }, (_, i) => ({ id: `a${i}`, action: 'applied', at: '2026-07-24T00:00:00.000Z' })),
  ...Array.from({ length: dismissed }, (_, i) => ({ id: `d${i}`, action: 'dismissed', at: '2026-07-24T00:00:00.000Z' })),
]);

describe('precisionLowerBound — checkable against a closed form, not trusted', () => {
  it('reduces to alpha^(1/n) when every offer was applied — the one case derivable by hand', () => {
    // THE SELF-CHECK THAT MATTERS. A hand-rolled incomplete-beta written in this same session
    // returned 98.3% for n=3, which is absurd on its face — three samples cannot bound anything at
    // 98%. Any implementation of this bound must be checked against something derivable without
    // trusting the implementation: at k=n, P(all n correct | p) = p^n, so setting p^n = alpha gives
    // p = alpha^(1/n) exactly.
    for (const n of [1, 3, 5, 10, 29, 40]) {
      const expected = Math.pow(PRECISION_ALPHA, 1 / n);
      expect(precisionLowerBound(n, n)).toBeCloseTo(expected, 6);
    }
    expect(precisionLowerBound(3, 3)).toBeCloseTo(0.3684, 3);   // cube root of 0.05
  });

  it('is monotone in the sample: the same RATIO bounds tighter with more evidence', () => {
    const half = [2, 5, 10, 25, 100].map((n) => precisionLowerBound(n / 2, n));
    for (let i = 1; i < half.length; i++) expect(half[i]).toBeGreaterThan(half[i - 1]);
  });

  it('is 0 when nothing was applied, and never exceeds the point estimate', () => {
    expect(precisionLowerBound(0, 9)).toBe(0);
    for (const [k, n] of [[1, 4], [3, 7], [9, 11], [20, 25]]) {
      expect(precisionLowerBound(k, n)).toBeLessThanOrEqual(k / n);
    }
  });

  it('rejects impossible inputs rather than inventing a number', () => {
    expect(precisionLowerBound(5, 3)).toBeNull();
    expect(precisionLowerBound(-1, 3)).toBeNull();
    expect(precisionLowerBound(1, 0)).toBeNull();
  });
});

describe('the Goodhart guard: offering LESS must never buy a pass', () => {
  it('a lucky small sample no longer certifies — 4/6 has a point estimate over target and FAILS', () => {
    // The old rule compared the point estimate: 4/6 = 0.667 >= 0.60 -> "meets target", on evidence
    // consistent with a true rate far below 0.30. This is the exact shape a gamed metric takes.
    const p = precision({ all: offers(4, 2) });
    expect(p.precision).toBeCloseTo(0.6667, 3);
    expect(p.precision).toBeGreaterThan(PRECISION_TARGET);        // point estimate clears...
    expect(p.lowerBound).toBeLessThan(PRECISION_TARGET);          // ...the evidence does not
    expect(p.meetsTarget, 'a lucky 4/6 must not certify a 0.60 target').toBe(false);
    expect(p.reason).toMatch(/lower bound/i);
  });

  it('WITHHOLDING OFFERS CANNOT MANUFACTURE A PASS — a perfect 5/5 still fails', () => {
    // The headline exploit, priced exactly: offer only what you are certain of, be right every time,
    // and you still cannot clear 0.60, because 0.05^(1/5) = 0.549. The only route to a certified
    // precision is to offer MORE and be right — which is the behaviour we actually want.
    const p = precision({ all: offers(5, 0) });
    expect(p.precision).toBe(1);                                   // flawless on its face
    expect(p.lowerBound).toBeCloseTo(Math.pow(0.05, 1 / 5), 3);     // 0.549
    expect(p.meetsTarget, 'a flawless 5/5 is still too little evidence for a 0.60 claim').toBe(false);
  });

  it('offering MORE and being right is what clears it — 12/12 certifies', () => {
    const p = precision({ all: offers(12, 0) });
    expect(p.lowerBound).toBeGreaterThan(PRECISION_TARGET);
    expect(p.meetsTarget).toBe(true);
    expect(p.reason).toBeNull();
  });

  it('and volume alone is not enough — 12/20 applied still fails on the bound', () => {
    // Guards the opposite failure: spamming offers to inflate the denominator. The bound punishes
    // being wrong just as it punishes being quiet.
    const p = precision({ all: offers(12, 8) });
    expect(p.precision).toBeCloseTo(0.6, 3);
    expect(p.meetsTarget, 'a point estimate exactly at target cannot certify it').toBe(false);
  });

  it('an empty ledger is still "unknown, not zero"', () => {
    const p = precision({ all: [] });
    expect(p.precision).toBeNull();
    expect(p.meetsTarget).toBeNull();
    expect(p.reason).toMatch(/not zero/);
  });

  it('below the sample floor it reports not-judgeable rather than a verdict', () => {
    const p = precision({ all: offers(1, 1) });
    expect(p.offered).toBeLessThan(MIN_PRECISION_SAMPLES);
    expect(p.sufficient).toBe(false);
    expect(p.meetsTarget).toBeNull();
  });
});
