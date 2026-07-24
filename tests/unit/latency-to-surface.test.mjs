// latency-to-surface.test.mjs — ADR-028's "single best summary metric", and the ways it could lie.
//
// The metric is a subtraction: (when we told the user) − (when the capability went dormant). Every
// test here targets a way that subtraction could produce a flattering number from true inputs,
// because a proactivity metric that overstates itself is worse than none — it would certify exactly
// the failure the product exists to detect.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  recordObservation, loadStateLog, computeLatencies, summarize, humanMs, DORMANT,
} from '../../scripts/latency-to-surface.mjs';

let dir, LOG;
function sandbox() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'latency-'));
  LOG = path.join(dir, 'capability-states.jsonl');
  return LOG;
}
afterEach(() => { if (dir) { fs.rmSync(dir, { recursive: true, force: true }); dir = null; } });

const H = 3_600_000;
const at = (hoursAgo, now = Date.parse('2026-07-24T12:00:00.000Z')) => new Date(now - hoursAgo * H);
const NOW = Date.parse('2026-07-24T12:00:00.000Z');

describe('recordObservation — only transitions, because sampling rate must not leak into the metric', () => {
  it('records the first sighting of each capability, with from:null', () => {
    const f = sandbox();
    const w = recordObservation([{ key: 'a', state: 'on' }, { key: 'b', state: 'off' }], { file: f });
    expect(w.length).toBe(2);
    expect(w.every((t) => t.from === null)).toBe(true);
  });

  it('WRITES NOTHING when the state is unchanged — the property the whole metric depends on', () => {
    // If every observation appended, "when did it go dormant" would depend on how often the console
    // was opened: identical facts would yield "dormant 1h" for an hourly user and "dormant 1 week"
    // for a weekly one. The onset must be a fact about the capability, not about our sampling.
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'off' }], { file: f });
    const again = recordObservation([{ key: 'a', state: 'off' }], { file: f });
    const third = recordObservation([{ key: 'a', state: 'off' }], { file: f });
    expect(again).toEqual([]);
    expect(third).toEqual([]);
    expect(loadStateLog(f).length).toBe(1);
  });

  it('records a genuine change, and keeps the prior state as `from`', () => {
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'on' }], { file: f });
    const w = recordObservation([{ key: 'a', state: 'idle' }], { file: f });
    expect(w[0]).toMatchObject({ key: 'a', state: 'idle', from: 'on' });
  });

  it('an unwritable log degrades to no history instead of throwing — the console must never break for a metric', () => {
    const w = recordObservation([{ key: 'a', state: 'off' }], { file: '/nonexistent-root-dir/x/y.jsonl' });
    expect(w).toEqual([]);
  });

  it('a corrupt log line is skipped, and the rest of the history survives', () => {
    const f = sandbox();
    fs.writeFileSync(f, '{"v":1,"key":"a","state":"off","at":"2026-07-01T00:00:00.000Z"}\n{ torn\n');
    expect(loadStateLog(f).length).toBe(1);
  });
});

describe('what counts as dormant', () => {
  it('off and idle are dormant; absent and unknown are NOT', () => {
    expect([...DORMANT].sort()).toEqual(['idle', 'off']);
  });

  it('UNKNOWN is never counted as dormancy — "we could not tell" must not become "it is off"', () => {
    // Converting unknown into dormant would inflate the metric with invented dormancy, and it is the
    // exact fabrication the registry's own rule forbids.
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'unknown' }], { file: f, at: at(100) });
    const rows = computeLatencies({ stateLog: loadStateLog(f), outcomes: [], now: NOW });
    expect(rows).toEqual([]);
  });

  it('ABSENT is never counted as dormancy — nothing installed means nothing lying unused', () => {
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'absent' }], { file: f, at: at(100) });
    expect(computeLatencies({ stateLog: loadStateLog(f), outcomes: [], now: NOW })).toEqual([]);
  });
});

