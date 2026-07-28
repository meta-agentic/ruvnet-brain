#!/usr/bin/env node
// ours-ok.mjs — the healthy hook WE ship, standing in for a real ruvnet-brain registration in
// tests/mesh/coexistence.test.mjs (ADR-058 D5). Drains stdin asynchronously (a synchronous read
// would reproduce the held-open hang class scripts/selfcheck.mjs already guards against — not what
// this fixture is for) and exits 0 on a bounded schedule, after appending one line to its counter
// file. The "single-blocker" mutant test copies this file to a TEMP path and changes exit(0) to
// exit(2) there — this committed copy is never edited in place.
import fs from 'node:fs';

const [, , counterPath] = process.argv;
let seen = 0;
process.stdin.on('data', (d) => { seen += d.length; });
process.stdin.on('error', () => {});
process.stdin.resume();
setTimeout(() => {
  process.stdout.write(`ours-ok ${seen}\n`);
  if (counterPath) fs.appendFileSync(counterPath, 'x\n');
  process.exit(0);
}, 20);
