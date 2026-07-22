// install-scope.mjs — per-user or per-project, asked once, in the user's own words.
//
// THE ONE IDEA. A power user told the owner: "I can't use your stuff because it has hooks and this
// and that. I just loaded the brain into my RuVector Brain and I don't get the rest of it." He was
// not complaining about the software. He was saying he could not SEE it — what the pieces are, which
// ones he had, and what taking only one of them cost him. Nobody could answer that, including us.
//
// So this module's job is not to install anything. It is to make one murky decision legible enough
// that a person can make it in ten seconds and be right. Everything here is therefore either (a)
// copy that names a real consequence, or (b) a function that DERIVES state from disk instead of
// assuming it.
//
// WHY THIS IS A NUDGE AND NOT A GATE — the correction that produced this file (owner, 2026-07-22):
//
//     "Nudging somebody is very fair. Forcing them through a gate is not. More advanced people have
//      different ways they implement it, and we need to be supportive of how they like to work.
//      That respect for the individual and how they do it is a big part of the win."
//
// This lands on the same day two reviewers proved `enforcement: block` never blocked anything —
// lesson-gate.mjs exits 1 where the Claude Code contract requires 2, and every caller appends
// `|| true` anyway. The bug and the philosophy point the same direction, which is the useful part:
// we were never actually forcing, and we should stop pretending we wanted to. So there is no
// SCOPE_GATE in this file. There is a recommendation, stated plainly, with its downside attached,
// and a function that does what the user picked. `RECOMMENDED` is a const, not an enforcement.
//
// WHAT THIS FILE REFUSES TO DO. It does not run `claude plugin install`. Shelling out to a mutation
// we cannot back up and cannot undo would break the promise applyScope() makes three lines below its
// signature. What it cannot reverse, it PRINTS and hands to the user — see `manualSteps`. That
// asymmetry is deliberate and is the same one bin/install.mjs already lives by (its `manualInstall`
// fallback), not a new invention.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Reused, not reimplemented. These two were hardened against real, MEASURED failures — a
// copyFileSync that wedged a process at 100% CPU for 4m38s under concurrent saves, and a truncating
// in-place write that lost settings on a killed process. Writing a second, naive writer here would
// reintroduce both, in the one file whose whole subject is "we will not damage your machine".
import { withLock, writeAtomic } from './user-settings.mjs';

const HOME = os.homedir();

/**
 * The plugin's marketplace id, read back from a real install record rather than guessed:
 * `~/.claude/plugins/installed_plugins.json` → plugins["ruvnet-brain@ruvnet-brain"]. install.mjs:516
 * installs exactly this string. It is the KEY we look ourselves up under, so a typo here reads as
 * "not installed" — which is why it is one const and not four string literals.
 */
export const PLUGIN_ID = 'ruvnet-brain@ruvnet-brain';

/** Where Claude Code records what is installed and at which scope. Probed, not assumed — schema v2. */
export const INSTALLED_PLUGINS = path.join(HOME, '.claude', 'plugins', 'installed_plugins.json');

/** Claude Code's own config. Top-level `mcpServers` = user scope; `projects[dir].mcpServers` = local. */
export const CLAUDE_JSON = path.join(HOME, '.claude.json');

/** User-level state, deliberately outside the bundle `--update` replaces. See lesson-store.mjs:230. */
export const USER_LESSONS = path.join(HOME, '.config', 'ruvnet-brain', 'lessons.json');
export const USER_SETTINGS = path.join(HOME, '.config', 'ruvnet-brain', 'settings.json');

/** The shared reference corpus. install.mjs:296 — `~/.cache/ruvnet-brain/kb`, $RUVNET_BRAIN_KB wins. */
export const USER_CORPUS = path.join(HOME, '.cache', 'ruvnet-brain', 'kb');

/**
 * THE ENV KEYS THIS MODULE OWNS, and the exhaustive list of what applyScope may write.
 *
 * Each is a real override consumed by real code, cited so a future reader can check rather than
 * trust me: RUVNET_LESSON_STORE (lesson-store.mjs:233), RUVNET_SETTINGS_FILE (user-settings.mjs:55).
 *
 * RUVNET_BRAIN_KB is CONSPICUOUSLY ABSENT and that is a finding, not an oversight — see
 * SHARED_EITHER_WAY. Listing it here would let a well-meaning future edit isolate the corpus per
 * project and silently cost the user gigabytes for nothing.
 */
