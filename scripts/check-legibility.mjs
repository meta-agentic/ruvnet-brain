#!/usr/bin/env node
// check-legibility.mjs — the gate for the bug that kept shipping.
//
// WHY (2026-07-17). Twice in one session a diagram shipped whose labels were PRESENT, unclipped,
// non-overflowing, xmllint-clean, zero failed requests — and unreadable. The tips hero rendered its
// labels at 8.1px; the MetaHarness diagram rendered its at 2.9px on a phone. Stuart's words: "I'm
// not sure what that first animation is." He couldn't read it. Every automated check we owned
// passed, because none of them measured the one thing that mattered.
//
// The cause is always the same: an SVG declares font-size in viewBox units, then gets rendered into
// a column narrower than its viewBox. Every label silently multiplies by (renderedWidth/viewBoxWidth).
// A 640-unit viewBox in a 453px column downscales 11.5px type to 8.1px. Nothing errors. It just
// becomes invisible.
//
// This gate exists because of a hard-won distinction (see memory: feedback_never_grade_your_own_work):
// a wall can only enforce FACTS, never TASTE. "Is this beautiful" is not gateable and any gate that
// pretends otherwise just launders an opinion into a receipt. "Is this text >= N effective pixels"
// IS a fact. So we gate exactly that, and nothing more.
//
// It measures via getScreenCTM() — the browser's REAL accumulated transform — not a hand-computed
// ratio, so it survives nested transforms, CSS scaling, and responsive containers.
//
// It measures IN THE REAL PAGE, never the asset in isolation. That distinction is load-bearing: the
// MetaHarness agent tested the asset at 380px and passed, while the real page squeezed it to 261px
// behind gutters and padding. Testing the asset is not testing the page.
//
// Usage:
//   node scripts/check-legibility.mjs --url http://127.0.0.1:7411/tips.html
//   node scripts/check-legibility.mjs --url <url> --min 12 --widths 1440,1024,768 --selector '.hero-scene'
//
// Exit 0 = every label clears --min at every width. Exit 3 = something is too small to read.
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const get = (k, d = null) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

const url = get('url');
const MIN = Number(get('min', 12));
const widths = String(get('widths', '1440,1024,768')).split(',').map(Number);
const selector = get('selector', 'svg');
const themes = String(get('themes', 'dark,light')).split(',');

if (!url) {
  console.error('usage: check-legibility.mjs --url <url> [--min 12] [--widths 1440,1024,768] [--selector svg]');
  process.exit(1);
}

// Playwright lives in the global npm prefix; resolve it rather than assuming a local install.
let chromium;
try {
  const require = createRequire(import.meta.url);
  ({ chromium } = require('playwright'));
} catch {
  try {
    const require = createRequire(import.meta.url);
    ({ chromium } = require('/Users/stuartkerr/.npm-global/lib/node_modules/playwright/index.js'));
  } catch {
    console.error('✗ playwright not resolvable — install it or run this gate where it is available');
    process.exit(1);
  }
}

const browser = await chromium.launch();
const failures = [];
const rows = [];

