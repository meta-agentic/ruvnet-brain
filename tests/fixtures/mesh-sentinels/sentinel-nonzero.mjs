#!/usr/bin/env node
// SENTINEL: NON-ZERO EXIT — a synthetic FOREIGN hook that runs its body (increments its counter,
// proving it actually fired) and then reports failure. It is not ours: scripts/selfcheck.mjs must
// never invent a verdict for it (ADR-058 D5 "enumerate but never charge" / ADR-055 §6) — its exit
// code is its own author's business, never a violation attributed to this package.
import fs from 'node:fs';

const [, , counterPath, codeRaw] = process.argv;
const code = Number(codeRaw) || 1;
let seen = 0;
process.stdin.on('data', (d) => { seen += d.length; });
process.stdin.on('error', () => {});
process.stdin.resume();
setTimeout(() => {
  if (counterPath) fs.appendFileSync(counterPath, 'x\n');
  process.exit(code);
}, 20);
