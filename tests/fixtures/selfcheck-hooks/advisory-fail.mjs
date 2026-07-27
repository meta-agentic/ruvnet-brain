#!/usr/bin/env node
// ADVISORY EXITING 1 — registered as mode:'advisory', whose contract allows exit 0 and nothing else.
// A non-zero code from an advisory registration reaches Claude Code and can disturb the turn.
process.stdout.write('advisory hook failing\n');
process.exit(1);
