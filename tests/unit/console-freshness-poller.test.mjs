// console-freshness-poller.test.mjs — the page must repaint on a NEW measurement, and only on one.
//
// THE BUG (ranked #4 in docs/RVBC-INSTANT-SPEC.md). The first freshness poller repainted whenever the
// stamp merely CHANGED (`at !== FRESH_BASE`) and ignored `stale`. Three ways that misfires, all of
// them ending with the page telling the user something false:
//   • /api/refresh back-dates the stamp to the epoch on purpose (expire-not-delete). That is a
//     CHANGE, and an epoch stamp is older than everything — the poller would have painted the
//     withdrawn claim as the fresh one, then stopped, and gone green.
//   • A warming answer carries no sections at all; painting it empties the page.
//   • A cache written for another project, or an answer still marked `stale:true`, is by definition
//     not the measurement we are waiting for.
//
// THE RULE, stated once and tested here: repaint only on a STRICTLY NEWER stamp that is ALSO settled
// (`stale === false`) and actually carries sections.
//
// HOW THIS TESTS BROWSER CODE WITHOUT A BROWSER. console/app.js is a classic <script>, not a module,
// so it cannot be imported. `freshLanded()` is written as a PURE function of (response, base) for
// exactly this reason: the test lifts its real source text out of the shipped file and runs it. This
// is the actual shipped implementation, not a re-typed copy — if someone edits the rule in app.js,
// these assertions run against the edit. The final test is the teeth: it fails if the poller stops
// CALLING the rule, which is the one way a correct pure function can still be dead code.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP_JS = path.join(REPO, 'console/app.js');
const src = fs.readFileSync(APP_JS, 'utf8');

/** Lift a named pure function out of app.js and make it callable here.
 *  The `new Function` body is first-party source read from this repo's own console/app.js — the file
 *  under test — never user input or anything that crosses a trust boundary. Test-harness only; the
 *  shipped page never evaluates a string. */
function lift(name) {
  const m = src.match(new RegExp(`function ${name}\\s*\\([\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`${name}() not found in console/app.js — this rule must be a named, pure function`);
  // eslint-disable-next-line no-new-func
  return new Function(`${m[0]}; return ${name};`)();
}

const freshLanded = lift('freshLanded');
const stampWithdrawn = lift('stampWithdrawn');
const settled = (at) => ({ measuredAt: at, stale: false, fromCache: true, sections: { wiring: {} } });

describe('freshLanded — the poller repaints on a strictly newer, settled measurement', () => {
  it('repaints when the stamp is strictly NEWER and the answer is settled', () => {
    expect(freshLanded(settled('2026-07-26T12:00:05.000Z'), '2026-07-26T12:00:00.000Z')).toBe(true);
  });

  it('does NOT repaint on the SAME stamp — the cache has not moved', () => {
    expect(freshLanded(settled('2026-07-26T12:00:00.000Z'), '2026-07-26T12:00:00.000Z')).toBe(false);
  });

  it('does NOT repaint on an OLDER stamp — this is the /api/refresh epoch back-date', () => {
    // expireCachesEmbedding stamps 1970 on purpose. It is a change, it is not an arrival.
    expect(freshLanded(settled('1970-01-01T00:00:00.000Z'), '2026-07-26T12:00:00.000Z')).toBe(false);
  });

  it('does NOT repaint a STALE answer, however new its stamp', () => {
    const st = { ...settled('2026-07-26T12:00:05.000Z'), stale: true };
    expect(freshLanded(st, '2026-07-26T12:00:00.000Z')).toBe(false);
  });

  it('does NOT repaint a WARMING answer — it has no sections to paint', () => {
    expect(freshLanded({ warming: true, scope: '/p', stale: true }, '2026-07-26T12:00:00.000Z')).toBe(false);
    expect(freshLanded({ warming: true, scope: '/p', stale: true }, null)).toBe(false);
  });

  it('does NOT repaint an answer with no sections, even settled and newer', () => {
    expect(freshLanded({ measuredAt: '2026-07-26T12:00:05.000Z', stale: false }, '2026-07-26T12:00:00.000Z')).toBe(false);
  });

  it('paints the FIRST measurement when nothing has been painted yet (base = null)', () => {
    // The cold-open case: the page is all skeletons, FRESH_BASE is null, and the first settled
    // answer to arrive is unambiguously new.
    expect(freshLanded(settled('2026-07-26T12:00:05.000Z'), null)).toBe(true);
  });

  it('refuses an unparseable stamp rather than treating it as new', () => {
    expect(freshLanded({ ...settled('not-a-date'), measuredAt: 'not-a-date' }, '2026-07-26T12:00:00.000Z')).toBe(false);
  });

  it('TEETH: the poller actually CALLS the rule — a correct rule nothing consults is dead code', () => {
    const poller = src.match(/function startFreshnessPolling\s*\([\s\S]*?\n\}\n/);
    expect(poller, 'startFreshnessPolling() not found').toBeTruthy();
    expect(poller[0], 'the poll tick must decide with freshLanded(), not with its own inline comparison')
      .toMatch(/freshLanded\s*\(/);
  });
});

/* THE FABRICATED AGE (found 2026-07-27 by looking at the rendered page, not by a test).
   The server withdraws a claim by back-dating its stamp to the epoch — every write-path invalidation
   does it. The pill divided that by 3600000 and printed "as of 495868h ago" in the header, which is
   a made-up number about the freshness of the very reading it exists to be honest about. */
describe('stampWithdrawn — an expired stamp is not an age', () => {
  it('calls the epoch back-date WITHDRAWN, not 495868 hours old', () => {
    expect(stampWithdrawn(new Date(0).toISOString())).toBe(true);
  });

  it('calls an unparseable stamp withdrawn — we do not know, so we do not say', () => {
    expect(stampWithdrawn('not-a-date')).toBe(true);
    expect(stampWithdrawn(undefined)).toBe(true);
  });

  it('calls a stamp from the FUTURE withdrawn rather than printing a negative age', () => {
    expect(stampWithdrawn(new Date(Date.now() + 400 * 24 * 3600_000).toISOString())).toBe(true);
  });

  it('tolerates a couple of minutes of clock skew — that is skew, not a broken stamp', () => {
    // fmtAge already renders a slightly-negative age as "just now"; refusing it outright would put a
    // scary warning on a perfectly good measurement because two clocks disagree by a second.
    expect(stampWithdrawn(new Date(Date.now() + 30_000).toISOString())).toBe(false);
  });

  it('leaves real ages alone — minutes, hours and days still render as ages', () => {
    for (const ms of [5_000, 60_000, 3 * 3600_000, 5 * 24 * 3600_000]) {
      expect(stampWithdrawn(new Date(Date.now() - ms).toISOString()), `${ms}ms ago is a real age`).toBe(false);
    }
  });

  it('TEETH: renderFreshness consults it before printing an age', () => {
    const fn = src.match(/function renderFreshness\s*\([\s\S]*?\n\}\n/);
    expect(fn, 'renderFreshness() not found').toBeTruthy();
    const body = fn[0];
    expect(body).toMatch(/stampWithdrawn\s*\(/);
    expect(body.indexOf('stampWithdrawn('), 'the guard must come BEFORE the `as of …` line')
      .toBeLessThan(body.indexOf('as of '));
  });
});
