// console-advocacy-dial.test.mjs — the advocacy dial, made visible and selectable in the console.
//
// WHAT THIS PROTECTS. `advocacy` (scripts/user-settings.mjs) has a schema, a default, and help/
// whyItMatters/downside copy, and is READ by the emitter (anticipate.sh gates on it) — but until now
// the console never rendered it and never saved it. The "feel in control" gap this closes has exactly
// three ways to fail silently, and each gets its own test class below:
//
//   1. THE CONSOLE MUST SERVE IT — with the REAL options/default/copy from user-settings.mjs's own
//      SETTINGS_SCHEMA, never a hand-typed second copy that could drift from it (fails silently: the
//      console shows "off/on" while user-settings.mjs actually offers off/important-only/all).
//   2. A SAVE MUST ROUND-TRIP THROUGH user-settings.mjs's OWN saveSettings, TO THE FILE IT OWNS
//      (~/.config/ruvnet-brain/settings.json — STORE_PATH), which is a DIFFERENT file from this
//      console's own config.json. A save that landed in config.json instead would look identical in
//      the UI (a green "Saved." toast) while being invisible to the one thing that actually reads it —
//      anticipate.sh. That failure mode is why "never touches config.json" is its own test below, not
//      an assumption.
//   3. AN INVALID VALUE MUST BE REJECTED — not silently written, and not silently defaulted over a
//      real prior answer (the exact bug validateConfigPatch was built to kill for config.json; the
//      advocacy path must not reopen it for settings.json).
//
// HOW: onboarding-console.mjs is imported in a CHILD process with HOME pointed at a throwaway temp
// directory and RUVNET_SETTINGS_FILE pointed at a file inside it. Both are necessary and for the same
// reason: user-settings.mjs's STORE_PATH and onboarding-console.mjs's CONFIG_PATH are each computed
// ONCE, from os.homedir()/process.env.RUVNET_SETTINGS_FILE, AT MODULE LOAD — exactly the trap
// console-honesty-regressions.test.mjs documents for capability-registry.mjs's HOME. Setting either
// env var in-process after import would be too late to matter, and skipping the HOME override would
// leave CONFIG_PATH pointed at this machine's REAL ~/.claude/ruvnet-brain/config.json — a file this
// suite must never touch, let alone risk writing to. A child process, given both up front, is the only
// way to test the real functions rather than a stand-in.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONSOLE_MJS = path.join(REPO, 'scripts/onboarding-console.mjs');
const APP_JS = path.join(REPO, 'console/app.js');

let tmp, file, configPath;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'console-advocacy-')));
  file = path.join(tmp, 'settings.json');
  configPath = path.join(tmp, '.claude', 'ruvnet-brain', 'config.json'); // CONFIG_PATH under our fake HOME
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

/**
 * Run a snippet of JS in a CHILD process, HOME and RUVNET_SETTINGS_FILE both pointed into our scratch
 * dir (see file header for why both, and why a child at all). Throws with the child's own stdout/
 * stderr on a non-zero exit, so a broken snippet fails loudly rather than as a confusing JSON.parse
 * error on empty stdout.
 */
function run(src) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', src], {
    env: { ...process.env, HOME: tmp, USERPROFILE: tmp, RUVNET_SETTINGS_FILE: file }, // win32 homedir = USERPROFILE
    encoding: 'utf8', timeout: 60_000,
  });
  if (r.status !== 0) {
    throw new Error(`child exited ${r.status}\nSTDOUT: ${r.stdout}\nSTDERR: ${r.stderr}`);
  }
  return r.stdout;
}

/** Same as run(), but the snippet is expected to print exactly one JSON value on stdout. */
function runJSON(src) { return JSON.parse(run(src)); }

const IMPORT = `const m = await import(${JSON.stringify(pathToFileURL(CONSOLE_MJS).href)});`;