describe('the subtraction', () => {
  it('measures told − dormant for a capability we surfaced', () => {
    const f = sandbox();
    recordObservation([{ key: 'cheap-model-routing', state: 'on' }], { file: f, at: at(50) });
    recordObservation([{ key: 'cheap-model-routing', state: 'idle' }], { file: f, at: at(10) });
    const outcomes = [{ id: 'cheap-model-routing', action: 'offered', at: at(4).toISOString() }];

    const rows = computeLatencies({ stateLog: loadStateLog(f), outcomes, now: NOW });
    expect(rows.length).toBe(1);
    expect(rows[0].surfaced).toBe(true);
    expect(rows[0].latencyMs).toBe(6 * H);   // dormant at −10h, told at −4h
  });

  it('an offer made BEFORE this dormancy began does NOT count as surfacing it', () => {
    // Otherwise one old notification would make every future lapse look instantly surfaced — a
    // capability could go dark forever and still report a great latency.
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'off' }], { file: f, at: at(200) });
    recordObservation([{ key: 'a', state: 'on' }], { file: f, at: at(100) });   // fixed
    recordObservation([{ key: 'a', state: 'off' }], { file: f, at: at(20) });   // went dark AGAIN
    const outcomes = [{ id: 'a', action: 'offered', at: at(150).toISOString() }];   // told during the FIRST spell

    const rows = computeLatencies({ stateLog: loadStateLog(f), outcomes, now: NOW });
    expect(rows[0].surfaced, 'the old offer must not credit the new dormancy').toBe(false);
    expect(rows[0].darkMs).toBe(20 * H);
  });

  it('leaving dormancy voids the clock — a fixed capability is not still dark', () => {
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'off' }], { file: f, at: at(80) });
    recordObservation([{ key: 'a', state: 'on' }], { file: f, at: at(5) });
    expect(computeLatencies({ stateLog: loadStateLog(f), outcomes: [], now: NOW })).toEqual([]);
  });

  it('only `offered` counts as telling — an apply or dismissal measures the USER\'s reaction, not ours', () => {
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'off' }], { file: f, at: at(30) });
    const outcomes = [
      { id: 'a', action: 'applied', at: at(20).toISOString() },
      { id: 'a', action: 'dismissed', at: at(15).toISOString() },
    ];
    const rows = computeLatencies({ stateLog: loadStateLog(f), outcomes, now: NOW });
    expect(rows[0].surfaced).toBe(false);
  });

  it('uses the EARLIEST qualifying offer when we spoke more than once', () => {
    const f = sandbox();
    recordObservation([{ key: 'a', state: 'off' }], { file: f, at: at(30) });
    const outcomes = [
      { id: 'a', action: 'offered', at: at(10).toISOString() },
      { id: 'a', action: 'offered', at: at(25).toISOString() },   // earlier — this is when we first told them
    ];
    const rows = computeLatencies({ stateLog: loadStateLog(f), outcomes, now: NOW });
    expect(rows[0].latencyMs).toBe(5 * H);
  });
});

describe('summarize — the honest null, and the number that hides', () => {
  it('reports NULL, never 0, when nothing has been measured', () => {
    // A fresh install has not achieved instant surfacing; it has no measurement. Rendering that as
    // 0 would be the product's first lie about itself.
    const s = summarize([]);
    expect(s.medianMs).toBeNull();
    expect(s.worstMs).toBeNull();
    expect(s.measured).toBe(0);
    expect(humanMs(s.medianMs)).toBe('not measured');
  });

  it('NEVER folds still-dark capabilities into the median — averaging only successes hides the rot', () => {
    // The failure this guards: two capabilities surfaced in an hour, one dark for a month. A mean
    // over everything reports "~1h" and certifies the exact outcome ADR-028 exists to prevent.
    const rows = [
      { key: 'a', surfaced: true, latencyMs: 1 * H, darkMs: null },
      { key: 'b', surfaced: true, latencyMs: 3 * H, darkMs: null },
      { key: 'c', surfaced: false, latencyMs: null, darkMs: 30 * 24 * H },
    ];
    const s = summarize(rows);
    expect(s.measured).toBe(2);
    expect(s.medianMs).toBe(1 * H);        // median of [1h, 3h] — the dark one is absent
    expect(s.stillDark).toBe(1);
    expect(s.longestDarkMs).toBe(30 * 24 * H);
    expect(s.dormantNow).toBe(3);
  });

  it('carries ADR-028\'s 21-day baseline so the number always has something to be judged against', () => {
    expect(summarize([]).baselineDays).toBe(21);
  });
});
