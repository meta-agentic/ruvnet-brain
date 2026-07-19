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
import { FULL_HINTS, KEEP_DIRS } from './full-hints.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// launchd delivers a minimal PATH, and the plist-level export has now failed across TWO separate
// reloads for TWO separate reasons: (2026-07-10) `gh release create` ENOENT, pid 0, while the
// loaded plist showed the export; (2026-07-12) launchd's WorkingDirectory was unset entirely so
// the job never even reached this file. Both are now fixed at the plist level too, but the script
// guarantees its own environment regardless: /usr/local/bin FIRST (that's the node every build
// tonight was tested and gated against — 22.13.1; homebrew independently upgraded to 25.9.0,
// which cannot load kb/'s native @ruvector/rvf module) and every spawned tool resolved to an
// absolute path, never bare-name PATH lookup — a bare `node`/`gh` silently picks up whichever
// version macOS or homebrew put first, and that has now broken this pipeline twice.
process.env.PATH = ['/usr/local/bin', '/opt/homebrew/bin', process.env.PATH || ''].join(':');
const GH = ['/usr/local/bin/gh', '/opt/homebrew/bin/gh'].find((p) => fs.existsSync(p)) || 'gh';
const NODE = ['/usr/local/bin/node', '/opt/homebrew/bin/node'].find((p) => fs.existsSync(p)) || process.execPath;
// Fourth instance of the same disease: kb/resolve-deps.mjs's loadRvf()/loadTransformers() fall
// back to NODE_PATH / bare require() resolution, which only works when the invoking shell's rc
// files happened to export it — true for an interactive login shell, silently false for launchd's
// bash -lc (non-interactive, so any `[[ $- != *i* ]] && return`-style guard in .bash_profile skips
// the rest of the file). Never depend on ambient shell state for a scheduled job again: pin both
// deps to their real, verified absolute locations via resolve-deps.mjs's own explicit overrides.
if (!process.env.RVF_MODULE_PATH && fs.existsSync('/Users/stuartkerr/.npm-global/lib/node_modules/@ruvector/rvf')) {
  process.env.RVF_MODULE_PATH = '/Users/stuartkerr/.npm-global/lib/node_modules';
}
if (!process.env.XENOVA_PATH && fs.existsSync('/Users/stuartkerr/.npm-global/node_modules/@xenova/transformers')) {
  process.env.XENOVA_PATH = '/Users/stuartkerr/.npm-global/node_modules/@xenova/transformers';
}
const has = (f) => process.argv.includes(f);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const APPLY = has('--apply');
const TIER = arg('--tier', null);
const ONLY = arg('--repo', null);
// --fresh-window <days>: LIVE-scan the org(s) and take every non-fork/non-archived repo pushed within
// N days, bypassing the static registry.tiers.json AND the nightly T3 skip. This is THE fix for
// "new repos rUv shipped never got ingested" — a brand-new repo is discovered and built the same night
// it appears, but only within the rolling window, so the old "days of compute for all 173" risk that the
// tier gate guarded against still cannot happen. Absent this flag, scoping is byte-for-byte unchanged.
const FRESH_WINDOW = arg('--fresh-window', null);
const MODEL_CACHE = process.env.KB_MODEL_CACHE || path.join(ROOT, 'kb', 'models-cache');

// Optional author-side clone overrides via env (JSON map); default empty → uses CLONE_DIR/<name>.
const KNOWN_CLONES = JSON.parse(process.env.RUVNET_KNOWN_CLONES || '{}');
const CLONE_DIR = path.join(ROOT, 'clones');
// --full / --keep depth config per repo: SHARED map in scripts/full-hints.mjs (also used by
// ingest-repo.mjs, which previously had NO hints and silently zeroed full-body indexing on any
// rebuild routed through it). History + derivation rationale preserved in that file.

const tiers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registry.tiers.json'), 'utf8'));
const manifest = fs.existsSync(path.join(ROOT, 'data/manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8')) : { builtRepos: [] };
// case-insensitive: registry names are capitalized (RuVector) but built artifacts are lowercase (ruvector)
const builtSha = Object.fromEntries(manifest.builtRepos.map((r) => [r.name.toLowerCase(), r.builtFromSha]));

