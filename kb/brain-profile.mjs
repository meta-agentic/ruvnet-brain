// brain-profile.mjs — enforce the user's installed knowledge profile by artifact family.
//
// Each repository is already one independent RVF + sidecar family. "RuVector only" therefore means
// keeping the shared reader plus the ruvector family, not rebuilding or copying a second brain.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PROFILE_COMPLETE = 'complete';
export const PROFILE_RUVECTOR = 'ruvector';
export const BRAIN_PROFILES = Object.freeze([PROFILE_COMPLETE, PROFILE_RUVECTOR]);

export function settingsPath(env = process.env) {
  return env.RUVNET_SETTINGS_FILE
    || path.join(os.homedir(), '.config', 'ruvnet-brain', 'settings.json');
}

export function readBrainProfile({ env = process.env } = {}) {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath(env), 'utf8'));
    const value = parsed?.settings?.brainProfile;
    return BRAIN_PROFILES.includes(value) ? value : PROFILE_COMPLETE;
  } catch {
    return PROFILE_COMPLETE;
  }
}

export function discoverStoreFamilies(dir) {
  const names = new Set();
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return []; }
  for (const entry of entries) {
    const match = entry.match(/^(.+?)(?:\.big)?\.rvf$/);
    if (match && !/\.(?:idmap|embed)\b/.test(entry)) names.add(match[1]);
  }
  return [...names].sort();
}

function familyEntries(dir, store) {
  return fs.readdirSync(dir).filter((entry) =>
    entry === `${store}-primer.md` || entry === store || entry.startsWith(`${store}.`));
}

function filterCapabilityCards(dir) {
  const file = path.join(dir, 'capability-cards.md');
  if (!fs.existsSync(file)) return;
  const backup = path.join(dir, 'capability-cards.complete.md');
  const current = fs.readFileSync(file, 'utf8');
  const cardCount = (current.match(/^## /gm) || []).length;
  if (!fs.existsSync(backup) || cardCount > 1) fs.copyFileSync(file, backup);
  const full = fs.readFileSync(backup, 'utf8');
  const firstCard = full.search(/^## /m);
  const start = full.search(/^## ruvector\s*$/m);
  if (firstCard < 0 || start < 0) throw new Error('could not isolate the RuVector capability card');
  const rest = full.slice(start);
  const next = rest.slice(1).search(/^## /m);
  const card = next < 0 ? rest : rest.slice(0, next + 1);
  fs.writeFileSync(file, `${full.slice(0, firstCard)}${card.trimEnd()}\n`);
}

function restoreCapabilityCards(dir) {
  const backup = path.join(dir, 'capability-cards.complete.md');
  if (fs.existsSync(backup)) fs.copyFileSync(backup, path.join(dir, 'capability-cards.md'));
}

function filterGenerationLedger(dir, allowed) {
  const file = path.join(dir, 'RVF-GENERATIONS.json');
  if (!fs.existsSync(file)) return;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  doc.stores = Object.fromEntries(Object.entries(doc.stores || {}).filter(([name]) => allowed.has(name)));
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
}

export function applyBrainProfile(dir, profile) {
  if (!BRAIN_PROFILES.includes(profile)) throw new Error(`unknown brain profile: ${profile}`);
  if (profile === PROFILE_COMPLETE) {
    restoreCapabilityCards(dir);
    return { profile, removed: [], bytesFreed: 0, stores: discoverStoreFamilies(dir) };
  }

  const allowed = new Set([PROFILE_RUVECTOR]);
  const removed = [];
  const removedStores = [];
  let bytesFreed = 0;
  for (const store of discoverStoreFamilies(dir)) {
    if (allowed.has(store)) continue;
    removedStores.push(store);
    for (const entry of familyEntries(dir, store)) {
      const target = path.join(dir, entry);
      try { bytesFreed += fs.statSync(target).size; } catch { /* report only measured bytes */ }
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(entry);
    }
  }
  filterCapabilityCards(dir);
  filterGenerationLedger(dir, allowed);
  return { profile, removed, removedStores, bytesFreed, stores: discoverStoreFamilies(dir) };
}

export function restoreCompleteProfile(targetDir, sourceDir) {
  if (!discoverStoreFamilies(sourceDir).includes(PROFILE_RUVECTOR)) {
    throw new Error(`complete bundle source is unavailable at ${sourceDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const stores = discoverStoreFamilies(sourceDir);
  for (const store of stores) {
    for (const entry of familyEntries(sourceDir, store)) {
      fs.cpSync(path.join(sourceDir, entry), path.join(targetDir, entry), {
        recursive: true,
        force: true,
      });
    }
  }
  for (const entry of ['capability-cards.md', 'RVF-GENERATIONS.json']) {
    const source = path.join(sourceDir, entry);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(targetDir, entry));
  }
  const cards = path.join(sourceDir, 'capability-cards.md');
  if (fs.existsSync(cards)) {
    fs.copyFileSync(cards, path.join(targetDir, 'capability-cards.complete.md'));
  }
  return { profile: PROFILE_COMPLETE, stores: discoverStoreFamilies(targetDir) };
}

export function measureBrainProfile(dir) {
  const stores = discoverStoreFamilies(dir);
  const byStore = {};
  let bytes = 0;
  for (const store of stores) {
    let storeBytes = 0;
    for (const entry of familyEntries(dir, store)) {
      const target = path.join(dir, entry);
      const walk = (p) => {
        const stat = fs.statSync(p);
        if (!stat.isDirectory()) { storeBytes += stat.size; return; }
        for (const child of fs.readdirSync(p)) walk(path.join(p, child));
      };
      try { walk(target); } catch { /* a changing file is omitted from the measurement */ }
    }
    byStore[store] = storeBytes;
    bytes += storeBytes;
  }
  return { stores, storeCount: stores.length, bytes, byStore };
}