export const OWNED_ENV_KEYS = Object.freeze(['RUVNET_LESSON_STORE', 'RUVNET_SETTINGS_FILE']);

/** Where a project-scoped install keeps its own state. Sits beside .claude/, visible, greppable. */
export const PROJECT_STATE_DIR = '.ruvnet-brain';

/**
 * THE RECOMMENDATION, as a value rather than a rule.
 *
 * Named `RECOMMENDED` and not `DEFAULT_ENFORCED` on purpose. Callers are free to ignore it; the
 * console renders it as a highlighted option, never as a preselected radio the user must fight.
 */
export const RECOMMENDED = 'user';

// ── What is actually true of each choice ─────────────────────────────────────────────────────────

/**
 * WHAT DOES NOT CHANGE, and why this list exists at all.
 *
 * The user's real question is never "what are the two options" — it is "if I pick the small one,
 * what do I lose?". A page that lists only differences implies everything is a difference, which is
 * how a reversible ten-second choice starts feeling like a commitment. Naming the things that are
 * identical either way is what makes the choice cheap.
 *
 * Each entry below was checked, not assumed. The corpus one is the load-bearing finding: `ls
 * ~/.cache/ruvnet-brain/kb` is ruvector / agentdb / cognitum passages and .rvf indexes — PUBLIC
 * RuvNet ecosystem source, not your code. Nothing about it is per-project, so isolating it would
 * duplicate the measured size (see measureCorpus) per repo to obtain nothing. It stays shared under
 * both choices, and that is a deliberate decision rather than a gap.
 */
export const SHARED_EITHER_WAY = Object.freeze([
  Object.freeze({
    what: 'The knowledge itself',
    detail: 'The corpus is public RuvNet source — ruvector, agentdb, cognitum and the rest of the ecosystem — not your project\'s code. It is reference material, identical for every project, so both choices read the same shared copy. Isolating it per project would duplicate it on disk and change nothing about the answers.',
    where: USER_CORPUS,
  }),
  Object.freeze({
    what: 'Answer quality',
    detail: 'Search results are the same either way. Scope decides where what it LEARNS is written, never how well it retrieves.',
    where: USER_CORPUS,
  }),
  Object.freeze({
    what: 'Your ability to change your mind',
    detail: 'Both directions are one command and are backed up before anything is written. Nothing here is a one-way door.',
    where: null,
  }),
]);

/**
 * THE TWO OPTIONS.
 *
 * `differences` are REAL and each carries `verifiedFrom` — the file and line that makes it true. The
 * brief for this module said plainly: do not invent differences, and if one cannot be verified, do
 * not claim it. That is enforced by structure, not by good intentions: the qualitative test asserts
 * every difference carries a citation, so an unciteable claim cannot be added without going red.
 *
 * Copy follows the owner's own words closely (2026-07-22), because his phrasing already does the two
 * things the previous version failed at — it recommends without cornering, and it says out loud who
 * decides. Paraphrasing it into product-voice lost both.
 */
