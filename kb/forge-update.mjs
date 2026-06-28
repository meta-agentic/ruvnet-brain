#!/usr/bin/env node
// forge-update.mjs — GENERALIZED EVERGREEN self-updater for any rvf-kb-forge bundle.
//
// Ships INSIDE the bundle next to SOURCE.json (written by forge-build.mjs with --canonical-url).
// A consumer who copied the bundle runs it in that dir. It reads the embedded provenance
// (SOURCE.json — "where I came from"), fetches the LIVE canonical build manifest, and reports
// whether their copy is current; --apply downloads + extracts + re-verifies with forge-guard.mjs.
//
//   node forge-update.mjs            (== --check)  report only: UP TO DATE / BEHIND
//   node forge-update.mjs --check    same as above
//   node forge-update.mjs --apply    download canonical bundle, back up, extract over local,
//                                    re-verify with forge-guard.mjs, print DONE
//   node forge-update.mjs <name>     limit to one store when SOURCE.json carries several
//
// Cron example (Mon 09:00, log result):
//   0 9 * * 1  cd /path/to/kb && /usr/bin/node forge-update.mjs --check >> forge-update.log 2>&1
//
// Zero dependencies. Node 18+ (global fetch). Network failures fail LOUD and CLEAN: clear
// message, non-zero exit, NO partial clobber. If --canonical-url was not set at build time the
// URLs are null and this prints a clear "self-update not configured for this build" message.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(KB_DIR, 'SOURCE.json');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const ONLY = argv.find((a) => !a.startsWith('--'));

function die(msg, code = 1) { console.error(`\n[forge-update] ERROR: ${msg}`); process.exit(code); }

if (!fs.existsSync(SOURCE_PATH)) {
  die(`no SOURCE.json next to this script (${SOURCE_PATH}). This bundle predates the evergreen ` +
      `mechanism or SOURCE.json was removed. Re-download a current bundle to gain self-update.`);
}
let source;
try { source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8')); }
catch (e) { die(`SOURCE.json is unreadable/corrupt: ${e.message}`); }

const stores = Array.isArray(source.stores)
  ? source.stores
  : (source.stores && typeof source.stores === 'object')
    ? Object.entries(source.stores).map(([kbName, v]) => ({ kbName, ...v }))
    : [source];

const manifestUrl = source.canonicalManifestUrl || stores.find((s) => s.canonicalManifestUrl)?.canonicalManifestUrl;
if (!manifestUrl) {
  die(`self-update not configured for this build — SOURCE.json has no canonicalManifestUrl ` +
      `(forge-build.mjs was run without --canonical-url). Provenance is still in SOURCE.json.`);
}

async function fetchJson(url) {
  let res;
  try { res = await fetch(url, { redirect: 'follow' }); }
  catch (e) { die(`network failure fetching ${url}\n  ${e.message} — nothing changed locally.`, 2); }
  if (!res.ok) die(`canonical manifest returned HTTP ${res.status} for ${url} — nothing changed.`, 2);
  try { return await res.json(); } catch (e) { die(`canonical manifest was not valid JSON: ${e.message}`, 2); }
}
async function fetchBuffer(url) {
  let res;
  try { res = await fetch(url, { redirect: 'follow' }); }
  catch (e) { die(`network failure downloading ${url}\n  ${e.message} — nothing changed locally.`, 2); }
  if (!res.ok) die(`bundle download returned HTTP ${res.status} for ${url} — nothing changed.`, 2);
  return Buffer.from(await res.arrayBuffer());
}

// Canonical manifest may be a forge .last-built.json ({ generated, stores:{name:{sha,describe}} })
// OR a SOURCE.json-shaped file ({ builtUtc, stores:{name:{builtUtc,sourceCommit,...}} }). Handle both.
function canonicalFor(canon, kbName) {
  const cs = (canon.stores && canon.stores[kbName]) || {};
  return {
    builtUtc: cs.builtUtc || canon.generated || canon.builtUtc || null,
    sourceCommit: cs.sha || cs.sourceCommit || null,
    sourceDescribe: cs.describe || cs.sourceDescribe || null,
  };
}
function isBehind(local, canon) {
  const lt = local.builtUtc ? Date.parse(local.builtUtc) : NaN;
  const ct = canon.builtUtc ? Date.parse(canon.builtUtc) : NaN;
  if (!Number.isNaN(lt) && !Number.isNaN(ct) && ct > lt) return true;
  if (local.sourceCommit && canon.sourceCommit && local.sourceCommit !== canon.sourceCommit) return true;
  return false;
}
function short(s) { return s ? String(s).slice(0, 12) : '(none)'; }
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function copyTree(srcDir, dstDir) {
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, ent.name), d = path.join(dstDir, ent.name);
    if (ent.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); }
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); }
  }
}

