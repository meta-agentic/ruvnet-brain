// user-settings.test.mjs — the user's stated preferences, and the promises made about them.
//
// WHAT THIS PROTECTS. Two things, and they fail in opposite directions.
//
// The first is the DEFAULTS. A settings model is read by exactly one person carefully (the author)
// and by everyone else never — so whatever ships as the default IS the product for almost every user.
// A default that quietly reaches outside their project is therefore not a small mistake; it is the
// behaviour, applied to people who never chose it. The `escalates` field exists to make that
// checkable rather than reviewable, and the numeric class below asserts it on every entry, including
// entries added after this file was written.
//
// The second is DURABILITY. These answers only mean something if they survive — an update, a corrupt
// write, a second session saving at the same moment, and the user's own hand-edit. The high class
// covers the write path for exactly that reason: backup-before-write, merge-don't-clobber, and a
// revert that returns the machine to the state it was actually in rather than to a synthesised one.
//
// The five test classes ADR-028 requires:
//   low         — schema shape and validation, table-driven, no I/O
//   medium      — real filesystem round trip through a temp settings file
//   high        — the write path: backup taken, refuses to clobber, revert is a true undo
//   numeric     — the conservative-defaults invariant, asserted per entry as a count
//   qualitative — each setting explains its own downside in plain English (structure asserted here;
//                 whether the prose is any good is a human's call, per "never grade your own work")

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SETTINGS_SCHEMA, SETTINGS_VERSION, STORE_PATH,
  defaults, validate, loadSettings, saveSettings, listBackups, revertSettings, escalatesBeyondProject,
} from '../../scripts/user-settings.mjs';

