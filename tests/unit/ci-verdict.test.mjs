// ci-verdict.test.mjs — the remote-CI ship gate can actually refuse (ADR-053 §5).
//
// The failure this pins: 2026-07-21→26, ci red for ~70 consecutive runs, six releases shipped past
// it. The gate's one job is to make that impossible, so the table below is the whole contract —
// and the load-bearing rows are the REFUSALS. A gate that cannot fail on broken state is not a
// gate (this repo's oldest lesson), so 'unknown' is deliberately a refusal, never a pass: an API
// hiccup must fail the ship, not wave it through.

import { describe, it, expect } from 'vitest';
import { assessCiGate, fetchLatestCiVerdict } from '../../scripts/ci-verdict.mjs';

describe('assessCiGate — green ships, everything else refuses unless loudly overridden', () => {
  for (const [verdict, override, want] of [
    ['success', null, 'ship'],
    ['failure', null, 'refuse'],        // the exact 5-day-streak state
    ['cancelled', null, 'refuse'],
    ['timed_out', null, 'refuse'],
    [null, null, 'refuse'],             // no run found / API unreachable — unknown is red
    ['failure', 'hotfix for #99', 'override'],  // the escape hatch, never silent
    [null, 'hotfix for #99', 'override'],
  ]) {
    it(`verdict=${verdict} override=${override ? 'yes' : 'no'} → ${want}`, () => {
      expect(assessCiGate(verdict, override)).toBe(want);
    });
  }

  it('an empty-string override is no override — a reason must exist to be printed', () => {
    // release.mjs passes `argv[i+1] || '(no reason given)'`, but the pure function must not treat
    // falsy as permission either — defense at both layers.
    expect(assessCiGate('failure', '')).toBe('refuse');
  });
});

describe('fetchLatestCiVerdict — degrades to unknown, never throws', () => {
  it('an unreachable API yields { verdict: null } (which the gate refuses)', async () => {
    const r = await fetchLatestCiVerdict({ repo: 'stuinfla/definitely-not-a-repo-9f2c1', workflow: 'nope.yml' });
    expect(r.verdict).toBe(null);
  });
});