export const SCOPES = Object.freeze([
  Object.freeze({
    id: 'user',
    label: 'Per-user  (recommended)',
    oneLine: 'One install, every project you work on.',
    recommended: true,

    // The owner's sentence, near-verbatim. It survives review every time someone tries to tighten it
    // because the clause people want to cut — "we always want YOU to be the arbiter" — is the clause
    // doing the work.
    summary:
      'Normally this happens on a per-user basis, which lets learning, intelligence, access and '
      + 'software versions stay updated universally across all your projects. Our strong recommendation '
      + 'is per-user — but we always want you to be the arbiter of how things run on your machine.',

    whyItMatters:
      'A correction you make once is never repeated anywhere. One update moves every project forward '
      + 'at the same time, so you are never wondering which repo has the current version. This is the '
      + 'setting where the thing compounds.',

    // Required field, and the reason this schema exists rather than a pair of marketing paragraphs.
    // A page listing only benefits is a sales page: it makes the cautious choice feel timid, which is
    // precisely the pressure the owner asked us to take off the user.
    downside:
      'What it learns while you work on one client\'s repo can surface while you are working on '
      + 'another\'s. If you need hard separation between two bodies of work on the same machine, that '
      + 'is the real argument for per-project, and it is a good one.',

    bestFor: 'Almost everyone — including anyone who has not thought about it yet and wants to stop thinking about it.',

    claudeScope: 'user',
    installCommand: 'claude plugin install ruvnet-brain@ruvnet-brain --scope user',

    differences: Object.freeze([
      Object.freeze({
        component: 'Plugin (hooks, skills, commands, search_ruvnet)',
        consequence: 'Loads in every project you open, with no per-repo setup.',
        verifiedFrom: 'installed_plugins.json record scope:"user"; bin/install.mjs:516',
      }),
      Object.freeze({
        component: 'What it learns',
        consequence: `One lesson store at ${USER_LESSONS.replace(HOME, '~')} — a mistake corrected in any project is known in all of them.`,
        verifiedFrom: 'scripts/lesson-store.mjs:233',
      }),
      Object.freeze({
        component: 'Your settings',
        consequence: `One file at ${USER_SETTINGS.replace(HOME, '~')} — answer the questions once.`,
        verifiedFrom: 'scripts/user-settings.mjs:55',
      }),
      Object.freeze({
        component: 'Updates',
        consequence: 'One update covers every project. No repo is left on an old version because you forgot it existed.',
        verifiedFrom: 'bin/install.mjs --update replaces the shared cache dir',
      }),
    ]),
  }),

  Object.freeze({
    id: 'project',
    label: 'Per-project  (isolated)',
    oneLine: 'This one directory only. Nothing outside it changes.',
    recommended: false,

    summary:
      'Only choose per-project if this is something you absolutely only use on a per-project basis. '
      + 'It is the right answer when a repo genuinely needs to stand alone — but it is the narrower '
      + 'setting, and you will be doing some of this again the next time.',

    whyItMatters:
      'Nothing is written outside this directory. What it learns here stays here, which is what you '
      + 'want when a codebase is under an agreement that says so, or when you are simply trying it out '
      + 'and want a clean line around the experiment.',

    downside:
      'It does not compound. The same correction has to be made again in your next project, updates '
      + 'have to be run per repo, and it is easy to end up with one directory quietly running an old '
      + 'version. This is the cost, and it is a real one.',

    bestFor: 'A repo that must not share context with your other work, or a first cautious trial.',

    // WHY "local" AND NOT "project". Verified live: `claude plugin install -s <scope>` and `claude mcp
    // add -s <scope>` both accept user | project | local. They are not synonyms, and picking the
    // wrong one would be a mutation the user did not consent to:
    //
    //   local   → recorded in ~/.claude.json under this directory. Private to you.
    //   project → written into a file inside the repo, which the user then COMMITS, imposing this
    //             choice on every teammate who clones it.
    //
    // "Isolated" must not mean "silently added to your colleagues' machines via git". So the
    // user-facing id is `project` (their word for it) and the Claude Code scope is `local` (the one
    // that actually keeps it to them). Anyone genuinely wanting the committed, team-wide variant can
    // pass --scope project by hand, having decided that on purpose.
    claudeScope: 'local',
    installCommand: 'claude plugin install ruvnet-brain@ruvnet-brain --scope local',

    differences: Object.freeze([
      Object.freeze({
        component: 'Plugin (hooks, skills, commands, search_ruvnet)',
        consequence: 'Loads only in this directory. Your other projects are untouched and see nothing.',
        verifiedFrom: 'installed_plugins.json records scope:"local" with projectPath',
      }),
      Object.freeze({
        component: 'What it learns',
        consequence: `Kept in ${PROJECT_STATE_DIR}/lessons.json inside this repo. Nothing learned here reaches your other work — and nothing learned elsewhere helps you here.`,
        verifiedFrom: 'RUVNET_LESSON_STORE override, scripts/lesson-store.mjs:233',
      }),
      Object.freeze({
        component: 'Your settings',
        consequence: `Kept in ${PROJECT_STATE_DIR}/settings.json inside this repo, set per project.`,
        verifiedFrom: 'RUVNET_SETTINGS_FILE override, scripts/user-settings.mjs:55',
      }),
      Object.freeze({
        component: 'Updates',
        consequence: 'Run per project. Each repo moves on its own schedule, which also means each repo can be forgotten on its own schedule.',
        verifiedFrom: 'bin/install.mjs --update operates on the invoking install',
      }),
    ]),
  }),
]);

