// console-instant-cold.test.mjs — THE HEADLINE ACCEPTANCE BAR (docs/RVBC-INSTANT-SPEC.md).
//
// THE INCIDENT (owner, 2026-07-26/27): typing /rvbc produced ~3 MINUTES of dead air. Where it went,
// measured: a project-scoped cache that belongs to ANOTHER project is treated as COLD, and the cold
// path computed the read-model INLINE, on Node's single thread — gatherState ~13s, gatherStack ~22s,
// scanFleet 40s+ — freezing every other request including the static page while it ran. Because the
// caches are single user-level files, opening the console in a second project makes that the NORMAL
// path, not the rare one.
//
// THE CONTRACT THIS PINS. On a cold or scope-mismatched server:
//   • the static page answers in well under 1.5s, ALWAYS;
//   • /api/state answers in well under 1s with `warming: true` and the scope it is warming FOR —
//     never a computed payload, because the request handler is not allowed to compute at all;
//   • the detached --refresh-cache child, force-kicked by that same request, produces the real
//     measurement afterwards, and the NEXT read is warm and scoped to this project.
//
// WHY `warming:true` IS THE LOAD-BEARING ASSERTION AND NOT JUST THE STOPWATCH. A wall-clock bound
// alone is a fact about this machine's speed on this day. `warming:true` is a fact about the
// ARCHITECTURE: the old inline-compute path could not emit it under any timing, on any machine, so
// this assertion fails on the pre-fix code by construction rather than by luck.
//
// ISOLATION. HOME is a throwaway directory (every cache this server writes is under $HOME) and the
// served project is a throwaway directory too, so this test can never read, re-scope, or clobber the
// caches of the machine it runs on.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONSOLE_MJS = path.join(REPO, 'scripts/onboarding-console.mjs');

let home = null;
let proj = null;
let child = null;
let port = 0;

/** GET, timed. Returns { ms, status, json, bytes } — never throws on a non-JSON body. */
function timedGet(urlPath) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, headers: { Accept: 'application/json' } }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        let json = null;
        try { json = JSON.parse(b); } catch { /* static HTML — the byte count is all we need */ }
        resolve({ ms, status: res.statusCode, json, bytes: b.length });
      });
    });
    req.on('error', reject);
    req.setTimeout(240_000, () => { req.destroy(new Error(`timeout waiting for ${urlPath}`)); });
  });
}

/** Reserve a genuinely free port by binding one and letting go.
 *
 *  NOT `CONSOLE_PORT=0`: the server reads `Number(process.env.CONSOLE_PORT) || 7411`, and 0 is falsy,
 *  so asking for an ephemeral port silently asks for 7411 — the DEFAULT. That is not a cosmetic
 *  detail: 7411 is very likely already serving this developer's REAL console, the server's
 *  already-running check would find it, and every assertion below would then have been measuring the
 *  live machine instead of the cold fixture. Caught exactly that way on the first run of this file. */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

beforeAll(async () => {
  // realpath: on macOS os.tmpdir() is /var/... which is a symlink to /private/var/..., and the
  // server's scope key is its own process.cwd() — already resolved. Comparing the two without this
  // fails on the prefix alone and says nothing about scoping.
  home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rvbc-home-')));
  proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rvbc-proj-')));
  // A small but REAL project root, so the scanners have something to walk. The point of this fixture
  // is a cold cache, not a machine with nothing on it.
  fs.mkdirSync(path.join(home, 'Code', 'other-project', '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, 'Code', 'other-project', '.claude', 'settings.json'), JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'npx ruflo@latest hooks pre-command' }] }] },
  }));
  const want = await freePort();
  port = await new Promise((resolve, reject) => {
    child = spawn(process.execPath, [CONSOLE_MJS, '--serve'], {
      cwd: proj,
      env: { ...process.env, HOME: home, CONSOLE_PORT: String(want), RUVNET_SETTINGS_FILE: path.join(home, 'settings.json') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const t = setTimeout(() => reject(new Error(`server never printed a URL. stdout so far:\n${out}`)), 30_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      out += c;
      if (/already running/.test(out)) { clearTimeout(t); reject(new Error(`the fixture attached to a console it did not start — the assertions would be about someone else's machine:\n${out}`)); return; }
      const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) { clearTimeout(t); resolve(Number(m[1])); }
    });
    child.on('error', reject);
  });
  expect(port, 'the server must bind the port the fixture reserved').toBe(want);
}, 60_000);

afterAll(() => {
  try { if (child && !child.killed) child.kill('SIGKILL'); } catch { /* already gone */ }
  for (const d of [home, proj]) { try { if (d) fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

describe('/rvbc instant open — a cold, scope-mismatched console answers in milliseconds', () => {
  it('static page < 1.5s and /api/state < 1s with warming:true, on a COLD server', async () => {
    // The static page is what the user actually stares at. It must never queue behind a scan.
    const page = await timedGet('/');
    expect(page.status).toBe(200);
    expect(page.bytes).toBeGreaterThan(1000);
    expect(page.ms, `static page took ${page.ms.toFixed(0)}ms — the page must paint, always`).toBeLessThan(1500);

    // The first API call on a cold cache: the whole 3-minute incident lived on this line.
    const st = await timedGet('/api/state');
    expect(st.status).toBe(200);
    expect(st.json, '/api/state must answer JSON').toBeTruthy();
    expect(st.json.warming, 'cold must be answered with warming:true, never a computed payload').toBe(true);
    expect(st.json.scope, 'the warming answer says which project it is warming for').toBe(proj);
    expect(st.ms, `/api/state took ${st.ms.toFixed(0)}ms on a cold cache`).toBeLessThan(1000);

    // …and the server stays answerable WHILE the scan runs. The freeze this replaced took the whole
    // process down with it, so a second request during warming is the real regression check.
    const again = await timedGet('/api/state');
    expect(again.ms, `second cold /api/state took ${again.ms.toFixed(0)}ms`).toBeLessThan(1000);
    const page2 = await timedGet('/');
    expect(page2.ms, `page during warming took ${page2.ms.toFixed(0)}ms`).toBeLessThan(1500);
  }, 120_000);

  it('every heavy endpoint answers cold in milliseconds — not just /api/state', async () => {
    for (const p of ['/api/capabilities', '/api/memory', '/api/stack', '/api/activity']) {
      const r = await timedGet(p);
      expect(r.status, `${p} status`).toBe(200);
      expect(r.ms, `${p} took ${r.ms.toFixed(0)}ms cold`).toBeLessThan(1000);
    }
  }, 120_000);

  it('the force-kicked child lands the real measurement, scoped to THIS project', async () => {
    const deadline = Date.now() + 150_000;
    let st = await timedGet('/api/state');
    while (Date.now() < deadline && st.json && st.json.warming) {
      await new Promise((r) => setTimeout(r, 1000));
      st = await timedGet('/api/state');
    }
    expect(st.json.warming, 'the detached child must eventually produce a measurement').toBeFalsy();
    expect(st.json.sections, 'a settled answer carries the real sections').toBeTruthy();
    expect(st.ms, `warm /api/state took ${st.ms.toFixed(0)}ms`).toBeLessThan(1000);
    const cache = JSON.parse(fs.readFileSync(path.join(home, '.claude/ruvnet-brain/state-cache.json'), 'utf8'));
    expect(cache.scope, 'the child stamps the cache with the served project').toBe(proj);
  }, 200_000);
});