// owner/repo default to 'ruvnet'/<name> so existing registry entries (no owner/repo field) are
// unaffected; a repo living outside the ruvnet org (e.g. a different GitHub org) sets both.
const remoteHead = (owner, slug) => {
  try { return execFileSync('git', ['ls-remote', `https://github.com/${owner}/${slug}`, 'HEAD'], { timeout: 30000 }).toString().split(/\s/)[0] || null; }
  catch { return null; }
};
const clonePath = (name) => KNOWN_CLONES[name] || path.join(CLONE_DIR, name);

let inScope = [];
if (FRESH_WINDOW) {
  const days = parseInt(FRESH_WINDOW, 10);
  if (!Number.isFinite(days) || days <= 0) { console.error(`--fresh-window needs a positive day count, got "${FRESH_WINDOW}"`); process.exit(2); }
  const cutoff = Date.now() - days * 86400 * 1000;
  const orgs = (process.env.RUVNET_FRESH_ORGS || 'ruvnet').split(',').map((s) => s.trim()).filter(Boolean);
  let orgFailures = 0;
  for (const org of orgs) {
    let rows;
    try {
      rows = JSON.parse(execFileSync(GH, ['repo', 'list', org, '--limit', '1000', '--json', 'name,pushedAt,isFork,isArchived'], { timeout: 60000 }).toString());
    } catch (e) { orgFailures++; console.error(`[fresh-window] gh repo list ${org} FAILED: ${e.message} — skipping org (nothing from it this run)`); continue; }
    for (const r of rows) {
      if (r.isFork || r.isArchived) continue;
      if (new Date(r.pushedAt).getTime() < cutoff) continue;
      inScope.push({ name: r.name, owner: org, repo: r.name, tier: `${days}d`, pushedAt: r.pushedAt });
    }
  }
  if (ONLY) inScope = inScope.filter((r) => r.name === ONLY);
  // FENCE: deliberately-removed (helix — a downstream consumer app) + empty repos must NOT be silently
  // re-added by the rolling window. data/nightly-exclude.json is the one editable list; every drop logged.
  const exPath = path.join(ROOT, 'data/nightly-exclude.json');
  if (fs.existsSync(exPath)) {
    try {
      const exSet = new Set((JSON.parse(fs.readFileSync(exPath, 'utf8')).exclude || []).map((s) => String(s).toLowerCase()));
      const dropped = inScope.filter((r) => exSet.has(r.name.toLowerCase())).map((r) => r.name);
      inScope = inScope.filter((r) => !exSet.has(r.name.toLowerCase()));
      if (dropped.length) console.log(`[fresh-window] fenced out ${dropped.length}: ${dropped.join(', ')} (data/nightly-exclude.json)`);
    } catch (e) { console.error(`[fresh-window] nightly-exclude.json unreadable (${e.message}) — proceeding WITHOUT fence`); }
  }
  console.log(`[fresh-window] live scan of [${orgs.join(', ')}] → ${inScope.length} repos in scope after fence, pushed since ${new Date(cutoff).toISOString().slice(0, 10)} (${days}d window)`);
} else {
  for (const t of ['T0', 'T1', 'T2', 'T3']) {
    if (TIER && t !== TIER) continue;
    for (const r of tiers.tiers[t].repos) {
      if (ONLY && r.name !== ONLY) continue;
      if (t === 'T3' && !ONLY) continue;            // T3 is deep-walked on demand, not nightly
      inScope.push({ ...r, tier: t });
    }
  }
}

