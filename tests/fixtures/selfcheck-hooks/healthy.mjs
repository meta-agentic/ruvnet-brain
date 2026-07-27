#!/usr/bin/env node
// HEALTHY: the shape a well-behaved hook has. Reads stdin ASYNCHRONOUSLY and exits on its own
// schedule, so a held-open pipe cannot wedge it. Writes well under the 4KB cap. Always exit 0.
let seen = 0;
process.stdin.on('data', (d) => { seen += d.length; });
process.stdin.on('error', () => {});
process.stdin.resume();
// The load-bearing line: an unconditional bounded exit. A hook that waits for EOF instead of
// waiting for a DEADLINE is the entire held-open hang class.
setTimeout(() => { process.stdout.write(`ok ${seen}\n`); process.exit(0); }, 30);
