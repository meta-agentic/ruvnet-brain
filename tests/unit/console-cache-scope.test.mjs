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
// as cold instead of serving the wrong project's data. The final test proves the guard is
// load-bearing by removing it (no scopeKey) and watching the stale data leak.
//
// UPDATED 2026-07-26 (RVBC-INSTANT-SPEC #1). "Cold" no longer means "compute inline for this one
// request". That bargain was mispriced — a scope mismatch is the NORMAL state of the second project
// you open, and the inline compute froze the whole single-threaded server (measured: /api/stack, 23.6
// SECONDS) — so cold is now answered instantly with `warming: true` while the detached
// --refresh-cache child measures. The `compute` parameter is gone entirely: a handler that CANNOT
// compute cannot be made to compute by a later edit. These tests changed from "recomputes for the
// current project" to "refuses, says warming, and does not leak" — the isolation guarantee they
// exist for is unchanged.
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
  it('serves a cache whose scope MATCHES the current project', () => {
    const f = tmpFile();
    writeCache(f, AT, { capability: 'projectA-state' }, '/projects/A');
    const res = mockRes();
    serveCached(res, f, (d) => d, '/projects/A');
    expect(res.cap.body.capability).toBe('projectA-state');
    expect(res.cap.body.fromCache).toBe(true);
    expect(res.cap.body.warming, 'a scope match is not warming — it has a measurement to serve').toBeUndefined();
  });

  it("REFUSES a cache computed for a DIFFERENT project — and does not leak a byte of it", () => {
    // The bug, prevented: the file holds project A's state; a request for project B must not see it.
    const f = tmpFile();
    writeCache(f, AT, { capability: 'projectA-ON' }, '/projects/B-is-not-A');
    const res = mockRes();
    serveCached(res, f, (d) => d, '/projects/B');
    expect(res.cap.body.warming, 'a scope mismatch is answered as warming, instantly').toBe(true);
    expect(res.cap.body.scope, 'the answer names the project it is warming for').toBe('/projects/B');
    expect(res.cap.body.capability, "must never serve the other project's state").toBeUndefined();
    expect(res.cap.body.fromCache).toBe(false);
  });

  it('leaves the other project\'s cache UNTOUCHED — the child re-stamps it, not the request', () => {
    // The old cold path wrote the cache from inside the request handler. It does not any more: a
    // read-only endpoint that writes on a miss is how a GET acquires a write path by accident.
    const f = tmpFile();
    writeCache(f, AT, { v: 'A' }, '/projects/A');
    serveCached(mockRes(), f, (d) => d, '/projects/B');
    const onDisk = JSON.parse(fs.readFileSync(f, 'utf8'));
    expect(onDisk.scope, 'the request must not re-scope another project\'s measurement').toBe('/projects/A');
    expect(onDisk.data.v).toBe('A');
  });

  it('a truly cold cache (no file) answers warming and never creates one', () => {
    const f = tmpFile();
    const res = mockRes();
    serveCached(res, f, (d) => d, '/projects/A');
    expect(res.cap.body.warming).toBe(true);
    expect(res.cap.body.stale, 'nothing measured = nothing that may be presented as current').toBe(true);
    expect(res.cap.body.measuredAt).toBe(null);
    expect(fs.existsSync(f), 'a cold READ must not write a cache file').toBe(false);
  });

  it('TEETH: WITHOUT a scopeKey (a machine-level cache), any project\'s cached value is served', () => {
    // Proof the guard is load-bearing: with no scopeKey, serveCached serves whatever is cached,
    // regardless of which project computed it. That is CORRECT for machine-level read-models (the
    // installed stack is the same from any directory) and catastrophic for project-scoped ones —
    // which is exactly why the scoped endpoints pass a key and this one does not.
    const f = tmpFile();
    writeCache(f, AT, { capability: 'projectA-ON' }, '/projects/A');
    const res = mockRes();
    serveCached(res, f); // NO scopeKey
    expect(res.cap.body.warming, 'no scopeKey = no project guard').toBeUndefined();
    expect(res.cap.body.capability).toBe('projectA-ON');
  });

  it('TEETH: the handler has no way to compute — the freeze is structurally unreachable', () => {
    // serveCached's arity is the guarantee. If a `compute` callback is ever threaded back through
    // this function, the 13-49s inline gather becomes reachable again from a GET.
    expect(serveCached.length, 'serveCached(res, file, decorate, scopeKey) — no compute parameter').toBe(2);
    const src = fs.readFileSync(new URL('../../scripts/onboarding-console.mjs', import.meta.url), 'utf8');
    const body = src.match(/function serveCached\([\s\S]*?\n\}/)[0];
    expect(body, 'no gather/scan/compute may be called from the request path')
      .not.toMatch(/\b(gather[A-Z]\w*|scanFleet|computeCapabilities|compute)\s*\(/);
  });
});