const plan = [];
// DERIVED, not asserted (F4, 2026-07-18): remoteHead() returns null on ANY probe failure, and the
// old planner labeled a null-probe repo "up-to-date" — so a network-dark nightly (GitHub unreachable,
// DNS down, token dead) produced an empty todo, exit 0, and the wrapper logged "CLEAN NO-OP" while
// having measured NOTHING. That is the exact "blind tool reports health" bug stack-sync.mjs kills
// with its registry guard. Now: an individually-failed probe is labeled 'unverified (probe failed)' —
// never "up-to-date", never triggering a rebuild — and if HALF OR MORE of the probes failed the run
// REFUSES to claim anything (exit 1), letting the wrapper's retry + escalation do their job.
let probeFailures = 0;
for (const r of inScope) {
  const live = remoteHead(r.owner || 'ruvnet', r.repo || r.name);
  if (live === null) probeFailures++;
  const built = builtSha[r.name.toLowerCase()] || null;
  let action = 'up-to-date';
  if (!built) action = 'build (new)';
  // 'unknown' stamped SHA cannot prove freshness — treat as changed whenever upstream is reachable.
  // (Real bug: ruflo + agentic-flow were stamped unknown and therefore NEVER auto-rebuilt — the two
  // most-central repos were invisible to the freshness loop until a 3.24 release exposed it.)
  else if (built === 'unknown') action = live ? 'rebuild (changed)' : 'unverified (probe failed)';
  else if (live === null) action = 'unverified (probe failed)';
  else if (live !== built) action = 'rebuild (changed)';
  plan.push({ name: r.name, owner: r.owner, repo: r.repo, tier: r.tier, built: built?.slice(0, 12) || '—', live: live?.slice(0, 12) || '?', action });
}
if (inScope.length > 0 && probeFailures * 2 >= inScope.length) {
  console.error(`\n[blind-guard] ${probeFailures}/${inScope.length} freshness probes FAILED — refusing to claim "up-to-date" for anything. This run measured nothing; that is a failure, not a no-op.`);
  process.exit(1);
}
if (typeof orgFailures !== 'undefined' && orgFailures > 0 && inScope.length === 0) {
  console.error(`\n[blind-guard] every org listing failed (${orgFailures}) and nothing is in scope — cannot distinguish "nothing fresh" from "completely blind". Failing loudly.`);
  process.exit(1);
}

console.log(`self-update ${APPLY ? '(APPLY)' : '(dry-run)'} — ${plan.length} repos in scope\n`);
for (const p of plan) console.log(`  ${p.action.padEnd(20)} ${p.tier} ${p.name.padEnd(24)} built:${p.built}  live:${p.live}`);
// SAFE NIGHTLY SCOPE: by default only REBUILD already-built repos whose upstream changed (keeps the
// shipped bundle current). Building brand-new repos is a supervised, multi-hour scaling effort, NOT an
// unattended nightly job — gate it behind --include-new so the cron can't silently try to deep-walk 40+
// repos (days of compute) on its first run.
// Fresh-window mode exists precisely to discover + build brand-new repos, so default INCLUDE_NEW on
// there (still bounded to the N-day set). Static-tier mode keeps the original opt-in gate untouched.
const INCLUDE_NEW = has('--include-new') || !!FRESH_WINDOW;
const changed = plan.filter((p) => p.action === 'rebuild (changed)');
const newRepos = plan.filter((p) => p.action === 'build (new)');
const todo = INCLUDE_NEW ? [...changed, ...newRepos] : changed;
console.log(`\nrebuild(changed): ${changed.map((p) => p.name).join(', ') || 'none'}`);
console.log(`new(not built): ${newRepos.length} repos${INCLUDE_NEW ? ' — INCLUDED (--include-new)' : ' — SKIPPED (supervised; pass --include-new to build)'}`);
console.log(`→ this run will (re)build ${todo.length}: ${todo.map((p) => p.name).join(', ') || 'none'}`);

if (!APPLY) {
  console.log('\n(dry-run — pass --apply to (re)build; runs serially since embedding is CPU-bound)');
  // Sol amendment to F4: even a dry-run may not report clean (exit 0) when probes failed — the
  // "CLEAN NO-OP" the wrapper logs on exit 0 must mean "measured everything, nothing due".
  if (probeFailures > 0) { console.error(`[blind-guard] ${probeFailures} probe(s) failed — dry-run cannot certify freshness; exiting 1`); process.exit(1); }
  process.exit(0);
}

