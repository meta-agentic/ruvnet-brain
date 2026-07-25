// console-cache-scope.test.mjs — one project's cached state must never be served for another.
//
// THE BUG (found 2026-07-24 while verifying the capability checkbox). The console's read-model caches
// (capability/state/memory) live in ONE user-level file each (~/.claude/ruvnet-brain/*-cache.json),
// NOT keyed by project. Two consoles in different projects — or one opened in project B minutes after
// project A — shared the file, so B was served A's project-scoped capability state. That is exactly
// the "you think it's on, but it isn't" failure the whole console exists to prevent: memory-
// distillation could read ON (from project A's real store) while project B has nothing distilled.
//
// The compounding cause was the background refresh child spawning with cwd=REPO (the plugin dir), so
// it recomputed project-scoped state for the wrong directory entirely — fixed in kickRefresh().
//
// THE GUARD tested here: serveCached(..., scopeKey) treats a cache computed for a DIFFERENT project
// as cold, recomputing for the current one instead of serving the wrong project's data. The final
// test proves the guard is load-bearing by removing it (no scopeKey) and watching the stale data leak.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serveCached, writeCache } from '../../scripts/onboarding-console.mjs';

let dir;
afterEach(() => { if (dir) { fs.rmSync(dir, { recursive: true, force: true }); dir = null; } });
function tmpFile() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-scope-'));
  return path.join(dir, 'cache.json');
}

/** A mock http response that captures the single JSON payload serveCached sends. */
function mockRes() {
  const cap = { code: null, body: null };
  return {
    cap,
    writeHead(code) { cap.code = code; },
    end(body) { cap.body = JSON.parse(body); },
  };
}

const AT = '2026-07-24T00:00:00.000Z';

describe('serveCached scopeKey — cross-project isolation', () => {
  it('serves a cache whose scope MATCHES the current project, without recomputing', () => {
    const f = tmpFile();
    writeCache(f, AT, { capability: 'projectA-state' }, '/projects/A');
    const res = mockRes();
    let computed = false;
    serveCached(res, f, () => { computed = true; return { at: AT, data: { capability: 'FRESH' } }; }, (d) => d, '/projects/A');
    expect(computed, 'a scope match must serve the cache, not recompute').toBe(false);
    expect(res.cap.body.capability).toBe('projectA-state');
    expect(res.cap.body.fromCache).toBe(true);
  });

  it('REFUSES a cache computed for a DIFFERENT project — recomputes for the current one', () => {
    // The bug, prevented: the file holds project A's state; a request for project B must not see it.
    const f = tmpFile();
    writeCache(f, AT, { capability: 'projectA-ON' }, '/projects/A');
    const res = mockRes();
    let computed = false;
    serveCached(res, f, () => { computed = true; return { at: AT, data: { capability: 'projectB-OFF' } }; }, (d) => d, '/projects/B');
    expect(computed, 'a scope mismatch must recompute for THIS project').toBe(true);
    expect(res.cap.body.capability, "must never serve the other project's state").toBe('projectB-OFF');
    expect(res.cap.body.fromCache).toBe(false);
  });

  it('re-stamps the cache with the new project, so the next same-project request is a hit', () => {
    const f = tmpFile();
    writeCache(f, AT, { v: 'A' }, '/projects/A');
    serveCached(mockRes(), f, () => ({ at: AT, data: { v: 'B' } }), (d) => d, '/projects/B'); // mismatch → recompute + re-stamp
    const res2 = mockRes();
    let computed = false;
    serveCached(res2, f, () => { computed = true; return { at: AT, data: { v: 'B2' } }; }, (d) => d, '/projects/B');
    expect(computed, 'after re-stamping to B, a B request is a cache hit').toBe(false);
    expect(res2.cap.body.v).toBe('B');
  });

  it('a truly cold cache (no file) computes in-band once — the documented first-load bargain', () => {
    const f = tmpFile();
    const res = mockRes();
    serveCached(res, f, () => ({ at: AT, data: { v: 'seed' } }), (d) => d, '/projects/A');
    expect(res.cap.body.v).toBe('seed');
    expect(res.cap.body.fromCache).toBe(false);
    expect(JSON.parse(fs.readFileSync(f, 'utf8')).scope, 'the seed write must stamp the scope').toBe('/projects/A');
  });

  it('TEETH: WITHOUT a scopeKey (the old behavior), the wrong project\'s state leaks through', () => {
    // Proof the guard is load-bearing: with no scopeKey, serveCached serves whatever is cached,
    // regardless of which project computed it — the exact bug. If this ever starts recomputing
    // instead, the scope guard has been wired into the no-key path by mistake.
    const f = tmpFile();
    writeCache(f, AT, { capability: 'projectA-ON' }, '/projects/A');
    const res = mockRes();
    let computed = false;
    serveCached(res, f, () => { computed = true; return { at: AT, data: { capability: 'projectB-OFF' } }; }); // NO scopeKey
    expect(computed, 'no scopeKey = no project guard = serves the stale cache').toBe(false);
    expect(res.cap.body.capability).toBe('projectA-ON'); // the leak the scoped path prevents
  });
});
