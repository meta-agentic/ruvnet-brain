#!/usr/bin/env node
// build-symbols.mjs — ADR-0003 point-deeper symbol index.
// Scans <name>.passages.jsonl and extracts a deterministic map from code symbols / file stems /
// package names → the SOURCE paths that define them, so retrieval can hard-route an implementation
// question to the real file instead of losing to a prose doc. Language-agnostic-ish (TS/JS/Rust/Py).
//
//   node scripts/build-symbols.mjs --name ruflo   → writes kb/<name>.symbols.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const NAME = arg('--name', 'ruflo');
const KB = path.join(ROOT, 'kb');
const PASSAGES = path.join(KB, `${NAME}.passages.jsonl`);

const isSourcePath = (p) => /\.(ts|tsx|js|jsx|mjs|cjs|rs|py|go)$/i.test(p)
  && !/\.(test|spec|d)\.[tj]sx?$/i.test(p)
  && !/(^|\/)(tests?|__tests__|testing|fixtures?|\.claude|examples?)\//i.test(p);

// symbol-definition patterns (capture the NAME)
const DEF_RES = [
  /\bexport\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /\bexport\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
  /\bexport\s+(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/g,
  /\bpub\s+(?:async\s+)?fn\s+([a-z_][\w]*)/g,           // rust
  /\bpub\s+(?:struct|enum|trait)\s+([A-Za-z_][\w]*)/g,  // rust
  /(?:^|\s)class\s+([A-Za-z_$][\w$]*)/g,
];
// MCP tool / handler names (snake_case strings registered as tools)
const TOOL_RES = [
  /\bname:\s*['"]([a-z][a-z0-9_]+)['"]/g,
  /(?:registerTool|tool|addTool|defineTool)\(\s*['"]([a-z][a-z0-9_]+)['"]/g,
  /['"]([a-z]+_[a-z0-9_]+)['"]\s*:/g,                   // 'swarm_init': handler
];

const bySymbol = Object.create(null);   // exact identifier (lowercased) → Set(paths); null-proto: no __proto__/constructor collision
const byStem = Object.create(null);     // file basename stem → Set(paths)
const byPackage = Object.create(null);  // @claude-flow/<pkg> or crates/<pkg> → Set(src paths)
const add = (map, key, p) => { if (!key) return; key = key.toLowerCase(); (map[key] ||= new Set()).add(p); };

let n = 0, srcN = 0;
for (const line of fs.readFileSync(PASSAGES, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  n++;
  const p = o.path || ''; if (!isSourcePath(p)) continue;
  srcN++;
  const text = o.text || '';
  for (const re of DEF_RES) { let m; re.lastIndex = 0; while ((m = re.exec(text))) { if (m[1] && m[1].length >= 3) add(bySymbol, m[1], p); } }
  for (const re of TOOL_RES) { let m; re.lastIndex = 0; while ((m = re.exec(text))) { if (m[1] && m[1].length >= 4) add(bySymbol, m[1], p); } }
  // stem
  const stem = (p.split('/').pop() || '').replace(/\.[^.]+$/, '');
  if (stem && stem !== 'index' && stem !== 'mod' && stem.length >= 3) add(byStem, stem, p);
  // package
  const pkg = p.match(/@[\w-]+\/([\w-]+)\//) || p.match(/(?:^|\/)crates\/([\w-]+)\//);
  if (pkg) add(byPackage, pkg[1], p);
}

const freeze = (map, cap = 8) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].slice(0, cap)]));
const out = { name: NAME, generated: 'STAMP', sourcePassages: srcN,
  bySymbol: freeze(bySymbol), byStem: freeze(byStem), byPackage: freeze(byPackage, 30) };
fs.writeFileSync(path.join(KB, `${NAME}.symbols.json`), JSON.stringify(out));
console.log(`symbols: ${Object.keys(out.bySymbol).length} | stems: ${Object.keys(out.byStem).length} | packages: ${Object.keys(out.byPackage).length} (from ${srcN}/${n} source passages)`);
console.log('sample symbols:', Object.keys(out.bySymbol).filter(s => /swarm_init|guidance_recommend|memorymanager|agentdb|sqlitebackend/.test(s)).slice(0, 10));
console.log('packages:', Object.keys(out.byPackage).slice(0, 20).join(', '));