const NOTIFY = (t, m, p) => { try { execFileSync('sh', [path.join(ROOT, 'scripts/notify.sh'), t, m, p || 'default']); } catch { /* alerting never breaks the pipeline */ } };
const failures = []; // per-repo build failures collected here; ANY failure aborts before publish (see below)
for (const p of todo) {
  const dir = clonePath(p.name);
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) {
      console.log(`[clone] ${p.name}`);
      fs.mkdirSync(CLONE_DIR, { recursive: true });
      execFileSync('git', ['clone', '--depth', '1', `https://github.com/${p.owner || 'ruvnet'}/${p.repo || p.name}`, dir], { stdio: 'inherit' });
    } else {
      execFileSync('git', ['-C', dir, 'fetch', '--depth', '1', 'origin'], { stdio: 'inherit' });
      execFileSync('git', ['-C', dir, 'reset', '--hard', 'origin/HEAD'], { stdio: 'inherit' });
    }
    const env = { ...process.env, KB_MODEL_CACHE: MODEL_CACHE };
    const kb = p.name.toLowerCase();                 // artifacts are lowercase (ruvector.rvf), registry name is RuVector
    const full = FULL_HINTS[kb];
    const keep = KEEP_DIRS[kb];
    const buildArgs = ['forge-build.mjs', '--repo', dir, '--out', '.', '--name', kb,
      '--canonical-url', process.env.RUVNET_CANONICAL_URL || 'https://raw.githubusercontent.com/stuinfla/ruvnet-brain/main/kb'];
    if (full) buildArgs.push('--full', full);
    if (keep) buildArgs.push('--keep', keep);
    console.log(`[build] ${kb}`);
    execFileSync(NODE, buildArgs, { cwd: path.join(ROOT, 'kb'), env, stdio: 'inherit' });
    console.log(`[sharp] ${kb}`);
    execFileSync(NODE, ['forge-big.mjs', 'both', '--dir', '.', '--name', kb], { cwd: path.join(ROOT, 'kb'), env, stdio: 'inherit' });
    console.log(`[symbols] ${kb}`);
    execFileSync(NODE, ['scripts/build-symbols.mjs', '--name', kb], { cwd: ROOT, env, stdio: 'inherit' });
    // Corpus QA gate (scripts/corpus-qa.mjs): structural (passages>0, full-bodies>0 where
    // FULL_HINTS demands them, vectors==passages, embed.json present) + deterministic
    // self-retrieval round trip on both variants. Non-zero exit throws -> failures[] ->
    // the run aborts before stamp/bundle/publish. This is the machine version of the
    // 2026-07-10 hand-verification: a store that embeds wrong or reads wrong cannot ship.
    console.log(`[qa] ${kb}`);
    execFileSync(NODE, ['scripts/corpus-qa.mjs', '--store', kb], { cwd: ROOT, env, stdio: 'inherit' });
  } catch (e) { console.error(`[FAIL] ${p.name}: ${e.message}`); failures.push({ name: p.name, error: e.message }); }
}

// A per-repo build failure used to be logged and swallowed — the run then re-stamped, re-bundled and (with
// --publish) cut a Release + git push based on todo.length alone, shipping a half-rebuilt brain (stale or
// missing stores) under a fresh version. Fail loud instead: if ANY repo failed, abort BEFORE stamp/bundle
// and the publish block (gh release create / git push) with a non-zero exit, so the nightly log surfaces it
// and nothing partial is released.
if (failures.length) {
  NOTIFY('🔴 Nightly brain publish ABORTED', `${failures.length} repo build(s) failed — nothing released. See logs/nightly.log`, 'urgent');
  console.error(`\n[FATAL] ${failures.length} repo build(s) failed this run — aborting before stamp/bundle/publish. NOTHING released (no re-stamp, no Release, no version bump, no push):`);
  for (const f of failures) console.error(`  - ${f.name}: ${f.error}`);
  console.error('Fix the failing repo(s) and re-run.');
  process.exit(1);
}

console.log('\n[stamp] re-stamping bundle');
execFileSync(NODE, ['scripts/brain-stamp.mjs'], { cwd: ROOT, stdio: 'inherit' });
// refresh the shipped bundle so the rebuilt deep-source ships (concepts/primers/L2 are supervised — not regenerated here)
console.log('[bundle] re-assembling dist/ruvnet-brain');
execFileSync(NODE, ['scripts/build-bundle.mjs'], { cwd: ROOT, env: { ...process.env, KB_MODEL_CACHE: MODEL_CACHE }, stdio: 'inherit' });
console.log('self-update done. (Deep-source refreshed + bundle re-assembled. Primer/L2/concepts + grading are supervised steps — re-run them when a repo materially changes.)');

