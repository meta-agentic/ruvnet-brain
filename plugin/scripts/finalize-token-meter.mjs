#!/usr/bin/env node
// Replay one hook's captured stdout and append its exact byte count to the user-level ledger.
// Kept in one process because spawning cat + wc + rm + date + pwd + sed on every SessionStart
// consumed most of the 1s Windows UX budget.
import fs from 'node:fs';
import path from 'node:path';

const [capturePath, ledgerDir, cwd] = process.argv.slice(2);

try {
  const output = fs.readFileSync(capturePath);
  process.stdout.write(output);
  fs.mkdirSync(ledgerDir, { recursive: true });
  fs.appendFileSync(path.join(ledgerDir, 'token-ledger.jsonl'), `${JSON.stringify({
    ts: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    source: 'hook',
    class: 'session-start',
    bytes: output.length,
    cwd,
  })}\n`);
} catch {
  // Metering is observability, never a reason to break a session.
} finally {
  try { fs.rmSync(capturePath, { force: true }); } catch {}
}
