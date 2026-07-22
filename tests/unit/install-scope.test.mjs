// install-scope.test.mjs — the per-user / per-project choice, and the promises attached to it.
//
// WHAT THIS PROTECTS, in the order the failures actually hurt.
//
// 1. THE COPY IS THE PRODUCT. Almost nobody reads the source; everybody reads the sentence. So the
//    qualitative class asserts that every difference between the scopes carries a `verifiedFrom`
//    citation — the structural version of "do not invent differences". An unciteable claim cannot be
//    added to SCOPES without turning this suite red, which is a cheaper reviewer than a person.
//
// 2. 'unknown' MUST NEVER RENDER AS 'off'. An unreadable registry reported as "not installed" sends
//    someone to install a second copy over a working one, and the surface that lied looks healthy
//    while doing it. There is a dedicated test for the corrupt-registry path because that is the
//    branch a refactor silently collapses.
//
// 3. THE WRITE PATH KEEPS ITS WORD. Backup before write, merge never clobber, revert is a true undo,
//    and applying twice is not an error. The clobber test uses a fixture shaped like this repo's OWN
//    .claude/settings.json — a hook and an unrelated env var — because that is the real file this
//    code will meet, and losing a user's PreToolUse hook to a scope change would be indefensible.
//
// The five classes ADR-028 requires:
//   low         — schema shape, pure, no I/O
//   medium      — real filesystem round trip in a temp project
//   high        — backup / merge / revert / idempotence: the destructive edges
//   numeric     — derived figures are derived, and absent facts stay absent
//   qualitative — the copy names real consequences in the owner's language

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCOPES, RECOMMENDED, SHARED_EITHER_WAY, OWNED_ENV_KEYS, PLUGIN_ID, PROJECT_STATE_DIR,
  getScope, detectCurrentScope, applyScope, revertScope, explainChoice,
  projectSettingsPath, readProjectEnvOverrides, measureCorpus, formatBytes, countKnownProjects,
} from '../../scripts/install-scope.mjs';

let tmp, projectDir, registry, claudeJson;
beforeEach(() => {
  // realpathSync because macOS hands back /var/… symlinked to /private/var/…, and detectCurrentScope
  // compares resolved projectPaths — without this the "records for a DIFFERENT project" test passes
  // for the wrong reason.
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'install-scope-')));
  projectDir = path.join(tmp, 'my-project');
  fs.mkdirSync(projectDir, { recursive: true });
  registry = path.join(tmp, 'installed_plugins.json');
  claudeJson = path.join(tmp, 'claude.json');
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const writeRegistry = (records) => fs.writeFileSync(registry, JSON.stringify({ version: 2, plugins: { [PLUGIN_ID]: records } }, null, 2));
const detect = (over = {}) => detectCurrentScope({ projectDir, registry, claudeJson, ...over });
const settings = () => JSON.parse(fs.readFileSync(projectSettingsPath(projectDir), 'utf8'));

// ── low ──────────────────────────────────────────────────────────────────────────────────────────

describe('low — the two options are well-formed', () => {
  it('offers exactly per-user and per-project', () => {
    expect(SCOPES.map((s) => s.id)).toEqual(['user', 'project']);
  });

  it('recommends per-user, and exactly one option is marked recommended', () => {
    expect(RECOMMENDED).toBe('user');
    expect(SCOPES.filter((s) => s.recommended).map((s) => s.id)).toEqual(['user']);
  });

  it.each(SCOPES.map((s) => [s.id, s]))('%s carries every field a chooser needs', (_id, s) => {
    for (const field of ['id', 'label', 'oneLine', 'summary', 'whyItMatters', 'downside', 'bestFor', 'claudeScope', 'installCommand']) {
      expect(typeof s[field], `${s.id}.${field}`).toBe('string');
      expect(s[field].length, `${s.id}.${field} is empty`).toBeGreaterThan(0);
    }
    expect(Array.isArray(s.differences)).toBe(true);
    expect(s.differences.length).toBeGreaterThan(0);
  });

  it('the isolated option uses Claude Code "local", never "project" — it must not land in the user\'s git repo', () => {
    // --scope project writes a file the user COMMITS, imposing the choice on everyone who clones.
    // "Isolated" cannot mean "silently installed on my colleagues' machines".
    expect(getScope('project').claudeScope).toBe('local');
    expect(getScope('user').claudeScope).toBe('user');
  });

  it('getScope returns undefined for an unknown id rather than throwing', () => {
    expect(getScope('nonsense')).toBeUndefined();
    expect(getScope(undefined)).toBeUndefined();
  });

  it('SCOPES is frozen so a caller cannot mutate the shipped copy', () => {
    expect(Object.isFrozen(SCOPES)).toBe(true);
    expect(Object.isFrozen(SCOPES[0].differences)).toBe(true);
  });
});

