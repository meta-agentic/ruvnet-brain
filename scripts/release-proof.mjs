#!/usr/bin/env node
export * from '../plugin/skills/release-proof/scripts/release-proof.mjs';
import { main } from '../plugin/skills/release-proof/scripts/release-proof.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
