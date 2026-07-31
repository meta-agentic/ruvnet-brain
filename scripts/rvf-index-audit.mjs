#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRvf, closeReadonlyRvf } from '../kb/resolve-deps.mjs';
import { persistAndVerifyRvfIndex } from '../kb/rvf-index.mjs';
import {
  readRvfGenerations,
  sha256File,
  writeRvfGeneration,
} from './rvf-generation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RVF_HNSW_THRESHOLD = 1024;

function dimensionsFor(rvfPath) {
  const embedPath = `${rvfPath}.embed.json`;
  const config = JSON.parse(fs.readFileSync(embedPath, 'utf8'));
  const dimensions = Number(config.dimensions);
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new Error(`invalid dimensions in ${embedPath}`);
  }
  return dimensions;
}

export async function inspectRvfIndex(rvfPath, RvfDatabase) {
  const db = await RvfDatabase.openReadonly(rvfPath);
  try {
    const [status, segments] = await Promise.all([db.status(), db.segments()]);
    const hasIndex = segments.some(({ segType }) => segType === 'index');
    return {
      path: rvfPath,
      totalVectors: status.totalVectors,
      indexRequired: status.totalVectors >= RVF_HNSW_THRESHOLD,
      hasIndex,
      state: status.totalVectors >= RVF_HNSW_THRESHOLD && !hasIndex ? 'FAIL' : 'PASS',
    };
  } finally {
    await closeReadonlyRvf(db);
  }
}

export async function auditRvfIndexes(rvfPaths) {
  const { mod: { RvfDatabase } } = loadRvf();
  return Promise.all(rvfPaths.map((rvfPath) => inspectRvfIndex(rvfPath, RvfDatabase)));
}

export async function repairRvfIndex(rvfPath, RvfDatabase) {
  const before = await inspectRvfIndex(rvfPath, RvfDatabase);
  if (before.state === 'PASS') return { ...before, repaired: false, elapsedMs: 0 };

  const started = Date.now();
  const db = await RvfDatabase.open(rvfPath);
  const proof = await persistAndVerifyRvfIndex({
    db,
    dimensions: dimensionsFor(rvfPath),
    rvfPath,
    RvfDatabase,
  });
  return {
    ...before,
    hasIndex: proof.hasIndex,
    state: proof.hasIndex ? 'PASS' : 'FAIL',
    repaired: proof.hasIndex,
    elapsedMs: Date.now() - started,
  };
}

export function restampChangedRvfGenerations(kbDir, results) {
  const ledger = readRvfGenerations(kbDir);
  let stamped = 0;
  for (const result of results) {
    if (result.state !== 'PASS' || !result.path.endsWith('.big.rvf')) continue;
    const store = path.basename(result.path, '.big.rvf');
    const prior = ledger.stores?.[store];
    if (!prior || prior.sha256 === sha256File(result.path)) continue;
    const embed = JSON.parse(fs.readFileSync(`${result.path}.embed.json`, 'utf8'));
    writeRvfGeneration({
      dir: kbDir,
      store,
      rvfFile: path.basename(result.path),
      model: prior.model || embed.model || null,
      dimensions: prior.dimensions || Number(embed.dimensions),
      sourceCommit: prior.sourceCommit ?? null,
    });
    stamped++;
  }
  return stamped;
}

async function main() {
  const repair = process.argv.includes('--repair');
  const concurrencyArg = process.argv.indexOf('--concurrency');
  const concurrency = Math.max(1, Number(concurrencyArg >= 0 ? process.argv[concurrencyArg + 1] : 3));
  const namesAt = process.argv.indexOf('--names');
  const names = namesAt >= 0
    ? new Set(String(process.argv[namesAt + 1] || '').split(',').filter(Boolean))
    : null;
  const kbDirAt = process.argv.indexOf('--dir');
  const kbDir = path.resolve(ROOT, kbDirAt >= 0 ? process.argv[kbDirAt + 1] : 'kb');
  const rvfPaths = fs.readdirSync(kbDir)
    .filter((name) => name.endsWith('.rvf') && (!names || names.has(name.replace(/\.rvf$/, ''))))
    .sort()
    .map((name) => path.join(kbDir, name));
  const { mod: { RvfDatabase } } = loadRvf();
  const results = new Array(rvfPaths.length);
  let next = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, rvfPaths.length || 1) }, async () => {
    for (let index = next++; index < rvfPaths.length; index = next++) {
      const rvfPath = rvfPaths[index];
      try {
        results[index] = repair
          ? await repairRvfIndex(rvfPath, RvfDatabase)
          : await inspectRvfIndex(rvfPath, RvfDatabase);
      } catch (error) {
        results[index] = { path: rvfPath, state: 'FAIL', error: error.message };
      }
      const row = results[index];
      console.log(JSON.stringify({ ...row, path: path.relative(ROOT, row.path) }));
    }
  }));

  const failed = results.filter(({ state }) => state !== 'PASS');
  const repaired = results.filter(({ repaired }) => repaired).length;
  const stamped = repair && !failed.length
    ? restampChangedRvfGenerations(kbDir, results)
    : 0;
  console.log(`SUMMARY checked=${results.length} repaired=${repaired} stamped=${stamped} failed=${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