const BY_ID = new Map(SCOPES.map((s) => [s.id, s]));

/** Look up one option. Returns undefined rather than throwing — callers render, they do not crash. */
export function getScope(id) { return BY_ID.get(id); }

// ── Reading the machine as it actually is ────────────────────────────────────────────────────────

/**
 * Measure the shared corpus, with a time budget and an honest `complete` flag.
 *
 * The measured tree is ~868 entries and multi-gigabyte; a full walk is not free, and a settings page
 * that stalls for two seconds to print a number is a worse product than one that prints nothing. So
 * the walk stops at `budgetMs` and SAYS it stopped — `{ bytes, complete: false }` renders as "at
 * least 2.4 GB", never as a precise-looking lie.
 *
 * Returns `{ bytes: null, complete: false, exists: false }` when there is no corpus. That is a
 * distinct state from "zero bytes" and callers must not collapse them: absent ≠ empty.
 */
export function measureCorpus(dir = process.env.RUVNET_BRAIN_KB || USER_CORPUS, { budgetMs = 250 } = {}) {
  if (!fs.existsSync(dir)) return { path: dir, exists: false, bytes: null, complete: false };
  const deadline = Date.now() + budgetMs;
  let bytes = 0;
  let complete = true;
  const stack = [dir];
  while (stack.length) {
    if (Date.now() > deadline) { complete = false; break; }
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) { try { bytes += fs.statSync(p).size; } catch { /* vanished mid-walk */ } }
    }
  }
  return { path: dir, exists: true, bytes, complete };
}

