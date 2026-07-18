#!/usr/bin/env node
// Thin repo-side wrapper: the REAL Stable Spine engine ships inside the plugin payload
// (plugin/scripts/update-apply.mjs) so every install path carries it. This wrapper exists for
// maintainers working in the repo and for the checkpoint/CI entry point.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugin', 'scripts', 'update-apply.mjs');
process.exit(spawnSync(process.execPath, [ENGINE, ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