let tmp, file;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'user-settings-')));
  file = path.join(tmp, 'settings.json');
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('low — schema completeness', () => {
  // The four the product promises. Named explicitly so deleting one is a test failure rather than a
  // silently smaller feature.
  it.each(['learningScope', 'advocacy', 'autoApply', 'newProjectDefaults'])('defines %s', (key) => {
    expect(SETTINGS_SCHEMA.map((s) => s.key)).toContain(key);
  });

  it('every entry carries all six required fields plus its escalation list', () => {
    for (const s of SETTINGS_SCHEMA) {
      for (const field of ['key', 'label', 'help', 'type', 'whyItMatters', 'downside']) {
        expect(s[field], `${s.key}.${field}`).toBeTruthy();
        expect(typeof s[field], `${s.key}.${field}`).toBe('string');
      }
      expect(s, `${s.key}.default`).toHaveProperty('default');   // may legitimately be `false`
      expect(Array.isArray(s.escalates), `${s.key}.escalates`).toBe(true);
    }
  });

  it('the declared type matches the declared default, and enums list their options', () => {
    for (const s of SETTINGS_SCHEMA) {
      expect(['enum', 'bool'], `${s.key}.type`).toContain(s.type);
      if (s.type === 'bool') {
        expect(typeof s.default, `${s.key}`).toBe('boolean');
      } else {
        expect(Array.isArray(s.options), `${s.key}.options`).toBe(true);
        expect(s.options.length, `${s.key}.options`).toBeGreaterThan(1);
        expect(s.options, `${s.key}.default must be one of its own options`).toContain(s.default);
      }
    }
  });

  it('the two scope enums offer the choices the product describes', () => {
    const scope = SETTINGS_SCHEMA.find((s) => s.key === 'learningScope');
    expect(scope.options).toEqual(['off', 'project', 'user']);
    const advocacy = SETTINGS_SCHEMA.find((s) => s.key === 'advocacy');
    expect(advocacy.options).toEqual(['off', 'important-only', 'all']);
  });

  it('keys are unique — a duplicate would make one entry unreachable through BY_KEY', () => {
    const keys = SETTINGS_SCHEMA.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('low — validation refuses rather than guesses', () => {
  it('accepts a fully-specified valid object unchanged', () => {
    // FULLY specified means every key in SETTINGS_SCHEMA — `brainEnabled` joined it with ADR-054.
    // The assertion below is a deep equality against the complete values object, so a new key must
    // be added here rather than the assertion loosened: the point of this test is that validate()
    // returns exactly what it was given when everything given is valid.
    const input = { brainEnabled: false, learningScope: 'user', advocacy: 'all', autoApply: true, newProjectDefaults: true };
    const r = validate(input);
    expect(r.ok).toBe(true);
    expect(r.values).toEqual(input);
  });

  it('fills every unspecified key from defaults, so callers always get a complete object', () => {
    const r = validate({ advocacy: 'off' });
    expect(r.values).toEqual({ ...defaults(), advocacy: 'off' });
    expect(r.ok).toBe(true);
  });

  it.each([
    ['learningScope', 'global'],        // plausible-sounding, not an option
    ['learningScope', true],
    ['advocacy', 'IMPORTANT-ONLY'],     // case matters — we do not silently normalise
    ['autoApply', 'true'],              // the string, not the boolean
    ['autoApply', 1],
    ['newProjectDefaults', 'yes'],
  ])('falls back to the default for %s=%o and records WHY', (key, bad) => {
    const r = validate({ [key]: bad });
    expect(r.ok).toBe(false);
    expect(r.values[key]).toBe(defaults()[key]);
    expect(r.errors.some((e) => e.key === key)).toBe(true);
  });

  it('an invalid value costs only its own key — the user keeps the answers they got right', () => {
    // The failure this prevents: one bad field resetting the whole object. A user who set three
    // things correctly and one thing wrong must lose exactly one thing.
    const r = validate({ learningScope: 'user', advocacy: 'nonsense', autoApply: true });
    expect(r.values.learningScope).toBe('user');
    expect(r.values.autoApply).toBe(true);
    expect(r.values.advocacy).toBe(defaults().advocacy);
  });

  it('drops unknown keys with a warning instead of storing them forever', () => {
    const r = validate({ autoApply: false, telepathy: true });
    expect(r.values).not.toHaveProperty('telepathy');
    expect(r.warnings.some((w) => w.key === 'telepathy')).toBe(true);
    expect(r.ok).toBe(true);   // an ignorable extra key is not an error in the user's own answers
  });

  it.each([[null], [[]], ['a string'], [42]])('degrades to defaults on non-object input %o', (bad) => {
    const r = validate(bad);
    expect(r.ok).toBe(false);
    expect(r.values).toEqual(defaults());
  });
});

describe('numeric — the conservative-defaults invariant, asserted per entry', () => {
  // THE test in this file. Stated as a count so it holds for settings that do not exist yet: every
  // entry, present and future, must default to a value that does not act beyond the current project.
  it('zero of the schema entries default to an escalating value', () => {
    const offenders = SETTINGS_SCHEMA.filter((s) => s.escalates.includes(s.default));
    expect(offenders.map((s) => s.key)).toEqual([]);
    expect(offenders.length).toBe(0);
  });

  it('autoApply defaults to false — the one that would let it change the machine unattended', () => {
    expect(defaults().autoApply).toBe(false);
  });

  it('newProjectDefaults defaults to false — writing into projects not yet created is opt-in', () => {
    expect(defaults().newProjectDefaults).toBe(false);
  });

  it('learning does not default to compounding across every project the user owns', () => {
    expect(defaults().learningScope).not.toBe('user');
    expect(escalatesBeyondProject('learningScope', 'user')).toBe(true);
    expect(escalatesBeyondProject('learningScope', 'project')).toBe(false);
  });

  it('at least three of the four settings declare a value that escalates', () => {
    // Guards the opposite failure from the one above: an `escalates: []` on everything would make the
    // invariant vacuously true. If a setting can reach outside the project, it must SAY so.
    const withEscalation = SETTINGS_SCHEMA.filter((s) => s.escalates.length > 0);
    expect(withEscalation.length).toBeGreaterThanOrEqual(3);
  });

  it('advocacy escalates nothing — every level of it is speech, not action', () => {
    expect(SETTINGS_SCHEMA.find((s) => s.key === 'advocacy').escalates).toEqual([]);
  });
});

describe('medium — round trip through a real file', () => {
  it('a fresh machine with no settings file reads as defaults and says so', () => {
    // House rule 3, empty-first: nothing installed must still render honestly.
    const s = loadSettings(file);
    expect(s.exists).toBe(false);
    expect(s.healthy).toBe(true);
    expect(s.values).toEqual(defaults());
    expect(s.errors).toEqual([]);
  });

  it('saves and reads back exactly what was chosen', () => {
    // `brainEnabled: false` is deliberately a NON-default here: this round-trip must prove the
    // MIRROR key survives a real save/load, which is the only thing settings.json is responsible for
    // under ADR-054. (Writing the mirror never touches the sentinel — the switch is flipped only by
    // brain-state.mjs, via the console. See brain-off.test.mjs for that half.)
    const chosen = { brainEnabled: false, learningScope: 'user', advocacy: 'all', autoApply: true, newProjectDefaults: true };
    const saved = saveSettings(chosen, { file });
    expect(saved.ok).toBe(true);

    const back = loadSettings(file);
    expect(back.exists).toBe(true);
    expect(back.healthy).toBe(true);
    expect(back.values).toEqual(chosen);
  });

  it('writes a versioned envelope, not a bare settings object', () => {
    saveSettings({ autoApply: true }, { file });
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(raw.version).toBe(SETTINGS_VERSION);
    expect(raw.settings.autoApply).toBe(true);
    expect(typeof raw.updated).toBe('string');
  });

  it('a partial save leaves the other answers standing', () => {
    saveSettings({ learningScope: 'user', advocacy: 'all' }, { file });
    saveSettings({ autoApply: true }, { file });          // says nothing about the first two
    const back = loadSettings(file);
    expect(back.values.learningScope).toBe('user');
    expect(back.values.advocacy).toBe('all');
    expect(back.values.autoApply).toBe(true);
  });

  it('stores under ~/.config/ruvnet-brain — outside anything --update replaces', () => {
    // Not decoration. bin/install.mjs overwrites ~/.cache/ruvnet-brain wholesale on --update and
    // rmSync's it on --uninstall; it has no code path that touches ~/.config/ruvnet-brain at all.
    // A setting stored in the cache would be destroyed by the next release, which is the same as not
    // having settings.
    expect(STORE_PATH).toContain(path.join('.config', 'ruvnet-brain'));
    expect(STORE_PATH).not.toContain(path.join('.cache', 'ruvnet-brain'));
  });
});

describe('medium — a corrupt or hand-edited file degrades instead of throwing', () => {
  // The user is invited to edit this file by hand (that is why it is readable JSON), and writes get
  // truncated by full disks and killed processes. Every surface that reads settings would otherwise
  // crash on input that is entirely expected.
  it('truncated JSON reads as defaults and reports itself unhealthy', () => {
    fs.writeFileSync(file, '{ "version": 1, "settings": { "autoApply": tr');
    let s;
    expect(() => { s = loadSettings(file); }).not.toThrow();
    expect(s.values).toEqual(defaults());
    expect(s.healthy).toBe(false);
    expect(s.exists).toBe(true);       // it EXISTS and is broken — a different state from absent
    expect(s.errors.length).toBeGreaterThan(0);
  });

  it('an empty file degrades to defaults', () => {
    fs.writeFileSync(file, '');
    const s = loadSettings(file);
    expect(s.values).toEqual(defaults());
    expect(s.healthy).toBe(false);
  });

  it('valid JSON of the wrong shape degrades to defaults', () => {
    fs.writeFileSync(file, JSON.stringify(['not', 'an', 'object']));
    const s = loadSettings(file);
    expect(s.values).toEqual(defaults());
  });

  it('a hand-edited nonsense VALUE keeps the file usable and names the offending key', () => {
    fs.writeFileSync(file, JSON.stringify({ version: 1, settings: { learningScope: 'everywhere', autoApply: false } }));
    const s = loadSettings(file);
    expect(s.values.learningScope).toBe(defaults().learningScope);
    expect(s.healthy).toBe(false);
    expect(s.errors[0].key).toBe('learningScope');
  });

  it('settings from a NEWER version are refused, not reinterpreted', () => {
    // An old reader guessing at a new schema is how a save silently downgrades the user's config.
    fs.writeFileSync(file, JSON.stringify({ version: SETTINGS_VERSION + 5, settings: { autoApply: true } }));
    const s = loadSettings(file);
    expect(s.values.autoApply).toBe(false);
    expect(s.healthy).toBe(false);
    expect(s.errors[0].reason).toMatch(/newer version/);
  });

  it('an unreadable path is a normal empty state, not a crash', () => {
    const s = loadSettings(path.join(tmp, 'no', 'such', 'dir', 'settings.json'));
    expect(s.exists).toBe(false);
    expect(s.values).toEqual(defaults());
  });
});

describe('high — the write path is reversible', () => {
  it('the first save takes no backup and says reverting will remove the file', () => {
    const r = saveSettings({ autoApply: true }, { file });
    expect(r.backup).toBe(null);
    expect(r.existedBefore).toBe(false);
    expect(listBackups(file)).toEqual([]);
  });

  it('every subsequent save backs up the PREVIOUS contents first', () => {
    saveSettings({ advocacy: 'off' }, { file });
    const r = saveSettings({ advocacy: 'all' }, { file });

    expect(r.backup).toBeTruthy();
    expect(fs.existsSync(r.backup)).toBe(true);
    // The backup must hold the OLD value — a backup taken after the write protects nothing.
    expect(JSON.parse(fs.readFileSync(r.backup, 'utf8')).settings.advocacy).toBe('off');
    expect(loadSettings(file).values.advocacy).toBe('all');
  });

  it('backups accumulate and list newest last', () => {
    saveSettings({ advocacy: 'off' }, { file });
    saveSettings({ advocacy: 'important-only' }, { file });
    saveSettings({ advocacy: 'all' }, { file });
    const baks = listBackups(file);
    expect(baks.length).toBe(2);
    expect(JSON.parse(fs.readFileSync(baks[baks.length - 1], 'utf8')).settings.advocacy).toBe('important-only');
  });

  it('rapid consecutive saves each keep their own backup — no undo step is lost', () => {
    // REGRESSION. This started as a flaky assertion in the test above and turned out to be a real
    // defect: backup names are stamped to the millisecond, and saves genuinely land inside the same
    // millisecond, so one copyFileSync silently overwrote another and an undo step vanished with no
    // error. Measured before the fix: six saves, five backups. The loop is deliberately tight —
    // anything slower stops reproducing it.
    const N = 12;
    for (let i = 0; i < N; i++) saveSettings({ advocacy: i % 2 ? 'all' : 'off' }, { file });
    expect(listBackups(file).length).toBe(N - 1);          // every save but the first backs up
    expect(new Set(listBackups(file)).size).toBe(N - 1);   // and every name is distinct
  });

  it('same-millisecond backups still sort newest-last, so an unnamed revert picks the right one', () => {
    // The padding guard: unpadded suffixes would order "-10" before "-2" and revert would restore a
    // backup from the middle of the history rather than the most recent one.
    for (let i = 0; i < 12; i++) saveSettings({ advocacy: 'off' }, { file });
    saveSettings({ advocacy: 'all' }, { file });            // newest backup holds 'off'
    expect(revertSettings({ file }).ok).toBe(true);
    expect(loadSettings(file).values.advocacy).toBe('off');
  });

  it('revert restores the previous answers', () => {
    saveSettings({ learningScope: 'project', autoApply: false }, { file });
    const second = saveSettings({ learningScope: 'user', autoApply: true }, { file });
    expect(loadSettings(file).values.autoApply).toBe(true);

    const r = revertSettings({ file, backup: second.backup });
    expect(r.ok).toBe(true);
    expect(loadSettings(file).values).toEqual({ ...defaults(), learningScope: 'project', autoApply: false });
  });

  it('revert with no named backup restores the most recent one', () => {
    saveSettings({ advocacy: 'off' }, { file });
    saveSettings({ advocacy: 'all' }, { file });
    expect(revertSettings({ file }).ok).toBe(true);
    expect(loadSettings(file).values.advocacy).toBe('off');
  });

  it('reverting a FIRST save removes the file — back to genuinely having no settings', () => {
    // Restoring "defaults" as a written file would be a different state from never having configured
    // anything, and loadSettings reports those differently (exists: true vs false). Undo must return
    // the machine to where it was, not to something that merely looks equivalent.
    const r = saveSettings({ autoApply: true }, { file });
    const back = revertSettings({ file, backup: r.backup, existedBefore: r.existedBefore });
    expect(back.ok).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
    expect(loadSettings(file).exists).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('refuses to write when the backup cannot be taken', () => { // chmod write-blocking is a no-op on win32 (documented gap, ci.yml)
    // A save that cannot be undone is an overwrite. If we cannot secure the old value, the correct
    // answer is to keep it and say so — never to proceed and hope.
    saveSettings({ advocacy: 'off' }, { file });
    const roDir = path.join(tmp, 'ro');
    fs.mkdirSync(roDir);
    const roFile = path.join(roDir, 'settings.json');
    fs.copyFileSync(file, roFile);
    fs.chmodSync(roDir, 0o500);            // no new entries may be created in here
    try {
      const r = saveSettings({ advocacy: 'all' }, { file: roFile });
      expect(r.ok).toBe(false);
      expect(r.log).toMatch(/backup failed/);
      // The original is untouched.
      expect(loadSettings(roFile).values.advocacy).toBe('off');
    } finally {
      fs.chmodSync(roDir, 0o700);          // always restore, or afterEach cannot clean up
    }
  });

  it('an invalid value in a save falls back to the STORED answer, not the shipped default', () => {
    // A bad click must not reset a setting the user deliberately changed earlier.
    saveSettings({ advocacy: 'all' }, { file });
    const r = saveSettings({ advocacy: 'nonsense' }, { file });
    expect(r.ok).toBe(true);              // written, with the offending key reported
    expect(r.errors.some((e) => e.key === 'advocacy')).toBe(true);
    expect(loadSettings(file).values.advocacy).toBe('all');
  });

  it('a save that follows a corrupt file still produces a readable file', () => {
    fs.writeFileSync(file, 'not json at all');
    const r = saveSettings({ autoApply: true }, { file });
    expect(r.ok).toBe(true);
    expect(fs.existsSync(r.backup)).toBe(true);           // the corrupt bytes are kept, not discarded
    const back = loadSettings(file);
    expect(back.healthy).toBe(true);
    expect(back.values.autoApply).toBe(true);
  });
});

describe('qualitative — every setting explains its own downside', () => {
  // Structure only. Whether the sentences are actually clear is a human judgement and is not claimed
  // here; what IS enforced is that no setting can ship without someone having written down what
  // turning it up costs. A settings page listing only benefits makes the safe choice look timid.
  it('help is one plain sentence — a short label, not a paragraph', () => {
    for (const s of SETTINGS_SCHEMA) {
      expect(s.help.length, `${s.key}.help too short`).toBeGreaterThan(30);
      expect(s.help.length, `${s.key}.help is a paragraph, not a sentence`).toBeLessThan(220);
    }
  });

  it('whyItMatters states a real tradeoff, at length', () => {
    for (const s of SETTINGS_SCHEMA) {
      expect(s.whyItMatters.length, `${s.key}.whyItMatters`).toBeGreaterThan(80);
    }
  });

  it('downside names a specific cost and is not a restatement of the benefit', () => {
    for (const s of SETTINGS_SCHEMA) {
      expect(s.downside.length, `${s.key}.downside`).toBeGreaterThan(60);
      expect(s.downside, `${s.key}.downside must differ from whyItMatters`).not.toBe(s.whyItMatters);
    }
  });

  // "The product can never lie" (F: fabricated/undelivered behavior on a user-facing surface). The
  // advocacy field's copy once claimed 'all' shows routine observations 'important-only' filters out
  // — but plugin/scripts/anticipate.sh, the only dial-governed emitter, never reads 'important-only'
  // or 'all' as distinct values; it only branches on off vs. on. This test fails the moment either
  // side of that drifts out of sync again: if the emitter starts differentiating the two levels for
  // real, this test breaks and says so, which is the signal to restore the richer copy honestly.
  it('advocacy copy does not claim a routine/important split the emitter does not implement', () => {
    const anticipatePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugin', 'scripts', 'anticipate.sh',
    );
    const src = fs.readFileSync(anticipatePath, 'utf8');

    // Ground truth: the emitter's only advocacy-level branch is the off-quit. If a future change adds
    // a real 'all'-specific or 'important-only'-specific branch, this assertion — not just the copy —
    // is what should be revisited.
    expect(src).toMatch(/ADVOCACY\s*===\s*'off'/);
    expect(src).not.toMatch(/ADVOCACY\s*===\s*'all'/);
    expect(src).not.toMatch(/ADVOCACY\s*===\s*'important-only'/);

    const advocacy = SETTINGS_SCHEMA.find((s) => s.key === 'advocacy');
    // The copy must say the two "on" levels behave the same today, not imply 'all' is noisier than
    // 'important-only' in practice — that filtering does not exist yet.
    expect(advocacy.downside.toLowerCase()).toMatch(/identical|behave the same|not (yet )?wired/);
    // And it must not undersell 'off', which genuinely does silence everything.
    expect(advocacy.downside.toLowerCase()).toMatch(/off.{0,40}(nothing|invisible|silent)/s);
  });

  it('no setting is sold — none of the copy tells the user what to pick', () => {
    // The owner's constraint: "doesn't shove suggestions down people's throats". Recommendation
    // language in a settings model turns a choice into a nudge, and a nudge into the default.
    const pushy = /\b(recommended|you should|best option|we suggest|leave this on|turn this on)\b/i;
    for (const s of SETTINGS_SCHEMA) {
      for (const field of ['help', 'whyItMatters', 'downside']) {
        expect(s[field], `${s.key}.${field} reads as a recommendation`).not.toMatch(pushy);
      }
    }
  });

  it('no version literal is embedded in the copy', () => {
    // House rule 4 — a gate greps for X.Y.Z-dev literals. Settings help text outlives releases.
    for (const s of SETTINGS_SCHEMA) {
      for (const field of ['label', 'help', 'whyItMatters', 'downside']) {
        expect(s[field], `${s.key}.${field}`).not.toMatch(/\d+\.\d+\.\d+/);
      }
    }
  });
});
