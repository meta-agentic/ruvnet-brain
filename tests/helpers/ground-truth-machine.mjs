// ground-truth-machine.mjs — ADR-041 fixture builder.
//
// Constructs a scratch HOME whose REAL artifacts put each cohort capability into the state the manifest
// declares — then INDEPENDENTLY VERIFIES the bytes it wrote before returning. The builder writes
// artifacts only; it never emits a state word, and it never imports capability-registry.mjs. The
// manifest (tests/fixtures/ground-truth-machine/ground-truth.json) is the sole state authority; the
// detector maps artifact->state on its own. That is the separation of authorities ADR-041 requires:
// nothing here can echo the answer, because the answer is computed by code this file never touches.
//
// Grounded against scripts/capability-registry.mjs (read live, not recalled):
//   session-capture ON  = a CAPTURE_COMMAND-matching command wired at BOTH PreCompact AND SessionEnd
//                         (registry.mjs:560-569; countCaptureCommands walks [{hooks:[{command}]}], :212).
//   session-capture OFF = settings.json EXISTS but neither boundary carries a capture command (:571).
//                         (A MISSING settings.json would be ABSENT, not OFF — so we always write one.)
//   mcp-servers    ON   = >=1 key under mcpServers in ~/.claude.json (registry.mjs:586-590).
//   mcp-servers    OFF  = the file exists with an EMPTY mcpServers object (:587).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = path.join(HERE, '..', 'fixtures', 'ground-truth-machine', 'ground-truth.json');

export function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

// The SAME regex capability-registry.mjs:210 applies — imported here ONLY to self-verify the artifact we
// wrote actually satisfies the probe's own condition, never to classify state (that is the detector's job).
const CAPTURE_COMMAND = /(agentdb|autocapture|auto-capture|session-end|session_end|sessionend|precompact|pre-compact|memory[\s_-]*(store|save|persist)|\bruflo\b[^"]*\b(memory|session|hooks)\b|claude-flow[^"]*\b(memory|session|hooks)\b|(capture|persist|snapshot|checkpoint)[\w-]*\.(mjs|js|sh|py))/i;

// A command string that satisfies CAPTURE_COMMAND — a real state-persisting hook, not a placeholder.
const CAPTURE_CMD = 'node agentdb-autocapture.mjs';

function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

/**
 * Build a scratch HOME (and an empty scratch project) for one manifest state ("healthy" | "dormant").
 * Returns { home, project, cleanup }. The caller runs the real detector with HOME=home --project=project.
 */
export function buildState(stateName, rootDir) {
  const manifest = readManifest();
  const want = manifest.states[stateName];
  if (!want) throw new Error(`ground-truth-machine: unknown state "${stateName}" (have: ${Object.keys(manifest.states).join(', ')})`);

  const home = path.join(rootDir, 'home');
  const project = path.join(rootDir, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });

  // ── session-capture -> ~/.claude/settings.json ────────────────────────────────────────────────────
  const settingsPath = path.join(home, '.claude', 'settings.json');
  if (want['session-capture'] === 'on') {
    const captureGroup = [{ matcher: '.*', hooks: [{ type: 'command', command: CAPTURE_CMD }] }];
    writeJSON(settingsPath, { hooks: { PreCompact: captureGroup, SessionEnd: captureGroup } });
  } else {
    // EXISTS but empty hooks -> OFF, not ABSENT.
    writeJSON(settingsPath, { hooks: {} });
  }

  // ── mcp-servers -> ~/.claude.json ─────────────────────────────────────────────────────────────────
  const claudeJsonPath = path.join(home, '.claude.json');
  if (want['mcp-servers'] === 'on') {
    writeJSON(claudeJsonPath, { mcpServers: { 'example-notes': { command: 'node', args: ['notes-server.mjs'] } } });
  } else {
    writeJSON(claudeJsonPath, { mcpServers: {} });
  }

  verifyArtifacts(stateName, { home, settingsPath, claudeJsonPath, want });

  return { home, project, cleanup: () => fs.rmSync(rootDir, { recursive: true, force: true }) };
}

/**
 * INDEPENDENT self-check: re-read the bytes and assert they satisfy the probe's OWN condition — so a
 * silently-wrong artifact (the "real-state echo one layer up" ADR-041's duel flagged) is caught before
 * the detector ever runs. This checks ARTIFACT correctness, not detector output.
 */
export function verifyArtifacts(stateName, { home, settingsPath, claudeJsonPath, want }) {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const commandsAt = (boundary) => (settings.hooks?.[boundary] || [])
    .flatMap((g) => (Array.isArray(g?.hooks) ? g.hooks : []))
    .map((h) => (typeof h?.command === 'string' ? h.command : ''))
    .filter((c) => CAPTURE_COMMAND.test(c));
  const captureBoth = commandsAt('PreCompact').length > 0 && commandsAt('SessionEnd').length > 0;
  const wantCaptureOn = want['session-capture'] === 'on';
  if (captureBoth !== wantCaptureOn) {
    throw new Error(`ground-truth-machine[${stateName}]: settings.json does not satisfy session-capture=${want['session-capture']} (captureBoth=${captureBoth})`);
  }

  const claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
  const mcpCount = Object.keys(claudeJson.mcpServers || {}).length;
  const wantMcpOn = want['mcp-servers'] === 'on';
  if ((mcpCount > 0) !== wantMcpOn) {
    throw new Error(`ground-truth-machine[${stateName}]: .claude.json does not satisfy mcp-servers=${want['mcp-servers']} (mcpCount=${mcpCount})`);
  }
  return true;
}
