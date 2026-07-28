#!/usr/bin/env node
// Bind every existing canonical RVF to the current Brain release without re-embedding. Optional
// legacy pruning is fail-closed: the canonical passages/meta and big RVF sidecars must exist first.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRvfGeneration } from './rvf-generation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = path.join(ROOT, 'kb');
const PRUNE = process.argv.includes('--prune-legacy');
const stores = fs.readdirSync(KB)
  .filter((file) => file.endsWith('.big.rvf'))
  .map((file) => file.slice(0, -'.big.rvf'.length))
  .sort();

let pruned = 0;
for (const store of stores) {
  const embedFile = path.join(KB, `${store}.big.rvf.embed.json`);
  const idmapFile = path.join(KB, `${store}.big.rvf.idmap.json`);
  const passagesFile = path.join(KB, `${store}.passages.jsonl`);
  const metaFile = path.join(KB, `${store}.meta.json`);
  for (const required of [embedFile, idmapFile, passagesFile, metaFile]) {
    if (!fs.existsSync(required)) throw new Error(`${store}: missing ${path.basename(required)}; refusing to stamp/prune`);
  }
  const embed = JSON.parse(fs.readFileSync(embedFile, 'utf8'));
  const generation = writeRvfGeneration({
    dir: KB,
    store,
    model: embed.model,
    dimensions: embed.dimensions,
    sourceCommit: null,
  });
  console.log(`[generation] ${store}: ${generation.sha256.slice(0, 16)}… ${generation.bytes} bytes`);

  if (PRUNE) {
    for (const legacy of [
      `${store}.rvf`,
      `${store}.rvf.idmap.json`,
      `${store}.rvf.embed.json`,
      `${store}.big.passages.jsonl`,
      `${store}.big.meta.json`,
    ]) {
      const file = path.join(KB, legacy);
      if (fs.existsSync(file)) {
        fs.rmSync(file);
        pruned++;
      }
    }
  }
}
console.log(`[generation] stamped ${stores.length} canonical RVFs${PRUNE ? `; pruned ${pruned} legacy files` : ''}`);