// ── medium ───────────────────────────────────────────────────────────────────────────────────────

describe('medium — detecting a machine that is already scoped one way', () => {
  it('a user-scope record reads as per-user', () => {
    writeRegistry([{ scope: 'user', installPath: '/x', version: '0.0.0-test' }]);
    const d = detect();
    expect(d.scope).toBe('user');
    expect(d.confident).toBe(true);
  });

  it('a local record for THIS project reads as per-project', () => {
    writeRegistry([{ scope: 'local', projectPath: projectDir, installPath: '/x' }]);
    expect(detect().scope).toBe('project');
  });

  it('a local record for a DIFFERENT project does not count as installed here', () => {
    // Otherwise the detector tells someone their setup is fine in a directory it is not present in.
    writeRegistry([{ scope: 'local', projectPath: path.join(tmp, 'someone-elses-repo'), installPath: '/x' }]);
    expect(detect().scope).toBe('none');
  });

  it('records at BOTH scopes report "both" — a real state, not a hypothetical one', () => {
    // Verified on the author's machine: clangd-lsp and skill-creator are each recorded at both
    // project and user scope. installed_plugins.json stores an ARRAY precisely because this is legal.
    // A detector that returned the first record would have been quietly wrong.
    writeRegistry([{ scope: 'user', installPath: '/x' }, { scope: 'local', projectPath: projectDir, installPath: '/y' }]);
    const d = detect();
    expect(d.scope).toBe('both');
    expect(d.summary).toMatch(/both/i);
  });

  it('a readable registry without our plugin reads as "none", confidently', () => {
    fs.writeFileSync(registry, JSON.stringify({ version: 2, plugins: { 'someone-else@market': [{ scope: 'user' }] } }));
    const d = detect();
    expect(d.scope).toBe('none');
    expect(d.confident).toBe(true);
  });

  it('project env overrides alone are enough to read as per-project', () => {
    // Someone may have wired the env by hand without a local plugin record. That is still a
    // deliberately project-scoped setup and must not be reported as "not installed".
    fs.writeFileSync(registry, JSON.stringify({ version: 2, plugins: {} }));
    fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
    fs.writeFileSync(projectSettingsPath(projectDir), JSON.stringify({ env: { RUVNET_LESSON_STORE: '/somewhere/lessons.json' } }));
    expect(detect().scope).toBe('project');
  });

  it('every detection returns evidence pointing at a real path, not a bare verdict', () => {
    writeRegistry([{ scope: 'user', installPath: '/x' }]);
    const d = detect();
    expect(d.evidence.length).toBeGreaterThan(0);
    for (const e of d.evidence) {
      expect(typeof e.source).toBe('string');
      expect(typeof e.detail).toBe('string');
    }
  });
});

describe('medium — an unreadable registry is "unknown", never "none"', () => {
  it('a missing registry reports unknown and not-confident', () => {
    const d = detect();               // no registry file written at all
    expect(d.scope).toBe('unknown');
    expect(d.confident).toBe(false);
  });

  it('a corrupt registry reports unknown — NOT "not installed"', () => {
    // The whole point. "We could not read it" and "it is not there" are different facts, and
    // collapsing them sends a user to install a second copy over a working one.
    fs.writeFileSync(registry, '{ this is not json');
    const d = detect();
    expect(d.scope).toBe('unknown');
    expect(d.confident).toBe(false);
    expect(d.scope).not.toBe('none');
  });

  it('a registry with an unrecognised shape is unknown, not none', () => {
    fs.writeFileSync(registry, JSON.stringify({ version: 99 }));   // no `plugins` key
    expect(detect().scope).toBe('unknown');
  });

  it('the explanation for an unknown machine offers no verdict and claims no action', () => {
    fs.writeFileSync(registry, 'garbage');
    const text = explainChoice({ projectDir, detected: detect() });
    expect(text).toMatch(/could not read/i);
    expect(text).toMatch(/nothing has been assumed|nothing will be changed/i);
    // must not state a scope it does not know
    expect(text).not.toMatch(/Right now: not installed/i);
  });
});

// ── high — the write path ────────────────────────────────────────────────────────────────────────