for (const width of widths) {
  for (const theme of themes) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
    // NOT networkidle: the console holds a live connection open and would time out forever.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // The page keys off data-theme, not just the OS hint — stamp both or the "dark" run is a lie.
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForTimeout(900);

    // Assert the viewport is what we asked for. Playwright's option is `viewport`; the plausible-
    // looking `viewportSize` is SILENTLY IGNORED and renders everything at 1280. That already
    // produced one false report on this project.
    const vp = page.viewportSize();
    if (vp.width !== width) {
      failures.push(`viewport lied: asked ${width}, got ${vp.width}`);
      await page.close();
      continue;
    }

    // (1) INLINE svg — the DOM can see its text, so use the browser's real transform.
    const found = await page.evaluate(({ sel, min }) => {
      const out = [];
      for (const svg of document.querySelectorAll(sel)) {
        if (!svg.getScreenCTM) continue;
        const ctm = svg.getScreenCTM();
        if (!ctm) continue;                       // not rendered (display:none, detached)
        const box = svg.getBoundingClientRect();
        if (box.width === 0) continue;
        for (const t of svg.querySelectorAll('text')) {
          const txt = (t.textContent || '').trim();
          if (!txt) continue;
          const declared = parseFloat(getComputedStyle(t).fontSize);
          if (!declared) continue;
          // ctm.a is the real horizontal scale the browser applies, transforms included.
          const effective = +(declared * ctm.a).toFixed(1);
          out.push({ text: txt.slice(0, 34), declared, effective, ok: effective >= min,
                     svgW: Math.round(box.width) });
        }
      }
      return out;
    }, { sel: selector, min: MIN });

    // (2) <img src="*.svg"> — the whole reason this gate nearly shipped useless. An SVG behind an
    // <img> is a CLOSED document: the parent page cannot see inside it, so pass (1) reports zero
    // labels and the file sails through. That is exactly how metaharness.svg rendered its labels at
    // 2.9px on a phone while every check "passed". So: find the <img>, fetch the SVG's SOURCE,
    // read its viewBox + declared font-sizes, and scale by the img's REAL rendered width.
    const imgSvgs = await page.evaluate(() => {
      const out = [];
      for (const img of document.querySelectorAll('img[src$=".svg"], object[data$=".svg"]')) {
        const box = img.getBoundingClientRect();
        if (box.width === 0) continue;            // not rendered
        out.push({ src: img.getAttribute('src') || img.getAttribute('data'), renderedW: box.width });
      }
      return out;
    });

    for (const { src, renderedW } of imgSvgs) {
      const abs = new URL(src, url).href;
      let text;
      try {
        const r = await page.request.get(abs);
        if (!r.ok()) { failures.push(`${width}px/${theme}: ${src} → HTTP ${r.status()}`); continue; }
        text = await r.text();
      } catch (e) { failures.push(`${width}px/${theme}: ${src} unfetchable (${e.message})`); continue; }

      const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i);
      if (!vb) { rows.push({ width, theme, n: 0, min: null, note: `${src}: no viewBox — cannot scale` }); continue; }
      const scale = renderedW / Number(vb[1]);

      // Declared sizes: font-size="N" attributes, plus font-size:Npx in the SVG's own <style>.
      const sizes = [
        ...[...text.matchAll(/font-size\s*=\s*["']([\d.]+)/gi)].map((m) => Number(m[1])),
        ...[...text.matchAll(/font-size\s*:\s*([\d.]+)px/gi)].map((m) => Number(m[1])),
      ].filter((n) => n > 0);
      if (!sizes.length) { rows.push({ width, theme, n: 0, min: null, note: `${src}: no font-size found` }); continue; }

      const smallest = Math.min(...sizes);
      const effective = +(smallest * scale).toFixed(1);
      rows.push({ width, theme, n: sizes.length, min: effective, svgW: Math.round(renderedW),
                  note: `${src} (img, viewBox ${vb[1]})` });
      if (effective < MIN) {
        failures.push(`${width}px/${theme}: ${src} smallest label → ${effective}px effective ` +
          `(declared ${smallest} in a ${vb[1]}-unit viewBox rendered at ${Math.round(renderedW)}px) — under ${MIN}px`);
      }
    }

    if (!found.length) { rows.push({ width, theme, n: 0, min: null, note: 'no svg <text> found' }); await page.close(); continue; }

    const worst = found.reduce((a, b) => (b.effective < a.effective ? b : a));
    const bad = found.filter((f) => !f.ok);
    rows.push({ width, theme, n: found.length, min: worst.effective, svgW: worst.svgW, bad: bad.length });
    for (const f of bad) {
      failures.push(`${width}px/${theme}: "${f.text}" → ${f.effective}px effective (declared ${f.declared}, svg rendered ${f.svgW}px) — under ${MIN}px`);
    }
    await page.close();
  }
}
await browser.close();

console.log(`legibility · ${url} · min ${MIN}px · selector "${selector}"`);
for (const r of rows) {
  const flag = r.min === null ? '—' : r.min >= MIN ? '✓' : '✗';
  console.log(`  ${flag} ${String(r.width).padStart(4)}px/${r.theme.padEnd(5)}  ${String(r.n).padStart(3)} labels  smallest ${r.min === null ? 'n/a' : r.min + 'px'}${r.note ? '  (' + r.note + ')' : ''}`);
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} label(s) below ${MIN}px effective — present, unclipped, and unreadable:`);
  for (const f of failures.slice(0, 20)) console.error('   ' + f);
  if (failures.length > 20) console.error(`   … and ${failures.length - 20} more`);
  console.error('\n  Usually the viewBox is wider than the column it renders into. Size the viewBox to the');
  console.error('  real render width (≈1:1), or give the figure a min-width + overflow-x:auto container.');
  process.exit(3);
}
console.log(`\n✓ every label ≥ ${MIN}px effective at every width/theme tested`);
