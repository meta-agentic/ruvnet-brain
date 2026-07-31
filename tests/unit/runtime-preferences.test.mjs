import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  loadRuntimePreferences,
  openRouterCredentialStatus,
  runtimeChildEnv,
  saveOpenRouterCredential,
  seedProjectDefaults,
} from '../../plugin/scripts/runtime-preferences.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rvb-runtime-prefs-'));
  roots.push(root);
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(cwd, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
  const env = {
    HOME: home,
    PATH: process.env.PATH,
    RUVNET_BRAIN_CONFIG_FILE: path.join(root, 'config.json'),
    RUVNET_SETTINGS_FILE: path.join(root, 'settings.json'),
    RUVNET_BRAIN_SECRETS_FILE: path.join(root, 'secrets.enc.json'),
  };
  return { root, home, cwd, env };
}

const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

describe('runtime preference boundary', () => {
  it('defaults learning to the project and never opts into routing, QE, or auto-apply', () => {
    const f = fixture();
    const state = loadRuntimePreferences({ env: f.env, cwd: f.cwd });
    expect(state.values).toMatchObject({
      routing: null,
      qeFleet: null,
      learningScope: 'project',
      autoApply: false,
      newProjectDefaults: false,
    });
    expect(state.chosen).toMatchObject({ routing: false, qeFleet: false });
  });

  it('lets a first-open project snapshot override only project-scoped choices', () => {
    const f = fixture();
    write(f.env.RUVNET_BRAIN_CONFIG_FILE, { routing: 'auto', qeFleet: true, nightly: true });
    write(f.env.RUVNET_SETTINGS_FILE, {
      version: 1,
      settings: { learningScope: 'user', autoApply: false, newProjectDefaults: true, advocacy: 4 },
    });
    write(path.join(f.cwd, '.swarm/ruvnet-brain-settings.json'), {
      version: 1,
      values: { routing: 'off', qeFleet: false, learningScope: 'off', autoApply: true, nightly: false },
    });
    const state = loadRuntimePreferences({ env: f.env, cwd: f.cwd });
    expect(state.values).toMatchObject({
      routing: 'off',
      qeFleet: false,
      learningScope: 'off',
      autoApply: true,
      nightly: true,
    });
  });

  it('seeds new-project defaults once, omits secrets and machine-level nightly, and never overwrites', () => {
    const f = fixture();
    write(f.env.RUVNET_BRAIN_CONFIG_FILE, {
      openrouterKey: 'legacy-secret-must-not-copy',
      routing: 'auto',
      qeFleet: true,
      nightly: true,
      provider: 'codex',
    });
    write(f.env.RUVNET_SETTINGS_FILE, {
      version: 1,
      settings: { learningScope: 'project', autoApply: false, newProjectDefaults: true, advocacy: 4 },
    });
    const first = seedProjectDefaults({ env: f.env, cwd: f.cwd });
    expect(first.action).toBe('created');
    const raw = fs.readFileSync(first.path, 'utf8');
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('nightly');
    expect(JSON.parse(raw).values).toMatchObject({
      routing: 'auto',
      qeFleet: true,
      learningScope: 'project',
      autoApply: false,
      advocacy: 4,
      provider: 'codex',
    });
    const before = fs.readFileSync(first.path);
    expect(seedProjectDefaults({ env: f.env, cwd: f.cwd }).action).toBe('already-initialized');
    expect(fs.readFileSync(first.path)).toEqual(before);
  });

  it('passes an environment key only to the cloned child environment', () => {
    const f = fixture();
    const env = { ...f.env, OPENROUTER_API_KEY: 'sk-or-test-sentinel' };
    const child = runtimeChildEnv({ env, cwd: f.cwd });
    expect(child).not.toBe(env);
    expect(child.OPENROUTER_API_KEY).toBe('sk-or-test-sentinel');
    expect(openRouterCredentialStatus({ env, cwd: f.cwd })).toMatchObject({
      configured: true,
      source: 'environment',
      legacyPlaintext: false,
    });
  });

  it('recognizes but never rewrites a legacy plaintext key', () => {
    const f = fixture();
    write(f.env.RUVNET_BRAIN_CONFIG_FILE, { openrouterKey: 'sk-or-legacy-sentinel' });
    const before = fs.readFileSync(f.env.RUVNET_BRAIN_CONFIG_FILE);
    expect(openRouterCredentialStatus({ env: f.env, cwd: f.cwd })).toMatchObject({
      configured: true,
      source: 'legacy-plaintext',
      legacyPlaintext: true,
    });
    expect(runtimeChildEnv({ env: f.env, cwd: f.cwd }).OPENROUTER_API_KEY).toBe('sk-or-legacy-sentinel');
    expect(fs.readFileSync(f.env.RUVNET_BRAIN_CONFIG_FILE)).toEqual(before);
  });

  it.skipIf(
    spawnSync('sops', ['--version'], { encoding: 'utf8' }).status !== 0
      || spawnSync('age-keygen', ['--version'], { encoding: 'utf8' }).status !== 0,
  )('round-trips an OpenRouter key through SOPS+age without plaintext on disk', () => {
    const f = fixture();
    const identity = path.join(f.home, '.config', 'sops', 'age', 'keys.txt');
    fs.mkdirSync(path.dirname(identity), { recursive: true });
    const generated = spawnSync('age-keygen', ['-o', identity], { encoding: 'utf8' });
    expect(generated.status).toBe(0);
    const env = { ...f.env, SOPS_AGE_KEY_FILE: identity };
    const sentinel = 'sk-or-encrypted-sentinel-123456789';
    const saved = saveOpenRouterCredential(sentinel, { env, cwd: f.cwd });
    expect(saved.ok).toBe(true);
    const disk = fs.readFileSync(f.env.RUVNET_BRAIN_SECRETS_FILE, 'utf8');
    expect(disk).not.toContain(sentinel);
    expect(runtimeChildEnv({ env, cwd: f.cwd }).OPENROUTER_API_KEY).toBe(sentinel);
    expect(openRouterCredentialStatus({ env, cwd: f.cwd })).toMatchObject({
      configured: true,
      source: 'sops-age',
      legacyPlaintext: false,
    });
  });
});