describe('high — applyScope defaults, writes and reverses', () => {
  it('per-project writes both owned env keys into the project settings file', () => {
    const r = applyScope('project', { projectDir });
    expect(r.ok).toBe(true);
    const env = settings().env;
    for (const k of OWNED_ENV_KEYS) {
      expect(env[k]).toContain(PROJECT_STATE_DIR);
      expect(path.isAbsolute(env[k])).toBe(true);
    }
  });

  it('per-user REMOVES the overrides rather than pinning today\'s global path', () => {
    // Absence is the setting. Writing the current global path in explicitly would pin the project to
    // a location that may move, and quietly break it when it does.
    applyScope('project', { projectDir });
    const r = applyScope('user', { projectDir });
    expect(r.ok).toBe(true);
    const after = settings();
    for (const k of OWNED_ENV_KEYS) expect(after.env?.[k]).toBeUndefined();
    expect(readProjectEnvOverrides(projectDir).present).toEqual([]);
  });

  it('MERGES — an unrelated hook and env var survive a scope change untouched', () => {
    // Shaped like this repo's own .claude/settings.json, which is the real file this code will meet.
    const original = {
      _note: 'do not lose me',
      env: { RUFLO_HARNESS_LOOP: '1' },
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/bin/bash version-bump-gate.sh', timeout: 5 }] }] },
    };
    fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
    fs.writeFileSync(projectSettingsPath(projectDir), JSON.stringify(original, null, 2));

    applyScope('project', { projectDir });
    const after = settings();
    expect(after._note).toBe('do not lose me');
    expect(after.env.RUFLO_HARNESS_LOOP).toBe('1');
    expect(after.hooks).toEqual(original.hooks);

    // and back again — the unrelated keys still survive the reverse direction
    applyScope('user', { projectDir });
    const back = settings();
    expect(back.env.RUFLO_HARNESS_LOOP).toBe('1');
    expect(back.hooks).toEqual(original.hooks);
  });

  it('backs up before overwriting, and the backup holds the ORIGINAL bytes', () => {
    fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
    const before = JSON.stringify({ env: { KEEP: 'yes' } }, null, 2);
    fs.writeFileSync(projectSettingsPath(projectDir), before);

    const r = applyScope('project', { projectDir });
    expect(r.backup).toBeTruthy();
    expect(fs.readFileSync(r.backup, 'utf8')).toBe(before);
  });

  it('IDEMPOTENT — applying the same scope twice changes nothing and takes no second backup', () => {
    const first = applyScope('project', { projectDir });
    expect(first.changed.length).toBeGreaterThan(0);

    const second = applyScope('project', { projectDir });
    expect(second.ok).toBe(true);
    expect(second.changed).toEqual([]);
    expect(second.backup).toBeNull();
    expect(second.log).toMatch(/already/i);

    // no litter: exactly the settings file, no stray identical backups from the second call
    const baks = fs.readdirSync(path.join(projectDir, '.claude')).filter((n) => n.includes('.bak-'));
    expect(baks.length).toBeLessThanOrEqual(1);
  });

  it('REVERSIBLE — revert restores the exact prior bytes', () => {
    fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
    const before = JSON.stringify({ env: { KEEP: 'yes' }, hooks: {} }, null, 2);
    fs.writeFileSync(projectSettingsPath(projectDir), before);

    const r = applyScope('project', { projectDir });
    expect(fs.readFileSync(projectSettingsPath(projectDir), 'utf8')).not.toBe(before);

    const undo = revertScope(r);
    expect(undo.ok).toBe(true);
    expect(fs.readFileSync(projectSettingsPath(projectDir), 'utf8')).toBe(before);
  });

  it('REVERSIBLE — reverting a first-ever write REMOVES the file rather than leaving a synthesised one', () => {
    expect(fs.existsSync(projectSettingsPath(projectDir))).toBe(false);
    const r = applyScope('project', { projectDir });
    expect(r.existedBefore).toBe(false);
    expect(r.backup).toBeNull();

    const undo = revertScope(r);
    expect(undo.ok).toBe(true);
    expect(fs.existsSync(projectSettingsPath(projectDir))).toBe(false);
  });

  it('REFUSES to rewrite a settings file it cannot parse — that file may hold the user\'s hooks', () => {
    fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
    fs.writeFileSync(projectSettingsPath(projectDir), '{ half-written');
    const r = applyScope('project', { projectDir });
    expect(r.ok).toBe(false);
    expect(r.changed).toEqual([]);
    expect(r.log).toMatch(/not valid JSON/i);
    expect(fs.readFileSync(projectSettingsPath(projectDir), 'utf8')).toBe('{ half-written');
  });

  it('an unknown scope id is refused without touching anything', () => {
    const r = applyScope('per-machine', { projectDir });
    expect(r.ok).toBe(false);
    expect(r.log).toMatch(/not a scope/i);
    expect(fs.existsSync(projectSettingsPath(projectDir))).toBe(false);
  });

  it('dryRun computes the change and writes NOTHING', () => {
    const r = applyScope('project', { projectDir, dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.changed.length).toBeGreaterThan(0);
    expect(fs.existsSync(projectSettingsPath(projectDir))).toBe(false);
  });

  it('the receipt names exactly what changed — derived from before/after, not narrated', () => {
    const r = applyScope('project', { projectDir });
    expect(r.changed.map((c) => c.key).sort()).toEqual([...OWNED_ENV_KEYS].sort());
    for (const c of r.changed) {
      expect(c.from).toBeNull();          // nothing was set before
      expect(typeof c.to).toBe('string');
      expect(r.log).toContain(c.key);     // and the printed log actually mentions it
    }
  });

  it('does not shell out to `claude` — unreversible work is handed to the user as a printed step', () => {
    const r = applyScope('project', { projectDir });
    expect(Array.isArray(r.manualSteps)).toBe(true);
    expect(r.manualSteps[0].run).toBe(getScope('project').installCommand);
  });
});

// ── numeric ──────────────────────────────────────────────────────────────────────────────────────

describe('numeric — every figure is derived, and an absent fact stays absent', () => {
  it('countKnownProjects returns null (not 0) when the file cannot be read', () => {
    // 0 would render as "you have no projects", which is a claim. null renders as nothing.
    expect(countKnownProjects(path.join(tmp, 'nope.json'))).toBeNull();
    fs.writeFileSync(claudeJson, 'not json');
    expect(countKnownProjects(claudeJson)).toBeNull();
  });

  it('countKnownProjects counts real entries', () => {
    fs.writeFileSync(claudeJson, JSON.stringify({ projects: { '/a': {}, '/b': {}, '/c': {} } }));
    expect(countKnownProjects(claudeJson)).toBe(3);
  });

  it('measureCorpus distinguishes ABSENT from empty', () => {
    const missing = measureCorpus(path.join(tmp, 'no-corpus'));
    expect(missing.exists).toBe(false);
    expect(missing.bytes).toBeNull();          // not 0 — absent is not empty

    const empty = path.join(tmp, 'empty-corpus');
    fs.mkdirSync(empty);
    const e = measureCorpus(empty);
    expect(e.exists).toBe(true);
    expect(e.bytes).toBe(0);
  });

  it('measureCorpus sums real bytes and reports completeness', () => {
    const dir = path.join(tmp, 'corpus');
    fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.bin'), Buffer.alloc(1000));
    fs.writeFileSync(path.join(dir, 'nested', 'b.bin'), Buffer.alloc(24));
    const m = measureCorpus(dir);
    expect(m.bytes).toBe(1024);
    expect(m.complete).toBe(true);
  });

  it('formatBytes returns null for a non-number so callers omit rather than print "0 B"', () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(undefined)).toBeNull();
    expect(formatBytes(NaN)).toBeNull();
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(0)).toBe('0 B');
  });

  it('explainChoice OMITS the machine figures entirely when they are unknown — never a placeholder', () => {
    const text = explainChoice({
      projectDir,
      detected: detect(),
      facts: { projects: null, corpus: { exists: false, bytes: null, complete: false } },
    });
    expect(text).not.toMatch(/On this machine:/);
    expect(text).not.toMatch(/\bnull\b|\bundefined\b|\bNaN\b/);
    expect(text).not.toMatch(/0 project|unknown GB/i);
  });

  it('explainChoice prints the figures when they ARE known, and hedges an incomplete measurement', () => {
    const text = explainChoice({
      projectDir,
      detected: detect(),
      facts: { projects: 76, corpus: { exists: true, bytes: 2_684_354_560, complete: false } },
    });
    expect(text).toMatch(/76 projects/);
    expect(text).toMatch(/at least 2\.5 GB/);   // hedged, because the walk was cut short
  });
});

