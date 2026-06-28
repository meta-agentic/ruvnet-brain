#!/usr/bin/env node
// self-update.mjs — nightly evergreen driver.
// Compares each in-scope repo's live HEAD against the stamped manifest, then (re)builds the segments
// that changed and re-stamps. Dry-run by default; pass --apply to actually (re)build.
//
//   node scripts/self-update.mjs                 # dry-run: print the rebuild plan
//   node scripts/self-update.mjs --apply         # rebuild stale/pending repos (serial; embedding is CPU-bound)
//   node scripts/self-update.mjs --apply --tier T0   # limit scope
//   node scripts/self-update.mjs --apply --repo ruflo
//
// Designed to be invoked by deploy/com.ruvnet.brain-nightly.plist (LaunchAgent — NOT auto-installed).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (f) => process.argv.includes(f);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const APPLY = has('--apply');
const TIER = arg('--tier', null);
const ONLY = arg('--repo', null);
const MODEL_CACHE = '/Users/stuartkerr/Code/PowerPlatePulse/scripts/models-cache';

const KNOWN_CLONES = { ruflo: '/Users/stuartkerr/Code/ruvnet-repos/ruflo', RuLake: '/Users/stuartkerr/Code/RuLake' };
const CLONE_DIR = path.join(ROOT, 'clones');
// --full source-dir hints per repo (extend as repos onboard; default = whole tree, docs+manifests+lead-comments)
const FULL_HINTS = { ruflo: 'v3/@claude-flow,v3/mcp,ruflo/src' };

const tiers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registry.tiers.json'), 'utf8'));
const manifest = fs.existsSync(path.join(ROOT, 'data/manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8')) : { builtRepos: [] };
// case-insensitive: registry names are capitalized (RuVector) but built artifacts are lowercase (ruvector)
const builtSha = Object.fromEntries(manifest.builtRepos.map((r) => [r.name.toLowerCase(), r.builtFromSha]));

const remoteHead = (slug) => {
  try { return execFileSync('git', ['ls-remote', `https://github.com/ruvnet/${slug}`, 'HEAD'], { timeout: 30000 }).toString().split(/\s/)[0] || null; }
  catch { return null; }
};
const clonePath = (name) => KNOWN_CLONES[name] || path.join(CLONE_DIR, name);

const inScope = [];
for (const t of ['T0', 'T1', 'T2', 'T3']) {
  if (TIER && t !== TIER) continue;
  for (const r of tiers.tiers[t].repos) {
    if (ONLY && r.name !== ONLY) continue;
    if (t === 'T3' && !ONLY) continue;            // T3 is deep-walked on demand, not nightly
    inScope.push({ ...r, tier: t });
  }
}

const plan = [];
for (const r of inScope) {
  const live = remoteHead(r.name);
  const built = builtSha[r.name.toLowerCase()] || null;
  let action = 'up-to-date';
  if (!built) action = 'build (new)';
  else if (live && built !== 'unknown' && live !== built) action = 'rebuild (changed)';
  plan.push({ name: r.name, tier: r.tier, built: built?.slice(0, 12) || '—', live: live?.slice(0, 12) || '?', action });
}

console.log(`self-update ${APPLY ? '(APPLY)' : '(dry-run)'} — ${plan.length} repos in scope\n`);
for (const p of plan) console.log(`  ${p.action.padEnd(20)} ${p.tier} ${p.name.padEnd(24)} built:${p.built}  live:${p.live}`);
// SAFE NIGHTLY SCOPE: by default only REBUILD already-built repos whose upstream changed (keeps the
// shipped bundle current). Building brand-new repos is a supervised, multi-hour scaling effort, NOT an
// unattended nightly job — gate it behind --include-new so the cron can't silently try to deep-walk 40+
// repos (days of compute) on its first run.
const INCLUDE_NEW = has('--include-new');
const changed = plan.filter((p) => p.action === 'rebuild (changed)');
const newRepos = plan.filter((p) => p.action === 'build (new)');
const todo = INCLUDE_NEW ? [...changed, ...newRepos] : changed;
console.log(`\nrebuild(changed): ${changed.map((p) => p.name).join(', ') || 'none'}`);
console.log(`new(not built): ${newRepos.length} repos${INCLUDE_NEW ? ' — INCLUDED (--include-new)' : ' — SKIPPED (supervised; pass --include-new to build)'}`);
console.log(`→ this run will (re)build ${todo.length}: ${todo.map((p) => p.name).join(', ') || 'none'}`);

if (!APPLY) { console.log('\n(dry-run — pass --apply to (re)build; runs serially since embedding is CPU-bound)'); process.exit(0); }

for (const p of todo) {
  const dir = clonePath(p.name);
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) {
      console.log(`[clone] ${p.name}`);
      fs.mkdirSync(CLONE_DIR, { recursive: true });
      execFileSync('git', ['clone', '--depth', '1', `https://github.com/ruvnet/${p.name}`, dir], { stdio: 'inherit' });
    } else {
      execFileSync('git', ['-C', dir, 'fetch', '--depth', '1', 'origin'], { stdio: 'inherit' });
      execFileSync('git', ['-C', dir, 'reset', '--hard', 'origin/HEAD'], { stdio: 'inherit' });
    }
    const env = { ...process.env, KB_MODEL_CACHE: MODEL_CACHE };
    const kb = p.name.toLowerCase();                 // artifacts are lowercase (ruvector.rvf), registry name is RuVector
    const full = FULL_HINTS[kb];
    const buildArgs = ['forge-build.mjs', '--repo', dir, '--out', '.', '--name', kb,
      '--canonical-url', `https://raw.githubusercontent.com/stuinfla/ruvnet-brain/main/kb`];
    if (full) buildArgs.push('--full', full);
    console.log(`[build] ${kb}`);
    execFileSync('node', buildArgs, { cwd: path.join(ROOT, 'kb'), env, stdio: 'inherit' });
    console.log(`[sharp] ${kb}`);
    execFileSync('node', ['forge-big.mjs', 'both', '--dir', '.', '--name', kb], { cwd: path.join(ROOT, 'kb'), env, stdio: 'inherit' });
    console.log(`[symbols] ${kb}`);
    execFileSync('node', ['scripts/build-symbols.mjs', '--name', kb], { cwd: ROOT, env, stdio: 'inherit' });
  } catch (e) { console.error(`[FAIL] ${p.name}: ${e.message}`); }
}
console.log('\n[stamp] re-stamping bundle');
execFileSync('node', ['scripts/brain-stamp.mjs'], { cwd: ROOT, stdio: 'inherit' });
// refresh the shipped bundle so the rebuilt deep-source ships (concepts/primers/L2 are supervised — not regenerated here)
console.log('[bundle] re-assembling dist/ruvnet-brain');
execFileSync('node', ['scripts/build-bundle.mjs'], { cwd: ROOT, env: { ...process.env, KB_MODEL_CACHE: MODEL_CACHE }, stdio: 'inherit' });
console.log('self-update done. (Deep-source refreshed + bundle re-assembled. Primer/L2/concepts + grading are supervised steps — re-run them when a repo materially changes.)');
