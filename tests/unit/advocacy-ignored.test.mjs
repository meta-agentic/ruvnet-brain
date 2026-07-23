// advocacy-ignored.test.mjs — the denominator's missing third, recorded honestly.
//
// precision = applied ÷ (applied + dismissed + ignored). Before this build `ignored` was recorded by
// NOTHING: an offer shown and never acted on nor dismissed simply vanished, which makes precision
// optimistic — it silently shrinks the denominator. reconcileIgnored() closes that gap from a
// caller-supplied list of ids already judged pending-and-stale (staleness is the caller's evidence,
// never guessed here — see the header comment on reconcileIgnored in advocacy-outcomes.mjs).
//
// These tests fail on broken code in BOTH directions, same discipline as advocacy-precision.test.mjs:
// a no-op reconcile leaves `ignored` at 0 (test 1), and an over-eager one that skips the pendingOffer
// check credits ids it must not (tests 2-4, and the never-offered test doubles as the "credits
// everything" trap).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { record, reconcileIgnored, outcomesFor, precision, pendingOffers, ACTIONS } from '../../scripts/advocacy-outcomes.mjs';
// The console's own caller (onboarding-console.mjs's `/api/capabilities` handler) for the staleness
// rule reconcileIgnored() deliberately does not compute itself — see both files' header comments.
// A direct, same-process import is safe and already the established pattern for this module: both
// subscription-detection.test.mjs and remedy-registry.test.mjs pull single named exports out of it
// this same way, and the CLI/server body only runs behind a `process.argv[1]` guard this import never
// trips.
import { findStaleOffers } from '../../scripts/onboarding-console.mjs';

let dir, file;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-ign-')); file = path.join(dir, 'outcomes.jsonl'); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const offer = (id, severity = 'normal') => record({ id, action: ACTIONS.OFFERED, severity }, { file });

