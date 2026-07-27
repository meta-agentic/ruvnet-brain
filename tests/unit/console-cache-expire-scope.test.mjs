// console-cache-expire-scope.test.mjs — expiring a cache must not silently DE-SCOPE it.
//
// THE BUG (found in the 2026-07-26 duel of the freshness work, ranked #3 in docs/RVBC-INSTANT-SPEC.md).
// `expireCachesEmbedding()` back-dates a cache's stamp so the next reader sees a withdrawn claim
// instead of a fresh-looking lie — the right doctrine, and it is used on the two hottest write paths
// (setLesson → CAPABILITY_CACHE, /api/refresh → all four). But it rewrote the record with
// `writeCache(f, j.at, j.data)` — three arguments — and `writeCache`'s fourth parameter, `scope`,
// DEFAULTS TO NULL. So every expire silently erased which project the measurement belonged to.
//
// WHY THAT IS WORSE THAN IT LOOKS. A scope of null against a project-scoped read is a scope MISMATCH,
// and serveCached treats a mismatch as COLD. Before the instant-open fix, cold meant "compute inline
// for 13-49 seconds on the event loop". So the helper written specifically to AVOID the freeze
// ("EXPIRE, DO NOT DELETE — with no cache file the next request takes the COLD path") reintroduced
// exactly that freeze by another door: not by deleting the file, but by deleting its identity.
//
// THE GUARD: expire preserves `scope` byte-for-byte and back-dates only `at`.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expireCachesEmbedding, writeCache } from '../../scripts/onboarding-console.mjs';

let dir = null;
afterEach(() => { if (dir) { fs.rmSync(dir, { recursive: true, force: true }); dir = null; } });
function tmpFile(name = 'cache.json') {
  dir = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'expire-scope-'));
  return path.join(dir, name);
}
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const AT = '2026-07-26T12:00:00.000Z';

describe('expireCachesEmbedding — withdraws the claim, keeps the identity', () => {
  it('PRESERVES scope while back-dating the stamp', () => {
    const f = tmpFile();
    writeCache(f, AT, { v: 'measured-for-A' }, '/projects/A');
    expireCachesEmbedding([f]);
    const j = read(f);
    expect(j.scope, 'the expired record still belongs to the project that measured it').toBe('/projects/A');
    expect(Date.parse(j.at), 'the stamp is back-dated past any ceiling').toBe(0);
    expect(j.data.v, 'the DATA survives — expire is not delete').toBe('measured-for-A');
  });

  it('leaves an unscoped (machine-level) cache unscoped — it does not invent a scope', () => {
    const f = tmpFile('machine.json');
    writeCache(f, AT, { v: 'machine-wide' });
    expireCachesEmbedding([f]);
    expect(read(f).scope).toBe(null);
    expect(Date.parse(read(f).at)).toBe(0);
  });

  it('expires several caches in one call, each keeping its own scope', () => {
    const a = tmpFile('a.json');
    const b = tmpFile('b.json');
    writeCache(a, AT, { v: 1 }, '/projects/A');
    writeCache(b, AT, { v: 2 }, '/projects/B');
    expireCachesEmbedding([a, b]);
    expect(read(a).scope).toBe('/projects/A');
    expect(read(b).scope).toBe('/projects/B');
  });

  it('is a no-op on a cache that does not exist — a missing file is not an error', () => {
    const f = tmpFile('absent.json');
    expect(() => expireCachesEmbedding([f])).not.toThrow();
    expect(fs.existsSync(f), 'expire must never CREATE a cache file').toBe(false);
  });
});
