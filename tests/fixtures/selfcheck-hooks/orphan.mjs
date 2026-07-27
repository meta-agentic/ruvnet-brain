#!/usr/bin/env node
// ORPHAN CHILD — the leak an exit code cannot show. This hook exits 0 immediately (looks perfect)
// while leaving a spawned descendant running in its process group for a minute.
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' });
child.unref();
process.stdout.write('spawned and leaving\n');
process.exit(0);
