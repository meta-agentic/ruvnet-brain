// rvf-generation.mjs — bind each canonical RVF byte generation to the Brain product version.
//
// @ruvector/rvf's Node API does not currently expose a supported custom-manifest writer for an
// existing store. This checksum-bound companion is therefore the fail-closed identity record:
// changing even one RVF byte changes sha256, while brainVersion/releaseTag identify the npm and
// GitHub release that owns those exact bytes.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getVersion, getVersionTag } from './version.mjs';

export const RVF_GENERATIONS_FILE = 'RVF-GENERATIONS.json';

export function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

export function readRvfGenerations(dir) {
  const file = path.join(dir, RVF_GENERATIONS_FILE);
  if (!fs.existsSync(file)) {
    return { schemaVersion: 1, brainVersion: getVersion(), releaseTag: getVersionTag(), stores: {} };
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  parsed.stores ||= {};
  return parsed;
}

export function writeRvfGeneration({
  dir,
  store,
  rvfFile = `${store}.big.rvf`,
  model,
  dimensions,
  sourceCommit = null,
  builtUtc = new Date().toISOString(),
  previousDir = dir,
}) {
  const rvfPath = path.join(dir, rvfFile);
  if (!fs.existsSync(rvfPath)) throw new Error(`cannot stamp missing RVF: ${rvfPath}`);
  const manifest = readRvfGenerations(previousDir);
  manifest.schemaVersion = 1;
  manifest.brainVersion = getVersion();
  manifest.releaseTag = getVersionTag();
  manifest.stores[store] = {
    file: rvfFile,
    sha256: sha256File(rvfPath),
    bytes: fs.statSync(rvfPath).size,
    model,
    dimensions,
    sourceCommit,
    builtUtc,
  };
  fs.writeFileSync(path.join(dir, RVF_GENERATIONS_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest.stores[store];
}

export function verifyRvfGenerations(dir, {
  version = getVersion(),
  releaseTag = getVersionTag(),
  requiredStores = [],
} = {}) {
  const manifest = readRvfGenerations(dir);
  const failures = [];
  if (manifest.brainVersion !== version) failures.push(`brainVersion=${manifest.brainVersion}, expected ${version}`);
  if (manifest.releaseTag !== releaseTag) failures.push(`releaseTag=${manifest.releaseTag}, expected ${releaseTag}`);
  for (const store of requiredStores) {
    if (!manifest.stores[store]) failures.push(`${store}: no generation record`);
  }
  for (const [store, generation] of Object.entries(manifest.stores)) {
    const file = path.join(dir, generation.file || `${store}.big.rvf`);
    if (!fs.existsSync(file)) {
      failures.push(`${store}: missing ${path.basename(file)}`);
      continue;
    }
    const actual = sha256File(file);
    if (actual !== generation.sha256) failures.push(`${store}: sha256=${actual}, recorded ${generation.sha256}`);
  }
  return { manifest, failures };
}
