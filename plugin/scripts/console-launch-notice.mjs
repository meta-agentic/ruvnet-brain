#!/usr/bin/env node
// console-launch-notice.mjs — INSTANT, user-visible feedback the moment a console command is typed.
//
// THE PROBLEM (owner, raised 3×, 2026-07-25): typing /rvbc gave ~10s of dead air. The gap is the model's
// time-to-first-token (you hit enter, then wait for the assistant's "let me take a look…" to render),
// PLUS the console launcher's own fast "scanning" line being invisible because the model runs it in the
// background. The user stares at a blank screen and reasonably concludes it froze. Fixing the console's
// speed (the UX QE suite did) never touched this, because this dead air is BEFORE the model even speaks.
//
// THE FIX, grounded in the live hooks.md (fetched + verified 2026-07-25, not recalled): UserPromptSubmit
// runs SYNCHRONOUSLY and BLOCKS model processing until it exits, and a `systemMessage` in its JSON output
// is the documented channel for a line the human SEES in the terminal — rendered BEFORE the model starts,
// so it is independent of model latency. Since v2.1.139 a hook has no controlling terminal, so writing raw
// ANSI/stdout-to-tty will NOT reach the screen; structured JSON is the only reliable path, and stdout must
// contain ONLY the JSON object (the docs' one-approach-per-hook rule). The `prompt` field is the RAW typed
// string (e.g. "/ruvnet-brain:rvbc"), NOT the expanded command file — so we match the invocation prefix.
//
// SPEED IS THE CONTRACT: this hook blocks the whole turn until it exits, so it does ZERO work beyond
// reading stdin and one regex — no imports past node:fs, no network, no database, no subprocess. A slow
// hook here would BE the dead air it exists to remove.
import fs from 'node:fs';

let prompt = '';
try { prompt = String(JSON.parse(fs.readFileSync(0, 'utf8') || '{}').prompt || ''); } catch { process.exit(0); }

// Every spelling of the console command lands on the same page. Anchored to a leading slash so ordinary
// prose that happens to mention "configure" or "rvbc" never triggers the notice.
const CONSOLE_CMD = /^\s*\/(ruvnet-brain:)?(rvbc|rvcb|brain-console|configure)\b/i;
if (!CONSOLE_CMD.test(prompt)) process.exit(0);

// systemMessage → shown to the human, before the model responds. This is the whole point.
process.stdout.write(JSON.stringify({
  systemMessage: "🧠  Opening your RuvNet Brain console — scanning your setup now (~20s; up to a minute the first time), then it opens in your browser. Hang tight…",
}));
process.exit(0);