// ── PUBLISH (the last mile): local rebuild → users, automatically. ─────────────────────────────
// Without this, the nightly makes the LOCAL brain smarter while releases/latest never advances —
// users' auto-updaters correctly report "up to date" against a stale Release forever. Gated on
// --publish (the LaunchAgent passes it; ad-hoc manual runs don't publish by accident) and on
// something having actually been rebuilt this run. ONE product version: plugin.json's version is
// bumped (patch) and shipped in the same Release tag, so brain content and plugin always move
// under a single user-visible number. Fail-loud: any error here exits non-zero into the nightly
// log; nothing is half-published silently (release create is atomic per-tag; the version-bump
// commit only pushes after the Release exists).
if (has('--publish')) {
  // Packaging gap (issue #29, found by Jan Lafko): the bundle carries EXECUTABLE reader scripts
  // (kb/*.mjs) — so a reader fix could exist in git while releases/latest kept shipping the stale
  // copy FOREVER whenever no corpus rebuild happened to come along (he caught the #27 fix present
  // in source but absent from his installed plugin). A Release is now ALSO cut when any shipped
  // script drifted vs the last release tag, even with zero corpus changes.
  let scriptDrift = [];
  try {
    const lastTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const out = execFileSync('git', ['diff', '--name-only', `${lastTag}..HEAD`, '--', 'kb/*.mjs', 'kb/package.json', 'bin/install.mjs'], { cwd: ROOT, encoding: 'utf8' }).trim();
    scriptDrift = out ? out.split('\n') : [];
  } catch { scriptDrift = ['(no release tag baseline — treating shipped scripts as drifted)']; }
  if (todo.length === 0 && scriptDrift.length === 0) {
    console.log('[publish] nothing was rebuilt and no shipped script changed since the last Release — no new Release needed. Done.');
  } else {
    if (todo.length === 0) console.log(`[publish] no corpus rebuild, but ${scriptDrift.length} shipped script(s) drifted since the last Release (issue #29 class) — cutting a Release so reader fixes actually reach users:\n${scriptDrift.map((f) => '    · ' + f).join('\n')}`);
    const PLUGIN_JSON = path.join(ROOT, 'plugin', '.claude-plugin', 'plugin.json');
    const pj = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8'));
    const m = pj.version.match(/^(\d+)\.(\d+)\.(\d+)(-dev)?$/);
    if (!m) { console.error(`[publish] FAIL: cannot parse plugin version "${pj.version}"`); process.exit(1); }
    const next = `${m[1]}.${m[2]}.${Number(m[3]) + 1}${m[4] || ''}`;
    const tag = `v${next}`;
    pj.version = next;
    pj.updated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(PLUGIN_JSON, JSON.stringify(pj, null, 2) + '\n');
    console.log(`[publish] product version → ${next} (${tag})`);

    // Keep the README's bright-blue version badge in lockstep (Stuart's rule: version + updated
    // timestamp with timezone, bright blue, first thing anyone sees). GitHub strips color from
    // markdown text, so the line is a shields.io for-the-badge image — colors guaranteed.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short',
    }).formatToParts(new Date());
    const g = (t) => fmt.find((p) => p.type === t)?.value || '';
    const human = `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')} ${g('timeZoneName')}`;
    const badgeStamp = human.replace(/-/g, '--').replace(/ /g, '_');
    const badgeVer = next.replace(/-/g, '--');
    const badge = `https://img.shields.io/badge/version_${badgeVer}-updated_${badgeStamp}-1E90FF?style=for-the-badge&labelColor=0757BA`;
    const README = path.join(ROOT, 'README.md');
    const readme = fs.readFileSync(README, 'utf8').replace(
      /^### 🧠 RuvNet Brain — \[!\[.*$/m,
      `### 🧠 RuvNet Brain — [![RuvNet Brain version ${next} — updated ${human}](${badge})](https://github.com/stuinfla/ruvnet-brain/blob/main/plugin/.claude-plugin/plugin.json)`,
    );
    fs.writeFileSync(README, readme);

    const zipPath = path.join(ROOT, 'dist', 'ruvnet-brain.zip');
    console.log('[publish] zipping bundle (private stores already fenced out at assembly)');
    try { fs.unlinkSync(zipPath); } catch {}
    execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', path.join(ROOT, 'dist', 'ruvnet-brain'), zipPath], { stdio: 'inherit' });

    // Sign the bundle (SEC-0010 #6) so the installer can verify-before-extract. Transitional: if no
    // signing key is available in this env yet (RUVNET_SIGNING_KEY / .secrets/…key.pem), warn and ship
    // unsigned rather than break the nightly — once the key is wired in, every release ships signed and
    // install.mjs's SIGNING_REQUIRED can flip to true. sign-bundle emits <zip>.sig + <zip>.sha256.
    const sigAssets = [];
    try {
      execFileSync(NODE, ['scripts/sign-bundle.mjs', '--bundle', zipPath], { cwd: ROOT, stdio: 'inherit' });
      for (const a of [`${zipPath}.sig`, `${zipPath}.sha256`]) if (fs.existsSync(a)) sigAssets.push(a);
      console.log(`[publish] signed bundle (${sigAssets.length} signature asset(s) will be uploaded)`);
    } catch (e) {
      console.warn(`[publish] WARNING: bundle NOT signed (${e.message.split('\n')[0]}). Shipping unsigned (transitional). Set RUVNET_SIGNING_KEY in the nightly env to enable signing.`);
    }

    console.log(`[publish] creating GitHub Release ${tag} + uploading bundle (~this can take minutes)`);
    execFileSync(GH, ['release', 'create', tag, zipPath, ...sigAssets,
      '--title', `${tag} — nightly brain refresh`,
      '--notes', `Automated nightly: ${todo.length ? `re-ingested upstream changes in: ${todo.map((p) => p.name).join(', ')}` : `shipped reader-script fixes (no corpus change — issue #29 class)`}. One product version — plugin ${next} + this knowledge bundle ship together; user installs pick both up automatically.`,
    ], { cwd: ROOT, stdio: 'inherit' });

    console.log('[publish] syncing version to EVERY surface, committing, pushing');
    // Propagate `next` to package.json / kb/package.json / manifest / primer / explainer — NOT just the
    // four files this block used to add. Otherwise those surfaces drift behind plugin.json (the exact
    // 2026-07-19 3.4.19-vs-3.4.20 split that reddened repo-count + version gates).
    execFileSync(NODE, ['scripts/sync-version.mjs'], { cwd: ROOT, stdio: 'inherit' });
    execFileSync('git', ['add', 'README.md', 'plugin/.claude-plugin/plugin.json', 'package.json', 'kb/package.json',
      'data/manifest.json', 'primer/ruvnet-primer.md', 'explainer/index.html'], { cwd: ROOT, stdio: 'inherit' });
    execFileSync('git', ['commit', '-m', `Nightly brain refresh ${tag}: ${todo.map((p) => p.name).join(', ')}\n\nAutomated by scripts/self-update.mjs --publish (launchd com.ruvnet.brain-nightly).`], { cwd: ROOT, stdio: 'inherit' });
    execFileSync('git', ['push', 'origin', 'main'], { cwd: ROOT, stdio: 'inherit' });
    // npm publish — ATOMIC with the GitHub Release so npm `latest` can NEVER lag behind it. This block
    // previously shipped GitHub + plugin but never touched npm, so every nightly left npm further behind
    // (the 2026-07-19 npm 3.4.18 / GitHub 3.4.20 drift). Fail LOUD if npm cannot be published — GitHub
    // being ahead of npm must abort the run visibly, never pass silently. One product version, every channel.
    try {
      let onNpm = '';
      try { onNpm = execFileSync('npm', ['view', `ruvnet-brain@${next}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* not yet on npm — fine */ }
      if (onNpm !== next) execFileSync('npm', ['publish'], { cwd: ROOT, stdio: 'inherit' });
      execFileSync('npm', ['dist-tag', 'add', `ruvnet-brain@${next}`, 'latest'], { cwd: ROOT, stdio: 'inherit' });
      console.log(`[publish] npm ${next} + \`latest\` — channels IN SYNC (npm == GitHub == plugin)`);
    } catch (e) {
      console.error(`[publish] FATAL: npm publish/dist-tag FAILED (${e.message.split('\n')[0]}). GitHub is now AHEAD of npm — the exact drift this guards against. The nightly aborts here; republish npm manually (\`npm publish && npm dist-tag add ruvnet-brain@${next} latest\`) and check npm auth in the launchd env.`);
      process.exit(1);
    }
    NOTIFY('🟢 Nightly brain published', `${tag} is live on releases/latest + npm — ${todo.length ? `rebuilt: ${todo.map((p) => p.name).join(', ')}` : `reader-script fixes only`}`);
    console.log(`[publish] DONE — ${tag} live. Users' heartbeats will pick up plugin + brain automatically.`);
  }
}

// Sol amendment to F4 (end of run): the verified rebuilds/publish above are real work and were NOT
// skipped — but if any freshness probe failed, this run still may not report clean. Exit 1 AFTER the
// work so the wrapper's retry re-probes (rebuilds are change-gated, so the retry is cheap) and a
// persistent blind spot escalates instead of hiding inside a green "no-op".
if (typeof probeFailures !== 'undefined' && probeFailures > 0) {
  console.error(`\n[blind-guard] run completed its verified work, but ${probeFailures} freshness probe(s) FAILED — those repos are 'unverified', not 'up-to-date'. Exiting 1 so the failure is visible.`);
  process.exit(1);
}
