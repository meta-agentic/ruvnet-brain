// tests/unit/telemetry-ping.test.mjs — the privacy contract of kb/telemetry-ping.mjs, held as tests.
//
// The contract (each clause has a test):
//   1. OPT-IN ONLY   — no consent file / "no" / anything but literal "yes" → NOTHING is ever sent.
//   2. TEST-SILENT   — RUVNET_BRAIN_TEST=1 (and the RUVNET_BRAIN_TELEMETRY=0 kill-switch) win over consent.
//   3. COUNTS ONLY   — the payload is exactly { event, v, n }; no query text field even exists.
//   4. DAILY-BATCHED — at most one flush per day; later events accumulate locally.
//   5. NEVER THROWS  — a fetch that rejects or throws synchronously can't surface into the query path.
// All tests are network-free: fetchFn is injected and captured.

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { telemetryEnabled, recordEvent, stampGroundedOnce, bundleVersion } from '../../kb/telemetry-ping.mjs';

let dir; // fresh state dir per test — no shared state, no real ~/.cache ever touched
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-telemetry-')); });

const ENV_OFF = {}; // no RUVNET_BRAIN_TEST, no kill-switch — the "real user" environment
const consent = (word) => fs.writeFileSync(path.join(dir, '.telemetry-consent'), word + '\n');
const capture = () => { const calls = []; const fn = (url, opts) => { calls.push({ url, opts }); return Promise.resolve({ ok: true }); }; return { calls, fn }; };

describe('clause 1 — opt-in only: silence without an explicit yes', () => {
  it('no consent file at all → disabled, nothing sent', () => {
    const { calls, fn } = capture();
    const r = recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn });
    expect(r.enabled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('consent file says "no" → disabled, nothing sent', () => {
    consent('no');
    const { calls, fn } = capture();
    expect(recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn }).enabled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('consent file with junk content → disabled (only the literal "yes" opts in)', () => {
    consent('sure why not');
    expect(telemetryEnabled({ stateDir: dir, env: ENV_OFF })).toBe(false);
  });

  it('consent "yes" → enabled', () => {
    consent('yes');
    expect(telemetryEnabled({ stateDir: dir, env: ENV_OFF })).toBe(true);
  });
});

describe('clause 2 — test mode and kill-switch beat consent', () => {
  it('RUVNET_BRAIN_TEST=1 → nothing fires even with consent on disk', () => {
    consent('yes');
    const { calls, fn } = capture();
    const r = recordEvent('search', { stateDir: dir, env: { RUVNET_BRAIN_TEST: '1' }, fetchFn: fn });
    expect(r.enabled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('RUVNET_BRAIN_TELEMETRY=0 → same hard off', () => {
    consent('yes');
    const { calls, fn } = capture();
    expect(recordEvent('search', { stateDir: dir, env: { RUVNET_BRAIN_TELEMETRY: '0' }, fetchFn: fn }).enabled).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('clause 3 — counts only: the payload is { event, v, n } and nothing else', () => {
  it('a flushed search ping carries exactly event/v/n — no query, no paths, no machine id', () => {
    consent('yes');
    const { calls, fn } = capture();
    recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn, version: 'v9.9.9' });
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].opts.body);
    expect(Object.keys(body).sort()).toEqual(['event', 'n', 'v']);
    expect(body).toEqual({ event: 'search', v: 'v9.9.9', n: 1 });
  });

  it('unknown event names are dropped entirely', () => {
    consent('yes');
    const { calls, fn } = capture();
    const r = recordEvent('query-text-smuggle', { stateDir: dir, env: ENV_OFF, fetchFn: fn });
    expect(r.enabled).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('clause 4 — daily batching: at most one flush per day', () => {
  it('first event of the day flushes; the rest of the day accumulates locally', () => {
    consent('yes');
    const { calls, fn } = capture();
    const day1 = new Date('2026-07-10T10:00:00Z');
    expect(recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn, now: day1 }).flushed).toBe(true);
    expect(recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn, now: day1 }).flushed).toBe(false);
    expect(recordEvent('session', { stateDir: dir, env: ENV_OFF, fetchFn: fn, now: day1 }).flushed).toBe(false);
    expect(calls).toHaveLength(1); // exactly one network flush for the whole day

    // Next day: one flush carrying the accumulated counts (2 searches queued + 1 new, 1 session).
    const day2 = new Date('2026-07-11T10:00:00Z');
    const r = recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn, now: day2, version: 'v1' });
    expect(r.flushed).toBe(true);
    const bodies = calls.slice(1).map((c) => JSON.parse(c.opts.body));
    expect(bodies).toContainEqual({ event: 'search', v: 'v1', n: 2 });
    expect(bodies).toContainEqual({ event: 'session', v: 'v1', n: 1 });
  });
});

describe('clause 5 — telemetry can never break the query path', () => {
  it('a synchronously-throwing fetch does not throw out of recordEvent', () => {
    consent('yes');
    const boom = () => { throw new Error('network stack on fire'); };
    expect(() => recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: boom })).not.toThrow();
  });

  it('a rejecting fetch is swallowed (no unhandled rejection)', async () => {
    consent('yes');
    const fn = () => Promise.reject(new Error('offline'));
    expect(() => recordEvent('search', { stateDir: dir, env: ENV_OFF, fetchFn: fn })).not.toThrow();
    await new Promise((r) => setTimeout(r, 10)); // let the rejection settle — must not blow up the test
  });

  it('an unwritable state dir degrades to a no-op instead of an exception', () => {
    const bogus = path.join(dir, 'not-a-dir-file');
    fs.writeFileSync(bogus, 'x'); // a FILE where a dir is expected → every fs call inside fails
    expect(() => recordEvent('search', { stateDir: bogus, env: ENV_OFF, fetchFn: capture().fn })).not.toThrow();
  });
});

describe('grounded-once stamp (local only, feeds the once-ever star line)', () => {
  it('stamps exactly once', () => {
    expect(stampGroundedOnce(dir)).toBe(true);
    expect(fs.existsSync(path.join(dir, '.grounded-once'))).toBe(true);
    expect(stampGroundedOnce(dir)).toBe(false); // second call: already stamped
  });
});

describe('bundleVersion — a label read from SOURCE.json, never guessed', () => {
  it('reads releaseTag and falls back to "unknown" on absence or weird values', () => {
    expect(bundleVersion(dir)).toBe('unknown'); // no SOURCE.json
    fs.writeFileSync(path.join(dir, 'SOURCE.json'), JSON.stringify({ releaseTag: 'v9.9.9-test' }));
    expect(bundleVersion(dir)).toBe('v9.9.9-test');
    fs.writeFileSync(path.join(dir, 'SOURCE.json'), JSON.stringify({ releaseTag: 'v1 <script>' }));
    expect(bundleVersion(dir)).toBe('unknown'); // fails the charset gate
  });
});
