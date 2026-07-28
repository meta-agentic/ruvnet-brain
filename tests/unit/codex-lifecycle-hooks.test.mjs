import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WRAPPER = path.join(ROOT, 'plugin', 'scripts', 'codex-hook-wrapper.mjs');
const ADAPTER = path.join(ROOT, 'plugin', 'scripts', 'codex-hook-adapter.mjs');
const HOOKS = path.join(ROOT, 'plugin', 'hooks', 'codex-hooks.json');
const MANIFEST = path.join(ROOT, 'plugin', '.codex-plugin', 'plugin.json');

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ruvnet-codex-hooks-'));
  const brain = path.join(home, '.cache', 'ruvnet-brain');
  fs.mkdirSync(path.join(brain, 'versions'), { recursive: true });
  return { home, brain };
}

function installGeneration(brain, version, shimSource) {
  const scripts = path.join(brain, 'versions', version, 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(ADAPTER, path.join(scripts, 'codex-hook-adapter.mjs'));
  fs.writeFileSync(path.join(scripts, 'hook-shim.mjs'), shimSource);
  fs.writeFileSync(path.join(brain, 'active.json'), JSON.stringify({
    generation: version,
    version,
    codeRoot: `versions/${version}`,
  }));
}

function fire(home, id, payload) {
  return spawnSync(process.execPath, [WRAPPER, id], {
    cwd: ROOT,
    env: { ...process.env, HOME: home },
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 4_000,
  });
}

describe('Codex lifecycle hook packaging', () => {
  it('ships a Codex manifest and schema-valid hook source without Claude-only metadata', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const hooks = JSON.parse(fs.readFileSync(HOOKS, 'utf8'));
    const projectHooks = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex', 'hooks.json'), 'utf8'));

    expect(manifest.hooks).toBe('./hooks/codex-hooks.json');
    expect(manifest.mcpServers).toBe('./.mcp.json');
    expect(hooks._note).toBeUndefined();
    expect(projectHooks._note).toBeUndefined();
    expect(hooks.hooks.SessionStart).toBeTruthy();
    expect(hooks.hooks.Stop).toBeTruthy();
  });

  it('uses one generation-independent entrypoint for every Codex hook', () => {
    const hooks = JSON.parse(fs.readFileSync(HOOKS, 'utf8')).hooks;
    const handlers = Object.values(hooks).flatMap((groups) => groups.flatMap((group) => group.hooks));

    expect(handlers.length).toBeGreaterThan(0);
    for (const handler of handlers) {
      expect(handler.command).toMatch(/\.cache\/ruvnet-brain\/codex-hook\.mjs/);
      expect(handler.command).not.toMatch(/PLUGIN_ROOT|CLAUDE_PLUGIN_ROOT|plugins\/cache/);
    }
    expect(hooks.SessionEnd[0].hooks[0].timeout).toBeLessThanOrEqual(3);
  });

  it('installer places the stable wrapper outside every versioned plugin cache', async () => {
    const { wireCodexHost } = await import('../../bin/install.mjs');
    const { home } = fixture();
    const codexDir = path.join(home, '.codex');
    const wrapperPath = path.join(home, '.cache', 'ruvnet-brain', 'codex-hook.mjs');
    fs.mkdirSync(codexDir, { recursive: true });

    const result = wireCodexHost({
      codexDir,
      configPath: path.join(codexDir, 'config.toml'),
      serverDir: path.join(home, '.cache', 'ruvnet-brain', 'mcp'),
      hookWrapperSource: WRAPPER,
      hookWrapperPath: wrapperPath,
      announce: false,
    });

    expect(result.hookWrapperPath).toBe(wrapperPath);
    expect(fs.readFileSync(wrapperPath, 'utf8')).toBe(fs.readFileSync(WRAPPER, 'utf8'));
    expect(wrapperPath).not.toMatch(/plugins[\\/]cache|versions[\\/]/);
  });
});

describe('Codex lifecycle adapter', () => {
  it('passes SessionStart text through as developer context', () => {
    const { home, brain } = fixture();
    installGeneration(brain, 'v1', 'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write("[RuvNet Brain start]"));');

    const result = fire(home, 'session-start', {
      session_id: 'codex-a',
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: ROOT,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('[RuvNet Brain start]');
  });

  it('translates the Claude Stop continuation envelope into Codex block plus reason', () => {
    const { home, brain } = fixture();
    installGeneration(
      brain,
      'v1',
      'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"Stop",additionalContext:"Finish the open work."}})));',
    );

    const result = fire(home, 'continuation-gate', {
      session_id: 'codex-stop',
      turn_id: 'turn-1',
      hook_event_name: 'Stop',
      stop_hook_active: false,
      last_assistant_message: 'Done.',
      cwd: ROOT,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      decision: 'block',
      reason: 'Finish the open work.',
    });
  });

  it('wraps bracket-prefixed UserPromptSubmit text as valid Codex JSON', () => {
    const { home, brain } = fixture();
    installGeneration(brain, 'v1', 'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write("[RuvNet Brain grounding] use RVF"));');

    const result = fire(home, 'ground-ruvnet', {
      session_id: 'codex-prompt',
      turn_id: 'turn-2',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'How should vectors be stored?',
      cwd: ROOT,
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: '[RuvNet Brain grounding] use RVF',
      },
    });
  });

  it('resolves the active generation on every invocation after the old one is removed', () => {
    const { home, brain } = fixture();
    installGeneration(brain, 'v1', 'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write("generation one"));');
    expect(fire(home, 'session-start', {
      session_id: 'codex-upgrade',
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: ROOT,
    }).stdout).toBe('generation one');

    installGeneration(brain, 'v2', 'process.stdin.resume(); process.stdin.on("end",()=>process.stdout.write("generation two"));');
    fs.rmSync(path.join(brain, 'versions', 'v1'), { recursive: true });

    const result = fire(home, 'session-start', {
      session_id: 'codex-upgrade',
      hook_event_name: 'SessionStart',
      source: 'resume',
      cwd: ROOT,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('generation two');
  });
});