// ── qualitative ──────────────────────────────────────────────────────────────────────────────────

describe('qualitative — the copy names real consequences, in the owner\'s language', () => {
  it('every claimed difference cites where it was verified — no invented differences', () => {
    // The structural form of "do not claim what you cannot verify". Adding an unciteable difference
    // to SCOPES fails here rather than shipping as confident-sounding fiction.
    for (const s of SCOPES) {
      for (const d of s.differences) {
        expect(typeof d.component, `${s.id} difference missing component`).toBe('string');
        expect(typeof d.consequence, `${s.id} difference missing consequence`).toBe('string');
        expect(d.verifiedFrom, `${s.id}/${d.component} has no citation`).toBeTruthy();
        expect(d.verifiedFrom.length).toBeGreaterThan(8);
      }
    }
  });

  it('both scopes name the four components a user actually asks about', () => {
    // "What ARE the pieces, and what do I lose?" — the question nobody could answer.
    for (const s of SCOPES) {
      const joined = s.differences.map((d) => d.component).join(' ').toLowerCase();
      expect(joined, `${s.id} never mentions the plugin`).toMatch(/plugin/);
      expect(joined, `${s.id} never mentions learning`).toMatch(/learn/);
      expect(joined, `${s.id} never mentions settings`).toMatch(/setting/);
      expect(joined, `${s.id} never mentions updates`).toMatch(/update/);
    }
  });

  it('the per-user copy uses the owner\'s own reasons: learning, intelligence, access, versions, all projects', () => {
    const s = getScope('user');
    const blob = `${s.summary} ${s.whyItMatters}`.toLowerCase();
    for (const word of ['learning', 'intelligence', 'access', 'software versions', 'all your projects']) {
      expect(blob, `per-user copy is missing "${word}"`).toContain(word);
    }
  });

  it('the user is named as the arbiter, and the recommendation is stated as a recommendation', () => {
    const s = getScope('user');
    expect(s.summary).toMatch(/arbiter/i);
    expect(s.summary).toMatch(/strong recommendation/i);
    // A nudge, not a gate: no coercive framing.
    expect(`${s.summary} ${s.whyItMatters}`).not.toMatch(/you must|required|not permitted|you have to/i);
  });

  it('the per-project copy says "only choose per-project if" rather than discouraging it', () => {
    const s = getScope('project');
    expect(s.summary).toMatch(/only choose per-project if/i);
    // supportive of how people like to work — never disparaging the narrow choice
    expect(s.whyItMatters).toMatch(/nothing is written outside|stays here/i);
  });

  it('EVERY option states its own downside — including the recommended one', () => {
    // A page that lists only benefits is a sales page, and it makes the cautious choice feel timid.
    for (const s of SCOPES) {
      expect(s.downside.length, `${s.id} downside too thin`).toBeGreaterThan(60);
    }
    // the recommended option must admit the specific cost people care about: cross-project bleed
    expect(getScope('user').downside).toMatch(/client|another|separation/i);
    // and the narrow one must admit it does not compound
    expect(getScope('project').downside).toMatch(/compound|again|per repo/i);
  });

  it('names what does NOT change either way — the answer to "what do I lose?"', () => {
    expect(SHARED_EITHER_WAY.length).toBeGreaterThan(0);
    const blob = SHARED_EITHER_WAY.map((u) => `${u.what} ${u.detail}`).join(' ').toLowerCase();
    expect(blob).toMatch(/corpus|knowledge/);
    expect(blob).toMatch(/not.*duplicat|identical|same/);
  });

  it('the corpus is NOT claimed as a difference — it is shared either way, so claiming it would be false', () => {
    // Verified: ~/.cache/ruvnet-brain/kb holds public RuvNet source (ruvector, agentdb, cognitum),
    // not the user's code. Isolating it per project costs gigabytes and buys nothing. RUVNET_BRAIN_KB
    // is therefore deliberately NOT an owned key, and this test is what keeps it that way.
    expect(OWNED_ENV_KEYS).not.toContain('RUVNET_BRAIN_KB');
    for (const s of SCOPES) {
      for (const d of s.differences) {
        expect(d.consequence, `${s.id} claims the corpus differs by scope`).not.toMatch(/corpus/i);
      }
    }
  });

  it('explainChoice reads as one coherent page: both options, the recommendation, and reversibility', () => {
    writeRegistry([{ scope: 'user', installPath: '/x' }]);
    const text = explainChoice({ projectDir, detected: detect() });
    for (const s of SCOPES) expect(text).toContain(s.oneLine);
    expect(text).toMatch(/arbiter/i);
    expect(text).toMatch(/revers/i);
    expect(text).toMatch(/backed up/i);
    expect(text).toMatch(/this is what you have now/i);   // orients the reader in their own machine
  });
});
