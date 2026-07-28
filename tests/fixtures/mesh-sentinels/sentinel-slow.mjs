#!/usr/bin/env node
// SENTINEL: SLOW — a synthetic FOREIGN (not-ours) hook registered in tests/mesh/coexistence.test.mjs
// to stand in for a third party's slow-but-legal hook. It takes a while, then finishes cleanly and
// exits 0. Our own machinery must enumerate it (scripts/hook-registry.mjs), never execute it in
// production (scripts/selfcheck.mjs's checkCoexistence), and — when the TEST itself fires it,
// standing in for what Claude Code's own dispatcher would do — it must run its body EXACTLY ONCE,
// however long it takes, regardless of where it sits relative to our own registrations.
import fs from 'node:fs';

const [, , counterPath, delayMsRaw] = process.argv;
const delayMs = Number(delayMsRaw) || 250;
let seen = 0;
process.stdin.on('data', (d) => { seen += d.length; });
process.stdin.on('error', () => {});
process.stdin.resume();
setTimeout(() => {
  if (counterPath) fs.appendFileSync(counterPath, 'x\n');
  process.exit(0);
}, delayMs);