async function main() {
  const canon = await fetchJson(manifestUrl);
  const targets = ONLY ? stores.filter((s) => s.kbName === ONLY) : stores;
  if (ONLY && targets.length === 0) die(`SOURCE.json has no store named "${ONLY}". Known: ${stores.map((s) => s.kbName).join(', ')}`);

  console.log(`\n=== rvf-kb-forge evergreen check ===`);
  console.log(`canonical manifest: ${manifestUrl}`);
  console.log(`canonical built:    ${canon.generated || canon.builtUtc || '(unknown)'}\n`);

  let anyBehind = false; const behindStores = [];
  for (const local of targets) {
    const c = canonicalFor(canon, local.kbName);
    const behind = isBehind(local, c);
    anyBehind = anyBehind || behind;
    if (behind) {
      behindStores.push({ local });
      console.log(`[${local.kbName}] BEHIND`);
      console.log(`    canonical: built ${c.builtUtc} from ${short(c.sourceCommit)}${c.sourceDescribe ? ` (${c.sourceDescribe})` : ''}`);
      console.log(`    yours:     built ${local.builtUtc} from ${short(local.sourceCommit)}${local.sourceDescribe ? ` (${local.sourceDescribe})` : ''}`);
    } else {
      console.log(`[${local.kbName}] UP TO DATE (built ${local.builtUtc || '?'} from ${short(local.sourceCommit)})`);
    }
  }

  if (!APPLY) {
    if (anyBehind) { console.log(`\nA newer build exists. Run:  node forge-update.mjs --apply`); process.exit(10); }
    console.log(`\nAll stores current. Nothing to do.`); process.exit(0);
  }

  if (!anyBehind) { console.log(`\nNothing to apply — already current.`); process.exit(0); }

  for (const { local } of behindStores) {
    const bundleUrl = local.canonicalBundleUrl || source.canonicalBundleUrl;
    if (!bundleUrl) die(`[${local.kbName}] no canonicalBundleUrl in SOURCE.json — cannot self-update this store.`);
    console.log(`\n[${local.kbName}] downloading ${bundleUrl} ...`);
    const buf = await fetchBuffer(bundleUrl);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `forge-update-${local.kbName}-`));
    const zipPath = path.join(tmp, 'bundle.zip'), extractDir = path.join(tmp, 'extracted');
    fs.writeFileSync(zipPath, buf); fs.mkdirSync(extractDir, { recursive: true });
    console.log(`  downloaded ${(buf.length / 1e6).toFixed(1)} MB; extracting...`);
    try { execFileSync('unzip', ['-q', '-o', zipPath, '-d', extractDir], { stdio: 'inherit' }); }
    catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); die(`[${local.kbName}] unzip failed: ${e.message} — local files untouched.`); }
    const backup = path.join(path.dirname(KB_DIR), `${path.basename(KB_DIR)}.bak-${stamp()}`);
    console.log(`  backing up current copy -> ${backup}`);
    fs.cpSync(KB_DIR, backup, { recursive: true });
    copyTree(extractDir, KB_DIR);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`  files replaced.`);
  }

  // Re-verify only the updated store(s) with the bundled guard. forge-guard.mjs takes the KB
  // name + dir; pass them so a single-store copy doesn't fail on absent sibling stores.
  const guard = path.join(KB_DIR, 'forge-guard.mjs');
  if (fs.existsSync(guard)) {
    for (const { local } of behindStores) {
      console.log(`\nre-verifying [${local.kbName}] with forge-guard.mjs ...`);
      try { execFileSync(process.execPath, [guard, '--dir', KB_DIR, '--name', local.kbName], { cwd: KB_DIR, stdio: 'inherit' }); }
      catch { die(`forge-guard FAILED for [${local.kbName}] after update. Previous copy backed up beside the KB dir (*.bak-*). Restore it if needed.`); }
    }
  } else {
    console.log(`\n(no forge-guard.mjs found to re-verify — skipped)`);
  }

  console.log(`\n=== DONE — KB updated to the canonical build (${canon.generated || canon.builtUtc}). ===`);
  process.exit(0);
}

main().catch((e) => die(`unexpected: ${e.message}`));
