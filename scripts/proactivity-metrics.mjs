#!/usr/bin/env node
// proactivity-metrics.mjs — ADR-041 detector-layer recall + false-alarm harness.
//
// Spawns the REAL scripts/capability-registry.mjs (a fresh child, so HOME=<scratch> redirects
// os.homedir() at module load — capability-registry.mjs:60) against a ground-truth scratch machine, and
// scores it against the manifest. It never imports the detector; it runs the real process and reads its
// real JSON, so a bug anywhere in the probe path is in scope — which is the whole point (ADR-028's shipped
// "26 hooks off" lies all lived in that probe path).
//
//   detector-recall      = cohort capabilities the detector reports 'off' on the DORMANT machine
//                          ------------------------------------------------------------------------
//                          cohort capabilities the manifest declares dormant            (target >= 0.80)
//   detector-false-alarm = cohort capabilities the detector reports 'off' on the HEALTHY machine
//                          (target = 0 — a verified-healthy machine must raise no dormancy flag)
//
// The registryPath argument exists so the mutation test can point this at a deliberately-broken copy and
// watch the numbers move — the falsifiability ADR-041 demands (a harness that cannot fall on a broken
// detector is not a measurement).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildState, readManifest } from '../tests/helpers/ground-truth-machine.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REAL_REGISTRY = path.join(REPO, 'scripts', 'capability-registry.mjs');

/** Run the real detector against a scratch machine; return { key: state } for every row it emitted. */
export function runDetector(home, project, registryPath = REAL_REGISTRY) {
  const res = spawnSync(process.execPath, [registryPath, '--json', '--project', project], {
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (res.status !== 0 || !res.stdout) {
    throw new Error(`detector exited ${res.status}; stderr: ${String(res.stderr).slice(0, 300)}`);
  }
  const rows = JSON.parse(res.stdout);
  const out = {};
  for (const r of rows) if (r && typeof r.key === 'string') out[r.key] = r.state;
  return out;
}

/**
 * Build both ground-truth machines, run the detector against each, and score. Returns the two headline
 * numbers plus the per-capability detail (for a failing assertion to point at). Cleans up its scratch dirs.
 */
export function measure({ registryPath = REAL_REGISTRY } = {}) {
  const manifest = readManifest();
  const cohort = manifest.cohort;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gtm-'));
  try {
    const dormant = buildState('dormant', path.join(root, 'dormant'));
    const healthy = buildState('healthy', path.join(root, 'healthy'));

    const dormantSeen = runDetector(dormant.home, dormant.project, registryPath);
    const healthySeen = runDetector(healthy.home, healthy.project, registryPath);

    // Recall: of the cohort caps the manifest says are dormant, how many did the detector call 'off'?
    const dormantKeys = cohort.filter((k) => manifest.states.dormant[k] === 'off');
    const recalled = dormantKeys.filter((k) => dormantSeen[k] === 'off');
    const recall = dormantKeys.length ? recalled.length / dormantKeys.length : 1;

    // False alarm: of the cohort, how many did the detector call 'off' on the HEALTHY machine?
    const falseAlarms = cohort.filter((k) => healthySeen[k] === 'off');

    return {
      recall,
      falseAlarmCount: falseAlarms.length,
      cohort,
      dormantSeen: Object.fromEntries(cohort.map((k) => [k, dormantSeen[k]])),
      healthySeen: Object.fromEntries(cohort.map((k) => [k, healthySeen[k]])),
      missedDormant: dormantKeys.filter((k) => dormantSeen[k] !== 'off'),
      falseAlarms,
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('proactivity-metrics.mjs');
if (invokedDirectly) {
  const m = measure();
  console.log(JSON.stringify({ recall: m.recall, falseAlarmCount: m.falseAlarmCount,
    dormant: m.dormantSeen, healthy: m.healthySeen }, null, 2));
  const ok = m.recall >= 0.80 && m.falseAlarmCount === 0;
  console.log(ok ? `\nPASS — recall ${m.recall.toFixed(2)} (>=0.80), false-alarm ${m.falseAlarmCount} (=0)`
    : `\nFAIL — recall ${m.recall.toFixed(2)}, false-alarm ${m.falseAlarmCount}; missed=${JSON.stringify(m.missedDormant)} falseAlarms=${JSON.stringify(m.falseAlarms)}`);
  process.exit(ok ? 0 : 1);
}
