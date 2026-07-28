#!/usr/bin/env node
// scripts/ci/build-fixture-kb.mjs — the fixture-staging logic shared by:
//   • tests/mutation/install-selfcheck-consumption-mutation.test.mjs (M-D8b, local)
//   • .github/workflows/stranger-matrix.yml (ADR-058 §D8, the stranger's-machine matrix)
//
// Stages a MINIMAL but REAL KB-bundle directory: the real forge-mcp-all.mjs (copied from kb/ at the
// candidate SHA — so `--drop-mcp` deleting it for the seeded-broken scenario is a real, meaningful
// mutation, not a synthetic one), a fake `.rvf` marker (gatherInstallState() only checks EXISTENCE,
// never content), and `file:`-referenced reader-dep stubs for @xenova/transformers and @ruvector/rvf
// (installReader() runs a REAL `npm i` inside the unpacked bundle — verified empirically that it
// PRUNES any node_modules entry not declared as a dependency, even against an otherwise-empty
// package.json, so a manually-placed stub does not survive; `file:` deps make npm install them for
// real, from local paths, with zero network and zero real package weight).
//
// Deliberately NEVER ships forge-ask-all.mjs: its absence is what keeps bin/install.mjs's
// smokeQuery() from trying to warm a real local embedding model, keeping every matrix cell fast,
// offline, and hermetic — the same convention tests/integration/install-smoke.mjs's own "COMPLETE
// brain dir" fixture and the M-D8b mutation test both already rely on.
//
// This script only STAGES a directory — it deliberately does not zip it (zip/unzip tooling differs
// per OS: `zip -r` on POSIX, PowerShell's `Compress-Archive` on Windows — that one step stays in the
// workflow YAML, native per runner).
//
//   node scripts/ci/build-fixture-kb.mjs --out <dir> [--drop-mcp] [--no-rvf]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (flag, def = null) => { const i = argv.indexOf(flag); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const OUT = arg('--out');
const DROP_MCP = argv.includes('--drop-mcp'); // M-D8a: the seeded-broken scenario
const NO_RVF = argv.includes('--no-rvf');

if (!OUT) {
  console.error('usage: node scripts/ci/build-fixture-kb.mjs --out <dir> [--drop-mcp] [--no-rvf]');
  process.exit(2);
}

fs.mkdirSync(OUT, { recursive: true });

if (!DROP_MCP) {
  fs.copyFileSync(path.join(REPO_ROOT, 'kb', 'forge-mcp-all.mjs'), path.join(OUT, 'forge-mcp-all.mjs'));
}

const xenStub = path.join(OUT, 'vendor', 'xenova-transformers-stub');
fs.mkdirSync(xenStub, { recursive: true });
fs.writeFileSync(path.join(xenStub, 'package.json'), '{"name":"@xenova/transformers","version":"0.0.0-fixture"}\n');
const ruvectorStub = path.join(OUT, 'vendor', 'ruvector-rvf-stub');
fs.mkdirSync(ruvectorStub, { recursive: true });
fs.writeFileSync(path.join(ruvectorStub, 'package.json'), '{"name":"@ruvector/rvf","version":"0.0.0-fixture"}\n');
fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify({
  name: 'ruvnet-brain-kb-fixture',
  version: '0.0.0',
  private: true,
  dependencies: {
    '@xenova/transformers': 'file:vendor/xenova-transformers-stub',
    '@ruvector/rvf': 'file:vendor/ruvector-rvf-stub',
  },
}, null, 2));

if (!NO_RVF) {
  fs.writeFileSync(path.join(OUT, 'fixture.rvf'), 'not a real store — presence is what gatherInstallState() counts\n');
}

console.log(`[build-fixture-kb] staged ${OUT} (mcp: ${!DROP_MCP}, rvf: ${!NO_RVF})`);
