// advocacy-claim.test.mjs — the atomic right-to-speak, tested against ACTUAL concurrency.
//
// The defect (GPT-5.6-Sol, ADR-047 duel): shouldStillOffer() is a pure read, so two sessions both
// read "not yet offered", both say yes, and the user hears it twice. He drove it to twenty pending
// offers for one finding. claimOffer() adds the missing atomic step.
//
// A race test that does not actually race proves nothing, so the central test here forks REAL OS
// processes contending for the same claim — a single-process loop would be serialised by the event
// loop and would pass against a completely broken implementation.
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claimOffer, releaseClaim } from '../../scripts/advocacy-outcomes.mjs';

const MODULE = path.resolve(import.meta.dirname, '../../scripts/advocacy-outcomes.mjs');

let dir;
afterEach(() => { if (dir) { fs.rmSync(dir, { recursive: true, force: true }); dir = null; } });
const sandbox = () => (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-')));

describe('claimOffer — exactly one speaker', () => {
  it('the first caller wins', () => {
    const d = sandbox();
    expect(claimOffer('cheap-model-routing', { dir: d })).toBe(true);
  });

  it('a second caller LOSES while the claim is live — this is the duplicate offer, prevented', () => {
    const d = sandbox();
    expect(claimOffer('a', { dir: d })).toBe(true);
    expect(claimOffer('a', { dir: d })).toBe(false);
    expect(claimOffer('a', { dir: d })).toBe(false);
  });

  it('different capabilities do not block each other', () => {
    const d = sandbox();
    expect(claimOffer('a', { dir: d })).toBe(true);
    expect(claimOffer('b', { dir: d })).toBe(true);
  });

  it('REAL PROCESS CONTENTION: 12 concurrent OS processes, exactly one wins', () => {
    // The load-bearing test. Twelve separate node processes race for one claim. In-process
    // sequencing cannot mask a broken implementation here, because these genuinely run at once.
    const d = sandbox();
    const script = `
      import { claimOffer } from ${JSON.stringify(MODULE)};
      process.stdout.write(claimOffer('contended', { dir: ${JSON.stringify(d)} }) ? 'WON' : 'lost');
    `;
    const f = path.join(d, 'racer.mjs');
    fs.writeFileSync(f, script);

    // Launch all twelve, then collect — `&` backgrounds them so they overlap in real time.
    const out = execFileSync('/bin/sh', ['-c',
      `for i in $(seq 1 12); do node ${JSON.stringify(f)} >> ${JSON.stringify(path.join(d, 'out.txt'))} & done; wait`,
    ], { encoding: 'utf8', timeout: 60_000 });
    void out;

    const results = fs.readFileSync(path.join(d, 'out.txt'), 'utf8');
    const wins = (results.match(/WON/g) || []).length;
    expect(wins, `exactly one of twelve concurrent processes may speak (got ${wins}) — raw: ${results}`).toBe(1);
  });

  it('a STALE claim is taken over — a crashed session must never silence a capability forever', () => {
    // Fail-toward-speaking: a missed offer is the failure this product exists to prevent, while a
    // duplicate is merely annoying. When in doubt, speak.
    const d = sandbox();
    expect(claimOffer('a', { dir: d, now: 1_000_000 })).toBe(true);
    expect(claimOffer('a', { dir: d, now: 1_000_000 + 30_000, ttlMs: 60_000 })).toBe(false);  // still live
    expect(claimOffer('a', { dir: d, now: 1_000_000 + 90_000, ttlMs: 60_000 })).toBe(true);   // abandoned
  });

  it('releaseClaim lets a later dormancy re-offer', () => {
    const d = sandbox();
    expect(claimOffer('a', { dir: d })).toBe(true);
    expect(claimOffer('a', { dir: d })).toBe(false);
    expect(releaseClaim('a', { dir: d })).toBe(true);
    expect(claimOffer('a', { dir: d }), 'after resolution the capability must be offerable again').toBe(true);
  });

  it('an unusable claim directory FAILS TOWARD SPEAKING, never toward silence', () => {
    // A filesystem problem must not mute the product. Silence is the one failure mode that looks
    // exactly like everything being fine.
    expect(claimOffer('a', { dir: '/nonexistent-root/deeply/nested' })).toBe(true);
  });

  it('a malformed claim file is treated as stale rather than as an eternal lock', () => {
    const d = sandbox();
    claimOffer('a', { dir: d });
    const f = fs.readdirSync(d).find((n) => n.endsWith('.claim'));
    fs.writeFileSync(path.join(d, f), 'not json at all');
    expect(claimOffer('a', { dir: d }), 'unparseable ⇒ unknown age ⇒ speak').toBe(true);
  });

  it('rejects a non-string id without claiming anything', () => {
    const d = sandbox();
    expect(claimOffer(null, { dir: d })).toBe(false);
    expect(claimOffer(42, { dir: d })).toBe(false);
  });
});
