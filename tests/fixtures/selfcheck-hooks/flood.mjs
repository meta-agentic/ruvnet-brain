#!/usr/bin/env node
// STDOUT FLOOD — 16KB, four times the 4KB cap. Hook stdout lands in the user's context window, so
// this is a real per-prompt token cost, not a cosmetic nit.
process.stdout.write('X'.repeat(16 * 1024) + '\n');
process.exit(0);