describe('reconcileIgnored — the honest third of the denominator', () => {
  it('a pending, still-unresolved offer marked ignored enters the denominator and drags precision down', () => {
    offer('learner');
    expect(precision({ file }).precision, 'no resolution yet → unknown, not zero').toBeNull();

    const done = reconcileIgnored(['learner'], { file });
    expect(done).toEqual(['learner']);

    const p = precision({ file });
    expect(p.ignored).toBe(1);
    expect(p.offered).toBe(1);          // one RESOLVED offer, now visible in the denominator
    expect(p.precision).toBe(0);        // 0 applied / 1 resolved-as-ignored
    expect(outcomesFor('learner', { file }).ignored).toBe(1);
  });

  it('does NOT convert an offer the user actually APPLIED — an acted-on offer is never relabelled', () => {
    offer('router');
    record({ id: 'router', action: ACTIONS.APPLIED, severity: 'normal' }, { file }); // already resolved

    const done = reconcileIgnored(['router'], { file });
    expect(done, 'an applied offer must never be miscredited as ignored').toEqual([]);

    const p = precision({ file });
    expect(p).toMatchObject({ applied: 1, ignored: 0, offered: 1, precision: 1 });
  });

  it('does NOT convert an offer the user actually DISMISSED — a real "no" is never relabelled "never saw it"', () => {
    offer('sona');
    record({ id: 'sona', action: ACTIONS.DISMISSED, severity: 'normal' }, { file }); // already resolved

    const done = reconcileIgnored(['sona'], { file });
    expect(done).toEqual([]);

    const p = precision({ file });
    expect(p).toMatchObject({ applied: 0, dismissed: 1, ignored: 0, offered: 1, precision: 0 });
  });

  it('does NOT invent an offer for an id that was never offered — this is the "credits everything" trap', () => {
    // A broken implementation that skips the pendingOffer() check and records `ignored` for every id
    // it is handed would pass tests 1-3 by coincidence but would fail here: it would fabricate a
    // record, and therefore a denominator entry, for something that was never shown to anyone.
    expect(reconcileIgnored(['never-offered'], { file })).toEqual([]);
    expect(precision({ file }).offered).toBe(0);
    expect(outcomesFor('never-offered', { file }).offered).toBe(0);
  });

  it('is idempotent ACROSS calls — the offer is resolved after the first ignore, so nothing double-counts', () => {
    offer('learner');
    reconcileIgnored(['learner'], { file });
    const second = reconcileIgnored(['learner'], { file });
    expect(second, 'nothing pending is left to re-mark').toEqual([]);
    expect(precision({ file }).ignored, 'a second reconcile must not add a second ignored row').toBe(1);
  });

  it('is idempotent WITHIN one call — a duplicate id in the same list only counts once', () => {
    offer('dup');
    const done = reconcileIgnored(['dup', 'dup', 'dup'], { file });
    expect(done).toEqual(['dup']);
    expect(precision({ file }).ignored).toBe(1);
  });

  it('a reconciled-ignored offer does not block a LATER, genuinely different offer for the same id', () => {
    // Once ignored, the id has no pending offer — the NEXT `offered` (a fresh recommendation cycle)
    // starts its own pending window and can resolve independently.
    offer('learner');
    reconcileIgnored(['learner'], { file });
    offer('learner'); // a fresh cycle
    record({ id: 'learner', action: ACTIONS.APPLIED, severity: 'normal' }, { file });

    const p = precision({ file });
    expect(p).toMatchObject({ applied: 1, ignored: 1, offered: 2 });
    expect(p.precision).toBe(0.5);
  });

  it('computes a mixed precision honestly — one applied, one ignored → 0.5', () => {
    offer('a'); offer('b');
    record({ id: 'a', action: ACTIONS.APPLIED, severity: 'normal' }, { file });
    reconcileIgnored(['b'], { file });

    const p = precision({ file });
    expect(p.applied).toBe(1);
    expect(p.ignored).toBe(1);
    expect(p.offered).toBe(2);
    expect(p.precision).toBe(0.5);
  });

  it('never throws on junk input', () => {
    expect(reconcileIgnored(null, { file })).toEqual([]);
    expect(reconcileIgnored(undefined, { file })).toEqual([]);
    expect(() => reconcileIgnored('not-an-array', { file })).not.toThrow();
    expect(reconcileIgnored([null, 42, {}, '', 'never-offered'], { file })).toEqual([]);
  });

  it('a failed write returns a receipt instead of throwing, and does not report the id as done', () => {
    // Same I/O discipline as record() itself: callers are surfaces, and an unwritable ledger must
    // degrade rather than crash — but the caller still needs to know it did NOT land, because that is
    // the difference between "recorded" and "silently lost".
    const roFile = path.join(dir, 'readonly.jsonl');
    record({ id: 'z', action: ACTIONS.OFFERED, severity: 'normal' }, { file: roFile });
    fs.chmodSync(roFile, 0o400);
    try {
      let done;
      expect(() => { done = reconcileIgnored(['z'], { file: roFile }); }).not.toThrow();
      expect(done, 'the write failed — "z" must not be reported as reconciled').toEqual([]);
    } finally {
      fs.chmodSync(roFile, 0o600);
    }
  });
});

describe('pendingOffers() — the bulk read reconcileIgnored\'s callers build their own staleness on', () => {
  it('lists every id with a currently-pending offer, and nothing a caller has already resolved', () => {
    offer('a', 'high');
    offer('b');
    record({ id: 'b', action: ACTIONS.APPLIED, severity: 'normal' }, { file }); // resolved — not pending

    const pending = pendingOffers({ file });
    expect(pending.map((p) => p.id)).toEqual(['a']);
    expect(pending[0]).toMatchObject({ id: 'a', severity: 'high' });
    expect(typeof pending[0].at).toBe('string');
  });

  it('never throws on a missing or corrupt ledger — same fail-toward-speaking contract as loadOutcomes', () => {
    expect(pendingOffers({ file: path.join(dir, 'nope.jsonl') })).toEqual([]);
    fs.writeFileSync(file, 'not json\n');
    expect(pendingOffers({ file })).toEqual([]);
  });

  it('an id resolved, then re-offered, is pending again — the bulk view matches the per-id one', () => {
    offer('learner');
    reconcileIgnored(['learner'], { file });          // resolves it
    expect(pendingOffers({ file })).toEqual([]);
    offer('learner');                                  // a fresh cycle
    expect(pendingOffers({ file }).map((p) => p.id)).toEqual(['learner']);
  });
});

