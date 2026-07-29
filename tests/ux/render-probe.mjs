// render-probe.mjs — MEASURED time-to-visible for the console and the tips page.
//
// What it measures (the owner's ask, verbatim intent): "How long it takes for the console and the
// tips page to show up on the computer." We start the REAL console server, drive a REAL browser
// (Playwright chromium, already installed), and time server-ready → the key content actually PAINTED
// (not merely "response received"): the console's #card-capabilities and the tips page's hero + first
// section. Every number is captured on THIS run — none is asserted from memory.
//
// MODEL-FREE: this probe drives a browser and an HTTP server. It calls no LLM, uses no API key, and
// touches no account. It is deterministic timing, which is the cleanest possible satisfaction of the
// owner's "no API keys" rule for the QE suite.
//
// It runs the console WARM (against a pre-warmed temp HOME cache) so the number is the common-case
// "open the console" experience, not a one-time cold scan. Cold-start behaviour (the "it's live"
// completion signal) is a SEPARATE probe — command-probe.mjs — because it measures a different thing.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is resolved via createRequire (CJS resolution), NOT a bare ESM `import`. Reason, verified
// live 2026-07-24: on this Mac playwright is a GLOBAL install (~/.npm-global/lib/node_modules), and
// Node's ESM bare-specifier resolver does not consult the global folder — only CJS require does. In CI
// playwright is a node_modules devDependency, which createRequire also finds. So this one line makes
// the probe portable across "global on the dev box" and "local in CI" without a machine-specific path.
const require = createRequire(import.meta.url);
let chromium = null, playwrightLoadError = null;
try { ({ chromium } = require('playwright')); }
catch (e) { try { ({ chromium } = require('@playwright/test')); } catch (e2) { playwrightLoadError = e.message; } }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CONSOLE_MJS = path.join(REPO, 'scripts', 'onboarding-console.mjs');

/** Poll GET / until the server answers 200 with the console HTML, or time out. Returns ms-to-ready. */
function waitForReady(port, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 800 }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; if (b.length > 8192) res.destroy(); });
        res.on('end', () => {
          if (res.statusCode === 200 && /RuvNet Brain/.test(b)) resolve(Date.now() - start);
          else retry();
        });
        res.on('error', retry);
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => { if (Date.now() - start > timeoutMs) reject(new Error('server never became ready')); else setTimeout(tick, 150); };
    tick();
  });
}

/** Start the console server on `port` with an isolated HOME, and pre-warm its cache if requested. */
function startConsole(port, home) {
  const env = { ...process.env, HOME: home, CONSOLE_PORT: String(port) };
  const child = spawn(process.execPath, [CONSOLE_MJS, '--serve'], { env, stdio: ['ignore', 'pipe', 'pipe'], cwd: REPO });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});   // drain, don't block
  return child;
}

/** Pre-warm the cache in the temp HOME by running --refresh-cache once, so the render is warm-path. */
function prewarm(home) {
  return new Promise((resolve) => {
    const env = { ...process.env, HOME: home };
    const child = spawn(process.execPath, [CONSOLE_MJS, '--refresh-cache'], { env, stdio: 'ignore', cwd: REPO });
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    child.on('exit', finish);
    child.on('error', finish);
    const timer = setTimeout(() => { try { child.kill(); } catch {} finish(); }, 60000);
  });
}

async function timeToSelector(browser, url, selector, label) {
  const page = await browser.newPage();
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  const ms = Date.now() - t0;
  await page.close();
  return { label, selector, ms };
}

export async function runRenderProbe() {
  if (!chromium) {
    return { results: [], notes: [`playwright not loadable (${playwrightLoadError}) — render probe NOT RUN, never faked as pass`] };
  }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'uxqe-home-'));
  fs.mkdirSync(path.join(home, '.claude', 'ruvnet-brain'), { recursive: true });
  const port = 7500 + (process.pid % 400);   // avoid the user's live 7411; vary per run without Date/random
  let server, browser;
  const results = [];
  const notes = [];
  try {
    await prewarm(home);   // make the render measure the WARM common case
    server = startConsole(port, home);
    const readyMs = await waitForReady(port);
    results.push({ label: 'server-ready', selector: 'GET / → 200', ms: readyMs });
    const base = `http://127.0.0.1:${port}`;

    browser = await chromium.launch({ headless: true });
    // 1a — console time-to-visible: #card-capabilities painted
    results.push(await timeToSelector(browser, `${base}/`, '#card-capabilities', 'console time-to-visible'));
    // 1b — tips time-to-visible: hero + first section painted (grounded selectors from console/tips.html)
    results.push(await timeToSelector(browser, `${base}/tips`, '.hero-scene', 'tips time-to-visible (hero)'));
    results.push(await timeToSelector(browser, `${base}/tips`, '#inventory', 'tips first-section'));
  } catch (e) {
    notes.push(`render probe error: ${e.message}`);
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { if (server) server.kill(); } catch {}
    try { fs.rmSync(home, { recursive: true, force: true }); } catch {}
  }
  return { results, notes };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('render-probe.mjs')) {
  runRenderProbe().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.notes.length ? 1 : 0); });
}
