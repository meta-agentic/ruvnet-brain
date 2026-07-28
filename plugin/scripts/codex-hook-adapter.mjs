#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raw = fs.readFileSync(0, 'utf8');
let input = {};
try { input = raw ? JSON.parse(raw) : {}; } catch { /* the shared hook bodies already fail soft */ }

const hookId = process.argv[2] || '';
const event = String(input.hook_event_name || '');
let adapted = false;
const codexToolName = String(input.tool_name).toLowerCase();

// Codex names these tools differently from the shared Claude hook contracts. Normalize at the
// host boundary once so every existing safety/learning body sees the same typed event.
if (['exec_command', 'functions.exec_command', 'functions__exec_command'].includes(codexToolName)) {
  input.tool_name = 'Bash';
  input.tool_input = {
    ...(input.tool_input || {}),
    command: input.tool_input?.command || input.tool_input?.cmd || '',
  };
  adapted = true;
} else if (codexToolName === 'apply_patch') {
  const patch = typeof input.tool_input?.command === 'string' ? input.tool_input.command : '';
  const filePath = patch.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/m)?.[1]?.trim() || '';
  input.tool_name = 'Edit';
  input.tool_input = {
    ...(input.tool_input || {}),
    ...(filePath ? { file_path: filePath } : {}),
    new_string: patch,
  };
  adapted = true;
} else if (codexToolName === 'spawn_agent') {
  input.tool_name = 'Agent';
  input.tool_input = {
    ...(input.tool_input || {}),
    description: input.tool_input?.description || input.tool_input?.message || '',
    subagent_type: input.tool_input?.subagent_type || input.tool_input?.agent_type || 'default',
  };
  adapted = true;
}

const hookInput = adapted ? JSON.stringify(input) : raw;
const shim = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hook-shim.mjs');
const env = {
  ...process.env,
  CLAUDE_SESSION_ID: String(input.session_id || process.env.CLAUDE_SESSION_ID || ''),
  CLAUDE_PLUGIN_ROOT: String(process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || ''),
  CLAUDE_PROJECT_DIR: String(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()),
  RUVNET_HOOK_HOST: 'codex',
};
const result = spawnSync(process.execPath, [shim, hookId, ...process.argv.slice(3)], {
  input: hookInput,
  encoding: 'utf8',
  env,
});

if (result.status && result.stderr) process.stderr.write(result.stderr);
if (result.status) process.exit(result.status);

const stdout = result.stdout || '';
if (!stdout) process.exit(0);

let parsed = null;
try { parsed = JSON.parse(stdout); } catch { /* plain text is valid for some Codex events */ }

if (event === 'Stop') {
  const reason = parsed?.hookSpecificOutput?.additionalContext
    || parsed?.reason
    || parsed?.stopReason;
  if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

if ((event === 'SessionStart' || event === 'UserPromptSubmit') && !parsed) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: stdout,
    },
  }));
  process.exit(0);
}

if (parsed?.hookSpecificOutput?.permissionDecision === 'defer') {
  delete parsed.hookSpecificOutput.permissionDecision;
  if (Object.keys(parsed.hookSpecificOutput).length === 1 && parsed.hookSpecificOutput.hookEventName) {
    delete parsed.hookSpecificOutput;
  }
  process.stdout.write(JSON.stringify(parsed));
  process.exit(0);
}

process.stdout.write(stdout);
