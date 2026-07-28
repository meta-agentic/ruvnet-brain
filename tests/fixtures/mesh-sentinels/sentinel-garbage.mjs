#!/usr/bin/env node
// SENTINEL: GARBAGE STDOUT — a synthetic FOREIGN hook that prints non-JSON noise instead of a
// well-formed response, then still exits 0. It is not ours: our own stdout-cap / stderr-trace
// contracts (scripts/selfcheck.mjs's assertContract) govern registrations THIS package ships —
// they must never be applied to someone else's hook (ADR-055 §6).
import fs from 'node:fs';

const [, , counterPath] = process.argv;
let seen = 0;
process.stdin.on('data', (d) => { seen += d.length; });
process.stdin.on('error', () => {});
process.stdin.resume();
setTimeout(() => {
  process.stdout.write(`\x00\x01GARBAGE-NOT-JSON${'ÿ'.repeat(8)}{{{ malformed \n`);
  if (counterPath) fs.appendFileSync(counterPath, 'x\n');
  process.exit(0);
}, 20);
