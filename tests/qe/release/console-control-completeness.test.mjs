import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SERVER = fs.readFileSync(path.join(ROOT, 'scripts/onboarding-console.mjs'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'console/app.js'), 'utf8');

describe('console control completeness', () => {
  it('renders only config choices with a proven consumer', () => {
    expect(SERVER).toContain('const CONFIG_CONTROL_SUPPORT = Object.freeze({});');
    for (const key of ['openrouterKey', 'nightly', 'routing', 'qeFleet']) {
      expect(SERVER).toMatch(new RegExp(`\\b${key}:`));
    }
    expect(SERVER).toContain('saveOpenRouterCredential(requestedSecret');
    expect(SERVER).toContain('applyNightlyChoice(requestedNightly)');
    expect(SERVER).toContain('detectProvider(cat, { provider: cfgNow.provider })');
  });

  it('surfaces every canonical user setting through a live control', () => {
    for (const live of [
      'brainEnabled', 'brainProfile', 'learningScope', 'advocacy', 'autoApply',
      'newProjectDefaults',
    ]) {
      expect(SERVER).toContain(`'${live}'`);
    }
    expect(SERVER).toContain('const LIVE_USER_SETTING_KEYS = Object.freeze(');
    expect(SERVER).toContain('const autoApplyOn = loadSettings().values.autoApply === true');
  });

  it('keeps all four working choice paths connected to their real consumers', () => {
    expect(SERVER).toContain('saveBrainPower(body.values || {})');
    expect(SERVER).toContain('saveBrainProfile(body.values || {})');
    expect(SERVER).toContain('saveAdvocacy(body.values || {})');
    expect(SERVER).toContain('detectProvider(cat, { provider: cfgNow.provider })');
  });

  it('surfaces platform-unavailable choices without fake controls', () => {
    expect(APP).toContain('Unavailable on this machine');
    expect(APP).toContain('runtime is not supported or reachable on this machine');
    expect(APP).toContain('settings-unavailable-list');
    expect(APP).toContain('unavailable here');
  });

  it('offers one consent-gated Fix all path with per-item revalidation and undo', () => {
    expect(APP).toContain('Fix all (');
    expect(APP).toContain('Yes, fix all verified items');
    expect(APP).toContain('Unsupported settings and secrets are never included');
    expect(APP).toContain("postJSON('/api/apply', { ids: recs.map((rec) => rec.id), preStateHash })");
    expect(APP).toContain("postJSON('/api/undo', { undoToken: result.undoToken })");
    expect(SERVER).toContain('const { ids: validNow } = currentValidIds(id);');
    expect(SERVER).toContain("onlyId.startsWith('reconcile:')");
  });
});