describe('findStaleOffers() (onboarding-console.mjs) — the honest staleness rule wired for `ignored`', () => {
  // THE RULE, restated for the test reader: pending (never applied/dismissed) AND still audited `off`
  // AND offered at least 24h ago. Every test here isolates exactly one of those three clauses so a
  // regression that drops any single one still fails somewhere in this block.
  const rows = (...specs) => specs.map(([key, state]) => ({ key, state }));
  const DAY = 24 * 60 * 60 * 1000;
  const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

  it('an offer pending under 24h is NOT stale, even though the capability is still off', () => {
    record({ id: 'learner', action: ACTIONS.OFFERED, severity: 'normal', at: hoursAgo(1) }, { file });
    expect(findStaleOffers(rows(['learner', 'off']), { file })).toEqual([]);
  });

  it('an offer pending 24h+ AND still off IS stale', () => {
    record({ id: 'learner', action: ACTIONS.OFFERED, severity: 'normal', at: hoursAgo(25) }, { file });
    expect(findStaleOffers(rows(['learner', 'off']), { file })).toEqual(['learner']);
  });

  it('does NOT call an old pending offer stale if the audit now shows it ON — reconcileApplied\'s job, not this one\'s', () => {
    record({ id: 'learner', action: ACTIONS.OFFERED, severity: 'normal', at: hoursAgo(48) }, { file });
    expect(findStaleOffers(rows(['learner', 'on']), { file })).toEqual([]);
  });

  it('does NOT flag an offer the user already resolved (applied or dismissed), however old', () => {
    record({ id: 'learner', action: ACTIONS.OFFERED, severity: 'normal', at: hoursAgo(48) }, { file });
    record({ id: 'learner', action: ACTIONS.DISMISSED, severity: 'normal' }, { file });
    expect(findStaleOffers(rows(['learner', 'off']), { file })).toEqual([]);
  });

  it('a `now` right at the boundary is inclusive — the constant it is tested against is exported nowhere else', () => {
    record({ id: 'learner', action: ACTIONS.OFFERED, severity: 'normal', at: new Date(0).toISOString() }, { file });
    expect(findStaleOffers(rows(['learner', 'off']), { file, now: DAY })).toEqual(['learner']);
    expect(findStaleOffers(rows(['learner', 'off']), { file, now: DAY - 1 })).toEqual([]);
  });

  it('end-to-end: findStaleOffers feeding reconcileIgnored records `ignored` and drags precision down honestly', () => {
    record({ id: 'learner', action: ACTIONS.OFFERED, severity: 'normal', at: hoursAgo(48) }, { file });
    expect(precision({ file }).precision, 'unresolved → unknown, not zero, before reconciliation').toBeNull();

    const staleIds = findStaleOffers(rows(['learner', 'off']), { file });
    const done = reconcileIgnored(staleIds, { file });
    expect(done).toEqual(['learner']);

    const p = precision({ file });
    expect(p).toMatchObject({ ignored: 1, offered: 1, applied: 0, dismissed: 0, precision: 0 });
    expect(outcomesFor('learner', { file }).ignored).toBe(1);
  });

  it('never throws, and proposes nothing, on junk audit rows', () => {
    expect(findStaleOffers(null, { file })).toEqual([]);
    expect(findStaleOffers([null, 42, {}, { key: 'x' }], { file })).toEqual([]);
  });
});
