import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_BUDGETS,
  budgetsForPlatform,
  runRenderProbeIsolated,
  timingFailure,
} from '../../scripts/qe/ux-suite.mjs';

describe('UX QE hard budgets', () => {
  it.each(['linux', 'darwin', 'win32'])('%s has every required user-felt hard budget', (platform) => {
    const budgets = budgetsForPlatform(platform);
    expect(Object.keys(budgets).sort()).toEqual([
      'commandToExplanationMs',
      'console time-to-visible',
      'maxDeadAirMs',
      'server-ready',
      'tips first-section',
      'tips time-to-visible (hero)',
    ].sort());
    expect(budgets.maxDeadAirMs).toBe(3000);
    expect(budgets.commandToExplanationMs).toBeLessThanOrEqual(3000);
    expect(budgets['console time-to-visible']).toBeLessThanOrEqual(4000);
  });

  it('turns a timing breach or missing measurement into a hard failure', () => {
    expect(timingFailure('paint', 100, 100)).toBeNull();
    expect(timingFailure('paint', 101, 100)).toContain('HARD');
    expect(timingFailure('paint', null, 100)).toContain('could not measure');
  });

  it('refuses to silently apply another platform budget', () => {
    expect(() => budgetsForPlatform('plan9')).toThrow(/unsupported/);
    expect(Object.keys(PLATFORM_BUDGETS)).toEqual(['darwin', 'linux', 'win32']);
  });

  it('bounds a browser probe that never returns and preserves its last stage', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-render-bound-'));
    const probe = path.join(dir, 'hang.mjs');
    fs.writeFileSync(probe, 'process.stderr.write("[render-probe] fixture:wedged\\n"); setInterval(() => {}, 1000);');
    try {
      const started = Date.now();
      const result = await runRenderProbeIsolated({ probeFile: probe, timeoutMs: 250 });
      expect(Date.now() - started).toBeLessThan(3000);
      expect(result.results).toEqual([]);
      expect(result.notes.join('\n')).toMatch(/exceeded 250ms.*fixture:wedged/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 5000);
});
