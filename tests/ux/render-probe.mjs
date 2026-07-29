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
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const tick = () => {
      if (settled) return;
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 800 }, (res) => {
        let b = '';
        res.on('data', (c) => {
          if (settled) return;
          b += c;
          if (res.statusCode === 200 && /RuvNet Brain/.test(b)) {
            finish(resolve, Date.now() - start);
            res.destroy();
          } else if (b.length > 65536) {
            b = b.slice(-65536);
          }
        });
        res.on('end', () => {
          if (settled) return;
          if (res.statusCode === 200 && /RuvNet Brain/.test(b)) finish(resolve, Date.now() - start);
          else retry();
        });
        res.on('error', () => { if (!settled) retry(); });
      });
      req.on('error', () => { if (!settled) retry(); });
      req.on('timeout', () => { req.destroy(); if (!settled) retry(); });
    };
    const retry = () => {
      if (settled) return;
      if (Date.now() - start > timeoutMs) finish(reject, new Error('server never became ready'));
      else setTimeout(tick, 150);
    };
    tick();
  });
}

/** Start the console server on `port` with an isolated HOME, and pre-warm its cache if requested. */
function startConsole(port, home) {
  const env = { ...process.env, HOME: home, CONSOLE_PORT: String(port) };
  const child = spawn(process.execPath, [CONSOLE_MJS, '--serve'], { env, stdio: ['ignore', 'pipe', 'pipe'], cwd: REPO });
  // Drain and mirror the isolated fixture's startup output to stderr. The parent UX runner captures
  // only the last stages on failure, so a bind/import crash is diagnosable without polluting JSON.
  child.stdout.on('data', (chunk) => process.stderr.write(`[render-console:stdout] ${String(chunk)}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[render-console:stderr] ${String(chunk)}`));
  child.on('exit', (code, signal) => process.stderr.write(`[render-console:exit] code=${code} signal=${signal}\n`));
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
  const stage = (name) => process.stderr.write(`[render-probe] ${name}\n`);
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
    stage('prewarm:start');
    await prewarm(home);   // make the render measure the WARM common case
    stage('prewarm:done');
    server = startConsole(port, home);
    stage('server:spawned');
    const readyMs = await waitForReady(port);
    stage('server:ready');
    results.push({ label: 'server-ready', selector: 'GET / → 200', ms: readyMs });
    const base = `http://127.0.0.1:${port}`;

    browser = await chromium.launch({ headless: true });
    stage('browser:launched');
    // Chromium's first renderer process is a browser-startup cost, not console render time. On a
    // loaded Windows runner it added 7.9s to one otherwise 376–1031ms page series. Prime one blank
    // renderer before starting the user-facing clock, matching the real "open this in my already
    // running browser" path this warm-console probe claims to measure.
    const warmPage = await browser.newPage();
    await warmPage.goto('about:blank');
    await warmPage.close();
    stage('browser:warmed');
    // 1a — console time-to-visible: #card-capabilities painted
    results.push(await timeToSelector(browser, `${base}/`, '#card-capabilities', 'console time-to-visible'));
    stage('console:visible');
    // 1b — tips time-to-visible: hero + first section painted (grounded selectors from console/tips.html)
    results.push(await timeToSelector(browser, `${base}/tips`, '.hero-scene', 'tips time-to-visible (hero)'));
    stage('tips-hero:visible');
    results.push(await timeToSelector(browser, `${base}/tips`, '#inventory', 'tips first-section'));
    stage('tips-inventory:visible');
  } catch (e) {
    notes.push(`render probe error: ${e.message}`);
  } finally {
    stage('cleanup:start');
    try { if (browser) await browser.close(); } catch {}
    try { if (server) server.kill(); } catch {}
    try { fs.rmSync(home, { recursive: true, force: true }); } catch {}
    stage('cleanup:done');
  }
  return { results, notes };
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('render-probe.mjs')) {
  runRenderProbe().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.notes.length ? 1 : 0); });
}