/** Human bytes. Returns null for null so a caller can omit the number rather than print "0 B". */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** How many projects Claude Code has seen. The honest denominator for "across all your projects". */
export function countKnownProjects(file = CLAUDE_JSON) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    return j && typeof j.projects === 'object' && j.projects ? Object.keys(j.projects).length : null;
  } catch { return null; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/**
 * DETECT — what is on this machine right now, as evidence rather than as a verdict.
 *
 * `scope` is one of: 'user' | 'project' | 'both' | 'none' | 'unknown', and the last two are
 * DIFFERENT AND MUST STAY DIFFERENT.
 *
 *   none    — we read the registry successfully and this plugin is genuinely not in it.
 *   unknown — we could not read the registry (absent, unreadable, corrupt, schema we don't know).
 *
 * Collapsing `unknown` into `none` is the exact class of bug this repo has a standing order about:
 * an unreadable file would render as a confident "not installed", the user would install a second
 * copy over a working one, and the surface that lied would look like it was working. Hence the
 * separate `confident` flag, and hence the test that asserts an unreadable registry never reports
 * 'none'.
 *
 * 'both' is not hypothetical. On this machine, `clangd-lsp@claude-plugins-official` and
 * `skill-creator@claude-plugins-official` are each recorded at BOTH project and user scope —
 * installed_plugins.json stores an ARRAY per plugin precisely because that is a legal state. A
 * detector that returned the first record would have been quietly wrong for years.
 */
export function detectCurrentScope({
  projectDir = process.cwd(),
  registry = INSTALLED_PLUGINS,
  claudeJson = CLAUDE_JSON,
  pluginId = PLUGIN_ID,
} = {}) {
  const evidence = [];
  const reg = readJson(registry);

  if (reg === null || typeof reg !== 'object' || typeof reg.plugins !== 'object' || !reg.plugins) {
    evidence.push({
      source: 'plugin registry',
      path: registry,
      found: false,
      detail: fs.existsSync(registry)
        ? 'the file is there but could not be read as the expected shape — not treating that as "not installed"'
        : 'no plugin registry on this machine yet',
    });
    return {
      scope: 'unknown',
      confident: false,
      projectDir,
      records: [],
      envOverrides: readProjectEnvOverrides(projectDir).present,
      evidence,
      summary: 'Could not read how this is installed. Nothing has been assumed — and nothing will be changed until you say so.',
    };
  }

  const records = Array.isArray(reg.plugins[pluginId]) ? reg.plugins[pluginId] : [];
  const atUser = records.some((r) => r && r.scope === 'user');

  // A local/project record only counts as THIS project's when its projectPath is this directory —
  // otherwise a plugin scoped to a different repo would read as "installed here", which is how a
  // detector starts telling people their setup is fine somewhere it is not present at all.
  const here = (r) => !r || !r.projectPath || path.resolve(r.projectPath) === path.resolve(projectDir);
  const atProject = records.some((r) => r && (r.scope === 'local' || r.scope === 'project') && here(r));

  for (const r of records) {
    evidence.push({
      source: 'plugin registry',
      path: registry,
      found: true,
      detail: `${pluginId} installed at scope "${r.scope}"${r.projectPath ? ` for ${r.projectPath}` : ''}${r.version ? ` (version ${r.version})` : ''}`,
    });
  }
  if (!records.length) {
    evidence.push({ source: 'plugin registry', path: registry, found: false, detail: `${pluginId} is not in the registry` });
  }

  const env = readProjectEnvOverrides(projectDir);
  if (env.present.length) {
    evidence.push({
      source: 'project settings',
      path: env.file,
      found: true,
      detail: `this project redirects ${env.present.join(' and ')} to its own directory`,
    });
  }

  const cj = readJson(claudeJson);
  if (cj && cj.projects && Object.hasOwn(cj.projects, path.resolve(projectDir))) {
    const local = cj.projects[path.resolve(projectDir)]?.mcpServers;
    if (local && Object.keys(local).length) {
      evidence.push({
        source: 'Claude Code local scope',
        path: claudeJson,
        found: true,
        detail: `${Object.keys(local).length} MCP server(s) registered to this directory only`,
      });
    }
  }

  let scope = 'none';
  if (atUser && atProject) scope = 'both';
  else if (atUser) scope = 'user';
  else if (atProject || env.present.length) scope = 'project';

  const summary = {
    user: 'Installed for you, across every project.',
    project: 'Installed for this project only.',
    both: 'Installed BOTH ways — for you globally AND pinned to this project. That is legal but usually accidental, and the project copy wins here.',
    none: 'Not installed yet.',
  }[scope];

  return { scope, confident: true, projectDir, records, envOverrides: env.present, evidence, summary };
}

/** The project-scoped Claude Code settings file — the same one this repo already uses for its own hook. */
export function projectSettingsPath(projectDir = process.cwd()) {
  return path.join(projectDir, '.claude', 'settings.json');
}

/** Which of OUR env keys this project currently overrides. Derived, never cached. */
export function readProjectEnvOverrides(projectDir = process.cwd()) {
  const file = projectSettingsPath(projectDir);
  const j = readJson(file);
  const env = j && typeof j.env === 'object' && j.env ? j.env : {};
  return { file, env, present: OWNED_ENV_KEYS.filter((k) => typeof env[k] === 'string' && env[k].length) };
}

// ── Changing it, reversibly ──────────────────────────────────────────────────────────────────────

function backupOf(file) {
  // Millisecond stamps DO collide — measured elsewhere in this repo: six rapid saves produced five
  // backups because one copy silently overwrote another. An undo history that drops a step without
  // saying so is worse than none, so the name is made unique before the write and `wx` refuses to
  // overwrite even if a racing writer slipped between the check and the write.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let b = `${file}.bak-${stamp}`;
  for (let n = 2; fs.existsSync(b); n++) b = `${file}.bak-${stamp}-${String(n).padStart(2, '0')}`;
  return b;
}

/**
 * APPLY — write the chosen scope into config that already exists, without disturbing anything else.
 *
 * FOUR PROMISES, each of which is a test:
 *
 *   1. BACK UP FIRST, and refuse the write outright if the backup fails. A change you cannot undo is
 *      not a change, it is an overwrite, and the user cannot tell which one they got.
 *   2. MERGE, NEVER CLOBBER. This file is read with JSON.parse and written back whole, so every key
 *      we do not own — this repo's own `RUFLO_HARNESS_LOOP` env var and its version-bump-gate hook
 *      are sitting in exactly this file — must survive untouched. Two Claude Code sessions genuinely
 *      do run against one machine at once; on 2026-07-12 that destroyed a checkpoint with a plain
 *      overwrite, no error, no evidence beyond a changed row id.
 *   3. REVERSIBLE. The receipt carries everything revertScope() needs, including `existedBefore` so
 *      an undo of the first-ever write REMOVES the file rather than leaving a synthesised one.
 *   4. SAY EXACTLY WHAT CHANGED. `changed[]` is derived by comparing before and after, not narrated
 *      by the function that intended the change — the intent and the outcome are allowed to differ,
 *      and when they do, the receipt must show the outcome.
 *
 * IDEMPOTENT BY CONSTRUCTION: if the merge produces bytes identical to what is on disk, nothing is
 * written, no backup is taken, and the receipt says `changed: []`. Applying twice is not an error and
 * does not litter the directory with identical backups.
 *
 * `dryRun` runs the whole computation and writes nothing, so a console can show the user the diff
 * before asking. Read-only until you click, which is the promise the console already makes.
 */
export function applyScope(scopeId, { projectDir = process.cwd(), dryRun = false } = {}) {
  const scope = BY_ID.get(scopeId);
  if (!scope) {
    return { ok: false, scope: scopeId, changed: [], backup: null, log: `not a scope: ${JSON.stringify(scopeId)} — expected ${SCOPES.map((s) => s.id).join(' or ')}` };
  }

  const file = projectSettingsPath(projectDir);
  const existedBefore = fs.existsSync(file);
  const raw = existedBefore ? fs.readFileSync(file, 'utf8') : null;

  let before;
  if (raw === null) before = {};
  else {
    before = readJson(file);
    if (before === null) {
      // REFUSE. Unlike a settings file we own, this one belongs to Claude Code and may hold the
      // user's hooks and permissions. Rewriting bytes we could not parse would discard them, and
      // "we could not read it" is never a licence to replace it.
      return { ok: false, scope: scopeId, changed: [], backup: null, log: `refusing to write — ${file} is not valid JSON; fix or move it first, nothing was changed` };
    }
  }

  // Deep-enough clone: only `env` is touched, and it is one level of plain strings.
  const after = { ...before, env: { ...(before.env && typeof before.env === 'object' ? before.env : {}) } };
  const changed = [];

  if (scope.id === 'project') {
    const stateDir = path.join(projectDir, PROJECT_STATE_DIR);
    const want = {
      RUVNET_LESSON_STORE: path.join(stateDir, 'lessons.json'),
      RUVNET_SETTINGS_FILE: path.join(stateDir, 'settings.json'),
    };
    for (const k of OWNED_ENV_KEYS) {
      if (after.env[k] !== want[k]) {
        changed.push({ key: k, from: after.env[k] ?? null, to: want[k] });
        after.env[k] = want[k];
      }
    }
  } else {
    // Per-user is the ABSENCE of an override, not a competing value. Deleting the key lets the code
    // fall through to its own default — one source of truth. Writing the global path in explicitly
    // would pin this project to today's location and quietly break it if that location ever moves.
    for (const k of OWNED_ENV_KEYS) {
      if (Object.hasOwn(after.env, k)) {
        changed.push({ key: k, from: after.env[k], to: null });
        delete after.env[k];
      }
    }
  }

  // Do not leave an empty `env: {}` behind on a file we created — that is our litter, not their config.
  if (!Object.keys(after.env).length && !(before.env && Object.keys(before.env).length)) delete after.env;

  const body = `${JSON.stringify(after, null, 2)}\n`;
  const noop = existedBefore && body === raw;

  // The manual half, stated whether or not we wrote anything, because the user needs the whole
  // picture to act. We do not run these: `claude plugin install` is a mutation we cannot back up or
  // undo, and every promise above would be a lie the moment we shelled out to it.
  const detected = detectCurrentScope({ projectDir });
  const manualSteps = detected.scope === scope.id || detected.scope === 'both'
    ? []
    : [{ why: `register the plugin at ${scope.id} scope`, run: scope.installCommand }];

  if (noop || (!changed.length && existedBefore)) {
    return { ok: true, scope: scope.id, file, changed: [], backup: null, existedBefore, dryRun, manualSteps, log: `already set to ${scope.label.trim()} — nothing to change` };
  }
  if (dryRun) {
    return { ok: true, scope: scope.id, file, changed, backup: null, existedBefore, dryRun: true, manualSteps, log: `would update ${file.replace(HOME, '~')} (${changed.length} change${changed.length === 1 ? '' : 's'}) — nothing written` };
  }

  try { fs.mkdirSync(path.dirname(file), { recursive: true }); }
  catch (e) { return { ok: false, scope: scope.id, changed: [], backup: null, log: `refusing to write — could not create ${path.dirname(file)}: ${e.message}` }; }

  let backup = null;
  if (existedBefore) {
    backup = backupOf(file);
    // read-then-write rather than copyFileSync: under sustained concurrent saving copyFileSync
    // WEDGED a process at 100% CPU for 4m38s with zero progress and never returned. A hung handler on
    // a surface people are told to click is not survivable.
    try { fs.writeFileSync(backup, raw, { flag: 'wx' }); }
    catch (e) { return { ok: false, scope: scope.id, changed: [], backup: null, log: `refusing to write — backup failed: ${e.message}` }; }
  }

  const held = withLock(file, () => writeAtomic(file, body));
  if (held.timedOut) {
    return { ok: false, scope: scope.id, changed: [], backup, log: `another process is writing ${path.basename(file)} and did not finish in time — NOTHING was changed${backup ? `; your file is unchanged and a copy is at ${path.basename(backup)}` : ''}; try again` };
  }

  return {
    ok: true,
    scope: scope.id,
    file,
    changed,
    backup,
    existedBefore,
    dryRun: false,
    manualSteps,
    log: [
      `set to ${scope.label.trim()}`,
      ...changed.map((c) => (c.to === null
        ? `  removed ${c.key} (falls back to your user-level file)`
        : `  ${c.from === null ? 'added' : 'changed'} ${c.key} → ${c.to.replace(HOME, '~')}`)),
      backup ? `  previous file kept at ${path.basename(backup)}` : '  (this file did not exist before — reverting will remove it)',
    ].join('\n'),
  };
}

/**
 * REVERT — the other half of applyScope's promise, and it must be able to fail loudly.
 *
 * Pass the receipt back. `existedBefore: false` means there was no file, so the honest undo is to
 * REMOVE it rather than write a synthesised empty one — those are different states and
 * detectCurrentScope reports them differently.
 *
 * The lock receipt is CHECKED. Elsewhere in this repo a revert discarded it and reported "restored"
 * after writing nothing — measured: 5017ms elapsed, ok:true, file byte-for-byte unchanged. A failed
 * undo the user is told succeeded is worse than no undo button at all.
 */
export function revertScope({ file, backup = null, existedBefore = true } = {}) {
  if (!file) return { ok: false, log: 'nothing to revert — no file was recorded in that receipt' };

  if (!backup) {
    if (existedBefore) return { ok: false, log: `no backup was taken for ${file} — cannot revert automatically` };
    if (!fs.existsSync(file)) return { ok: true, log: 'nothing to revert — that file is already gone' };
    try { fs.rmSync(file); return { ok: true, log: `removed ${file.replace(HOME, '~')} (there was no such file before)` }; }
    catch (e) { return { ok: false, log: `could not remove ${file}: ${e.message}` }; }
  }
  if (!fs.existsSync(backup)) return { ok: false, log: `that backup is gone (${backup})` };

  let held;
  try { held = withLock(file, () => writeAtomic(file, fs.readFileSync(backup))); }
  catch (e) { return { ok: false, log: `restore failed: ${e.message}` }; }
  if (held.timedOut) return { ok: false, log: `another process is writing that file — NOTHING was restored and your backup at ${path.basename(backup)} is intact; try again` };
  return { ok: true, restored: backup, log: `restored ${path.basename(file)} from ${path.basename(backup)}` };
}

// ── The text a human reads ───────────────────────────────────────────────────────────────────────

/**
 * EXPLAIN — the whole conversation, as plain text, with every number derived at call time.
 *
 * "A core reason why you exist is to make murky and confusing things clear, tangible, accessible,
 *  and selectable. That has to apply to how we're implemented as well." (owner, 2026-07-22)
 *
 * Two rules hold this honest and both are tested:
 *
 *   NO FABRICATED NUMBERS. Every figure comes from disk at the moment of the call. When a fact is
 *   unavailable the SENTENCE IS OMITTED — it never degrades into a plausible-looking default. That is
 *   why countKnownProjects returns null rather than 0, and why measureCorpus reports `complete` and
 *   the copy says "at least" when the walk was cut short.
 *
 *   'unknown' NEVER RENDERS AS 'off'. If we could not read how this is installed, the text says so
 *   in those words and offers no verdict. A confident wrong answer here sends someone to install a
 *   second copy over a working one.
 */
export function explainChoice({ projectDir = process.cwd(), detected = null, facts = null } = {}) {
  const state = detected ?? detectCurrentScope({ projectDir });
  const f = facts ?? {
    projects: countKnownProjects(),
    corpus: measureCorpus(),
  };
  const L = [];

  L.push('How would you like this installed?');
  L.push('');

  // ── Where you are now ──
  if (!state.confident) {
    // The unknown branch. No verdict, no guess, and explicitly no action taken.
    L.push(`Right now: ${state.summary}`);
  } else if (state.scope === 'none') {
    L.push('Right now: not installed here yet.');
  } else {
    L.push(`Right now: ${state.summary}`);
  }
  L.push('');

  // ── The two options ──
  for (const s of SCOPES) {
    L.push(`${s.label}${state.confident && state.scope === s.id ? '   ← this is what you have now' : ''}`);
    L.push(`  ${s.oneLine}`);
    L.push('');
    L.push(`  ${s.summary}`);
    L.push('');
    L.push(`  Why it matters: ${s.whyItMatters}`);
    L.push(`  The downside:   ${s.downside}`);
    L.push('');
    L.push('  What it changes:');
    for (const d of s.differences) L.push(`    · ${d.component} — ${d.consequence}`);
    L.push('');
  }

  // ── What you do NOT lose by going narrow ──
  L.push('The same either way:');
  for (const u of SHARED_EITHER_WAY) L.push(`  · ${u.what} — ${u.detail}`);
  L.push('');

  // ── Derived numbers, each omitted entirely when unknown ──
  const numbers = [];
  if (typeof f.projects === 'number' && f.projects > 0) {
    numbers.push(`Claude Code has seen ${f.projects} project${f.projects === 1 ? '' : 's'} on this machine — per-user covers all of them.`);
  }
  if (f.corpus && f.corpus.exists && typeof f.corpus.bytes === 'number') {
    const size = formatBytes(f.corpus.bytes);
    if (size) numbers.push(`The shared corpus is ${f.corpus.complete ? '' : 'at least '}${size}, read by every project. Neither choice duplicates it.`);
  }
  if (numbers.length) { L.push('On this machine:'); for (const n of numbers) L.push(`  ${n}`); L.push(''); }

  L.push(`Our strong recommendation is ${BY_ID.get(RECOMMENDED).label.replace(/\s*\(.*\)\s*/, '')} — but you are the arbiter of how things run on your machine.`);
  L.push('Either way, this is backed up before anything is written, and reversible with one command.');

  return L.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────
// READ-ONLY unless you pass --apply, and --apply without a scope explains rather than guesses. A
// module about consent whose CLI mutated on a bare invocation would be arguing against itself.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('install-scope.mjs');
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const wants = argv.find((a) => !a.startsWith('-'));
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run');

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ detected: detectCurrentScope(), scopes: SCOPES, recommended: RECOMMENDED }, null, 2));
  } else if (apply && wants) {
    const r = applyScope(wants, { dryRun });
    console.log(`\n${r.log}\n`);
    for (const m of r.manualSteps ?? []) console.log(`  still to do — ${m.why}:\n    ${m.run}\n`);
    if (!r.ok) process.exitCode = 1;
  } else {
    console.log(`\n${explainChoice()}\n`);
    console.log(`  To choose:  node scripts/install-scope.mjs <${SCOPES.map((s) => s.id).join('|')}> --apply     (add --dry-run to preview)\n`);
  }
}