describe('the console serves the advocacy dial — real schema, not invented copy', () => {
  it('gatherAdvocacy() reports the real options + default straight from user-settings.mjs', () => {
    const out = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.gatherAdvocacy()));`);
    expect(out.schema).toHaveLength(1);
    const f = out.schema[0];
    expect(f.key).toBe('advocacy');
    expect(f.label).toBe('How much it volunteers');
    expect(f.type).toBe('enum');
    expect(f.options).toEqual(['off', 'important-only', 'all']);
    expect(f.default).toBe('important-only');
    // escalates:[] is the invariant user-settings.mjs's own tests pin ("speech only — no value of this
    // setting writes anything anywhere"); the console must pass it through unmodified, not drop it.
    expect(f.escalates).toEqual([]);
    // whyItMatters/downside are the exact strings the info bubble is required to reuse — present,
    // non-trivial, and (checked in the round-trip test below) never duplicated in app.js.
    expect(typeof f.whyItMatters).toBe('string');
    expect(f.whyItMatters.length).toBeGreaterThan(80);
    expect(typeof f.downside).toBe('string');
    expect(f.downside.length).toBeGreaterThan(60);
  });

  it('the served copy scopes the dial to capability advocacy and names the channels it does NOT govern', () => {
    // HONESTY REGRESSION — fails on the old copy. The dial was sold as THE volume knob on all
    // unsolicited behavior and claimed "off" meant "nothing volunteers anything at all, including a
    // real failure". Both are false and verified so: lesson-gate (its own controls — ratification +
    // blocking-optin.json + RUVNET_LESSON_MAX_SHOWS) and md-stamp (RUVNET_MD_STAMP, a file mutation)
    // are SEPARATE channels that do not obey this dial, and genuine failure alarms bypass it by
    // design. The copy the console serves must say what the dial does and does NOT govern — and it
    // must come FROM the schema, so this reads it back through gatherAdvocacy() rather than trusting a
    // hand-typed second copy in the client.
    const out = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.gatherAdvocacy()));`);
    const f = out.schema[0];
    const copy = `${f.help}\n${f.whyItMatters}\n${f.downside}`;

    // Names the separate channel it does NOT govern (fails on the old copy — it had no "lesson" at all).
    expect(copy).toMatch(/lesson/i);

    // The false "off = nothing speaks at all" claim is gone (present verbatim in the old copy).
    expect(copy).not.toMatch(/nothing volunteers anything at all/i);
    expect(copy).not.toMatch(/including a real failure/i);
  });

  it('reports "not chosen" (null) on a fresh machine — never the default painted on as a real answer', () => {
    const out = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.gatherAdvocacy()));`);
    expect(out.exists).toBe(false);
    expect(out.values).toEqual({ advocacy: null });
    expect(out.defaults).toEqual({ advocacy: 'important-only' });
  });

  it('once a value is saved, gatherAdvocacy() reports it as CHOSEN, not as a coincidental default', () => {
    const out = runJSON(`${IMPORT}
      m.saveAdvocacy({ advocacy: 'important-only' }); // == the default, on purpose: the tricky case
      process.stdout.write(JSON.stringify(m.gatherAdvocacy()));
    `);
    // Same value as the default, but CHOSEN — exists must be true and the value must not read as null.
    expect(out.exists).toBe(true);
    expect(out.values.advocacy).toBe('important-only');
  });

  it('gatherState() carries it in sections.userSettings, alongside (not instead of) config.json\'s section', () => {
    const out = runJSON(`${IMPORT}
      const st = m.gatherState(${JSON.stringify(REPO)}, { fleet: false });
      process.stdout.write(JSON.stringify({
        userSettingsKeys: (st.sections.userSettings?.schema || []).map((s) => s.key),
        hasConfigSection: Array.isArray(st.sections.config?.schema) && st.sections.config.schema.length > 0,
      }));
    `);
    expect(out.userSettingsKeys).toEqual(['advocacy']);
    expect(out.hasConfigSection).toBe(true);
  }, 30_000);
});

describe('a save round-trips through user-settings.mjs\'s saveSettings, to the file IT owns', () => {
  it('saveAdvocacy writes advocacy nested under `.settings`, in user-settings.mjs\'s own versioned envelope', () => {
    const out = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.saveAdvocacy({ advocacy: 'all' })));`);
    expect(out.ok).toBe(true);

    // On disk, in the SHAPE user-settings.mjs actually writes (version + settings.advocacy) — not a
    // flat { advocacy: 'all' } this console might have invented as a second, incompatible writer.
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.settings.advocacy).toBe('all');
    expect(typeof raw.version).toBe('number');
  });

  it('reading it back through gatherAdvocacy() sees exactly what was saved', () => {
    run(`${IMPORT} m.saveAdvocacy({ advocacy: 'off' });`);
    const after = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.gatherAdvocacy()));`);
    expect(after.values.advocacy).toBe('off');
  });

  it('a save takes a real backup — the same safety net user-settings.mjs\'s own saveSettings tests prove', () => {
    run(`${IMPORT} m.saveAdvocacy({ advocacy: 'off' });`); // first save: no backup (nothing existed yet)
    const second = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.saveAdvocacy({ advocacy: 'all' })));`);
    expect(second.ok).toBe(true);
    expect(second.backup).toBeTruthy();
    // The reported path is already tildified for display, matching gatherConfig()/saveConfig()'s own
    // convention — never the raw absolute path leaked to the UI.
    expect(second.backup.startsWith('~')).toBe(true);
  });

  it('never writes to config.json — the two stores are genuinely different files, not one in disguise', () => {
    // THE test this feature exists to pass. If saveAdvocacy() were ever wired to saveConfig()/
    // CONFIG_PATH instead of user-settings.mjs's saveSettings(), config.json would spring into
    // existence right here and this assertion would catch it.
    expect(fs.existsSync(configPath)).toBe(false); // sanity: nothing has touched it yet
    runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.saveAdvocacy({ advocacy: 'all' })));`);
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it('an invalid value is rejected — nothing is written, and the reason names the offending key', () => {
    const out = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.saveAdvocacy({ advocacy: 'sometimes' })));`);
    expect(out.ok).toBe(false);
    expect(out.rejected).toEqual([{ key: 'advocacy', reason: expect.stringContaining('off, important-only, all') }]);
    expect(fs.existsSync(file)).toBe(false); // first-ever save never happened
  });

  it('an invalid value after a real prior answer leaves that answer standing — never resets to the shipped default', () => {
    const out = runJSON(`${IMPORT}
      m.saveAdvocacy({ advocacy: 'off' });
      const bad = m.saveAdvocacy({ advocacy: 'nonsense' });
      process.stdout.write(JSON.stringify({ bad, after: m.gatherAdvocacy() }));
    `);
    expect(out.bad.ok).toBe(false);
    expect(out.after.values.advocacy).toBe('off'); // NOT 'important-only' (the shipped default)
  });

  it('an empty patch is refused as "nothing to save" rather than writing advocacy: undefined', () => {
    const out = runJSON(`${IMPORT} process.stdout.write(JSON.stringify(m.saveAdvocacy({})));`);
    expect(out.ok).toBe(false);
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe('console/app.js — wired to the real endpoint, reusing the schema\'s own copy', () => {
  const src = fs.readFileSync(APP_JS, 'utf8');

  it('posts advocacy saves to /api/save-advocacy — a real, distinct endpoint, not routed through save-config', () => {
    expect(src).toMatch(/\/api\/save-advocacy/);
  });

  it('renderSettings is called with the userSettings section at BOTH load paths (cache and live)', () => {
    // Two call sites in loadState(): the instant fast=1 paint and the live /api/state result. Both
    // must pass the second argument, or the fast-cache paint would silently render without the dial.
    const calls = [...src.matchAll(/renderSettings\(([^)]*)\)/g)].map((mm) => mm[1]);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const args of calls) {
      expect(args.split(',').map((a) => a.trim()).filter(Boolean).length,
        `renderSettings(${args}) — must receive both the config section and the userSettings section`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('does NOT hand-type advocacy copy in SETTING_INFO — the info bubble must come from the served schema', () => {
    // The whole point of fieldBeats()'s dynamic fallback: whyItMatters/downside are read from what the
    // server sends, never duplicated here. A hardcoded `advocacy:` entry appearing in SETTING_INFO
    // would mean a human re-typed user-settings.mjs's copy into a second place it can drift from.
    const m = src.match(/const SETTING_INFO = \{[\s\S]*?\n\};/);
    expect(m, 'SETTING_INFO block not found').toBeTruthy();
    expect(m[0]).not.toMatch(/\badvocacy\s*:/);
  });

  it('reuses whyItMatters/downside dynamically (fieldBeats) rather than inventing a fixed 3-beat shape', () => {
    expect(src).toMatch(/f\.whyItMatters/);
    expect(src).toMatch(/f\.downside/);
  });

  it('the shared widget builders exist — the dial is required to reuse them, not a bespoke control', () => {
    expect(src).toMatch(/function buildSettingsField\(/);
    expect(src).toMatch(/function buildSettingsForm\(/);
  });
});
