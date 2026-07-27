#!/usr/bin/env node
// HANG ON HELD-OPEN STDIN — the canonical defect, and the one an in-process timer cannot catch.
// readFileSync(0) is a SYNCHRONOUS read to EOF: the event loop is frozen for its whole duration, so
// a setTimeout registered here would never fire. Only a watchdog in another process sees this.
import fs from 'node:fs';
setTimeout(() => { process.exit(0); }, 50); // deliberately armed, and deliberately useless
try { fs.readFileSync(0); } catch { /* ignore */ }
process.exit(0);
