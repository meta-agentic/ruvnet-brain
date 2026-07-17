import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The v3.1.0 lesson (2026-07-16): version STRINGS were gated, but the page's STORY was not —
// the public explainer said "What's new in 2.0" through three releases, and the README sat on
// 2.5 while 3.1 shipped. Prose is a version surface. This gate fails the build whenever any
// public narrative names a non-current version, because nobody's eyes are a gate.
const ROOT = process.cwd();
const current = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'plugin/.claude-plugin/plugin.json'), 'utf8'),
).version;
const mm = current.split('.').slice(0, 2).join('.');

const SURFACES = ['README.md', 'explainer/index.html', 'primer/ruvnet-primer.md'];

describe(`narrative version claims match the shipping version (${current})`, () => {
  for (const f of SURFACES) {
    it(`${f} — every "What's new in X" says ${mm}`, () => {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      // Strip HTML tags first so a version wrapped in markup — e.g. the explainer's
      // `What's new in <span class="grad">3.2</span>` — is still caught. That exact tag-split
      // hid a stale "3.2" on the LIVE explainer while 3.4 shipped (Stuart caught it 2026-07-17);
      // the old regex only matched contiguous text and sailed right past it. Never again.
      // …AND decode the apostrophe entities HTML uses (&rsquo; / &#8217; / &apos; / &#39;), because
      // the explainer writes "What&rsquo;s new in" — the entity, not a literal ', so even after tag
      // stripping the old regex's [’']? never matched. Both gaps (tags + entities) hid the same 3.2.
      const src = (f.endsWith('.html') ? raw.replace(/<[^>]+>/g, '') : raw)
        .replace(/&(?:rsquo|apos|#8217|#39);/gi, "'");
      const hits = [...src.matchAll(/what[’']?s new in (\d+\.\d+)/gi)].map((m) => m[1]);
      const stale = hits.filter((v) => v !== mm);
      expect(stale, `${f} still claims "What's new in ${stale.join(', ')}" while ${current} is shipping`).toEqual([]);
    });
  }

  it('public surfaces never teach retired command names (the /configure→/rvbc rename, told 4×)', () => {
    const BANNED = [/run <code>\/configure<\/code>/, /\/ruvnet-brain:configure/, /run `\/configure`/];
    for (const f of ['README.md', 'explainer/index.html']) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const hits = BANNED.filter((re) => re.test(src)).map(String);
      expect(hits, `${f} still teaches a retired command: ${hits.join(', ')}`).toEqual([]);
    }
  });

  it('explainer social meta tags carry no version number (versioned og tags rot silently)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'explainer/index.html'), 'utf8');
    const metas = src.split('\n').filter((l) => /property="og:(title|description|image:alt)"|name="twitter:(title|description)"/.test(l));
    const versioned = metas.filter((l) => /\b\d+\.\d+(\.\d+)?\b/.test(l));
    expect(versioned, `versioned social meta lines:\n${versioned.join('\n')}`).toEqual([]);
  });

  // The 2026-07-16 share-card failure: og-hero-2.png had "VERSION 2.0" BAKED INTO ITS PIXELS,
  // so every WhatsApp/iMessage/Twitter preview said 2.0 while the page said 3.2 — and no string
  // gate can read pixels. The og image is therefore hash-CERTIFIED: this constant is only ever
  // updated by a human-in-the-loop who has LOOKED at the new image and confirmed it carries no
  // version number. Swapping the file without re-certifying fails the build.
  const CERTIFIED_OG = {
    file: 'explainer/assets/img/og-hero-3.png',
    sha256: '1abfc99834b5aadf97196a364823960011d13c989e3209f93bcd89e610c878ec',
  };

  it('og/twitter image points at the certified version-free asset', () => {
    const src = fs.readFileSync(path.join(ROOT, 'explainer/index.html'), 'utf8');
    const imgs = [...src.matchAll(/(?:property="og:image"|name="twitter:image")\s+content="([^"]+)"/g)].map((m) => m[1]);
    expect(imgs.length, 'expected og:image and twitter:image tags').toBeGreaterThanOrEqual(2);
    for (const u of imgs) {
      expect(u.endsWith(path.basename(CERTIFIED_OG.file)), `${u} is not the certified share image`).toBe(true);
    }
  });

  it('the certified share image bytes are unchanged since certification (pixels can lie; hashes cannot)', async () => {
    const { createHash } = await import('node:crypto');
    const buf = fs.readFileSync(path.join(ROOT, CERTIFIED_OG.file));
    const got = createHash('sha256').update(buf).digest('hex');
    expect(got, `og image changed — LOOK at it, confirm no version in the pixels, then update CERTIFIED_OG.sha256`).toBe(CERTIFIED_OG.sha256);
  });

  it('the retired version-stamped share image is gone from the repo', () => {
    expect(fs.existsSync(path.join(ROOT, 'explainer/assets/img/og-hero-2.png')), 'og-hero-2.png (VERSION 2.0 in pixels) must not exist').toBe(false);
  });

  // The 2026-07-16 bundle-size failure: "512 MB" was hand-typed on Jun 30; the nightly-grown
  // bundle was 738 MB when Stuart demoed the page. Sizes and corpus counts may only render via
  // the live tether ([data-brain-size] filled from releases/latest at page load) or a stamped
  // sync script — never as static prose. This bans the whole class, not the one number.
  it('public surfaces carry no hand-typed bundle size (NNN MB)', () => {
    for (const f of ['README.md', 'explainer/index.html', 'primer/ruvnet-primer.md']) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const hits = [...src.matchAll(/\b\d{3,}\s*(?:&nbsp;)?MB\b/g)].map((m) => m[0]);
      expect(hits, `${f} hand-types a bundle size: ${hits.join(', ')} — use the live tether instead`).toEqual([]);
    }
  });

  it('the explainer live-size tether exists (spans + fetch)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'explainer/index.html'), 'utf8');
    expect((src.match(/data-brain-size/g) || []).length, 'expected >=3 data-brain-size spans + the fetch script').toBeGreaterThanOrEqual(4);
    expect(src.includes('releases/latest'), 'tether must read from releases/latest').toBe(true);
  });
});
