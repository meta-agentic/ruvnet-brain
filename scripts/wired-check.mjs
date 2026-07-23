#!/usr/bin/env node
/**
 * wired-check.mjs — refuses to let a module ship with zero callers.
 *
 * THE FAILURE THIS EXISTS TO END. On 2026-07-22 this project shipped built-tested-unwired code
 * SEVEN times in a single session: capability-registry, capability-audit, lesson-gate, anticipate,
 * advocacy-outcomes, lesson-promote, continuation-gate. Each was found by a human running grep.
 * Every one passed its own tests, because a unit test imports the module directly — the one caller
 * whose existence is guaranteed by its own file.
 *
 * (Those names are deliberately NOT written here as `<name>.mjs`. The first version of this header
 * listed them in invocation form, and the gate's own memorial then matched as a caller for every
 * module it eulogised. A gate must not be able to wire its own dead.)
 *
 * The owner's principle, P7: "Built is not shipped; shipped is not wired. A feature exists only
 * when a real caller invokes it on a real user path."
 *
 *   node scripts/wired-check.mjs            report
 *   node scripts/wired-check.mjs --check    exit 1 if any shippable module has no caller
 *
 * ── WHAT CHANGED, 2026-07-22 (ADR-037 / DDD-0010) ────────────────────────────────────────────
 * v1 of this gate reported 62/62 wired, exit 0, and had never failed. That was not health, it was
 * silence. Adversarial review (GPT-5.6-Sol, Fable 5) found three defects, all measured:
 *
 *   1. THE PREDICATE. v1 matched any MENTION of the basename anywhere in a file. A comment counted.
 *      A substring counted — `prove` matched "proven"; `version` matched a `"version"` JSON key.
 *      DDD-0010's own glossary said a Caller is "explicitly NOT any mention of the module's name",
 *      and the implementation was exactly that. The model disclaimed the code and nobody diffed it.
 *      Now: a caller must reference the module in INVOCATION SHAPE — inside a quoted string (import,
 *      require, npm script, workflow `run:`) or after node/bash/sh. Prose no longer wires anything.
 *
 *   2. THE INVENTORY. v1 read `scripts/*.mjs` only — 40 of 129 first-party executables were
 *      invisible, never audited, never printed, never counted. Among them
 *      `plugin/scripts/anticipate.sh`: one of the seven failures above, which v1 could never have
 *      caught. An invisible module is worse than an unwired one, because nothing reports it.
 *
 *   3. THE SEARCH SET. `kb/` was scanned for callers — ~3MB of JSON corpora INDEXING 68 OTHER
 *      REPOSITORIES, so a foreign repo's filenames counted as callers here. Removed. Also added:
 *      `.github/` + `--include=*.yml` (all 5 workflows are YAML; adding the directory without the
 *      glob, as ADR-037 draft 1 proposed, would have matched exactly nothing) and root package.json,
 *      where npm-script callers actually live.
 *
 * Also fixed: the test exclusion filtered `/tests/` PATHS, so `scripts/console-engine.test.mjs`
 * counted as a caller — violating this file's own rule in-tree. Now excluded by NAME, anywhere.
 *
 * WHAT COUNTS AS A CALLER: an invocation-shaped reference from non-test, non-self source. A test is
 * explicitly NOT a caller — that exclusion is the entire point, because every one of the seven had
 * passing tests.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);

/**
 * Modules that are legitimately standalone: a human or an out-of-repo scheduler runs them, so a call
 * site would be wrong to demand.
 *
 * An array, not an object literal, so a duplicate name is DETECTABLE. v1 used an object and had
 * `memory-doctor` twice (lines 50 and 64) — last-wins discarded one silently.
 *
 * HONEST LIMIT (ADR-037 §3): a reason here is PROSE, and prose is not verification. v1's four
 * "invoked from the workflow" reasons were all written in the same commit as the gate, by an author
 * who never ran the check — three of them were simply false. No schema detects that. The two real
 * mitigations are (a) needing far fewer entries now the predicate is correct, and (b) PRINTING
 * every entry on every run, below, so they cannot rot unseen.
 */
const STANDALONE = [
  ['lesson-seed', 'one-shot seeding, run deliberately by a human'],
  ['lesson-ratify', 'the human control surface — a CLI is its entire purpose'],
  ['memory-doctor', 'diagnostic CLI'],
  ['token-report', 'diagnostic CLI'],
  ['agentdb-fleet-doctor', 'diagnostic CLI run by hand when a fleet looks wrong'],
  ['ingest-meeting', 'one-shot ingestion, run by hand'],
  ['fix-metaharness-memretrieve', 'one-shot historical repair; kept for the record'],
  ['gen-console-images', 'build-time asset generation, run by hand'],
  ['adr-backfill', 'one-shot backfill by a human; its result is enforced by adr-format.test.mjs'],
  ['release', 'the ship path, run by a human'],
  // Run by the launchd nightly, which lives OUTSIDE this repo — so no in-repo caller can exist.
  // This is the one category the scanner genuinely cannot reach, and saying so is the honest form.
  ['self-update', 'launchd nightly (out-of-repo scheduler)'],
  ['count-chunks', 'launchd nightly (out-of-repo scheduler)'],
  ['brain-stamp', 'launchd nightly (out-of-repo scheduler)'],
  ['lesson-promote', 'launchd nightly (out-of-repo scheduler), plus a human'],
  ['behavioral-l1-l4', 'behavioural harness invoked by its own test file — not a product path'],

  // ADDED 2026-07-23 (P7 sweep, ADR-037 honesty bar — each reason verified against reality below,
  // not written blind. See PROGRESS.md / the wiring report for the per-item evidence.)
  //
  // launchd nightly (out-of-repo scheduler) — confirmed LIVE via `launchctl list` + the installed
  // plist's own ProgramArguments on 2026-07-23, not assumed from the header comment alone:
  ['clear-claude-tmp', 'launchd, every 3h (out-of-repo scheduler) — confirmed live: '
    + 'com.stuartkerr.clear-claude-tmp.plist is loaded and its ProgramArguments invoke this exact file'],
  ['nightly-gists', 'launchd nightly 21:47 (out-of-repo scheduler) — confirmed live: '
    + 'com.ruvnet.brain-gists.plist is loaded and its ProgramArguments invoke this exact file'],
  ['nightly-wrapper', 'launchd nightly 03:15 (out-of-repo scheduler) — confirmed live: '
    + 'com.ruvnet.brain-nightly.plist is loaded and its ProgramArguments invoke this exact file'],
  ['routing-flywheel', 'launchd nightly 04:45 --dry-run (out-of-repo scheduler) — confirmed live: '
    + 'com.ruvnet.routing-flywheel.plist is loaded and its ProgramArguments invoke this exact file'],
  ['install-npx-witness', 'one-shot idempotent installer for the com.ruvnet.npx-witness launchd job, '
    + 'run by hand once — confirmed live: the installed plist\'s ProgramArguments match exactly what '
    + 'this script writes. The recurring job body is scripts/npx-witness.sh, wired separately'],

  // human-run KB-build/grading harnesses — documented as a unit in CONTRIBUTING.md §5 ("the test/
  // grading scripts") and exercised by hand per PROGRESS.md session logs (`--name X --variant Y`).
  // Each needs an external `../ruvnet-repos/<name>` clone and/or a paid multi-vendor LLM call
  // (OPENROUTER_API_KEY) to grade a KB variant — deliberately outside gate.sh's fast/free/local
  // pipeline (gate.sh only runs prove.mjs, which needs neither):
  ['brain-capability-check', 'human-run KB grading harness (CONTRIBUTING.md §5); '
    + 'grades a built variant against kb/capability.*.json by hand before shipping'],
  ['brain-grade-groundtruth', 'human-run KB grading harness (CONTRIBUTING.md §5); needs an external '
    + '../ruvnet-repos/<name> clone + paid multi-vendor LLM grading, run by hand per repo'],
  ['build-l2', 'human-run KB synthesis harness (CONTRIBUTING.md §5); synthesizes + grades L2 prose '
    + 'via a paid multi-vendor LLM panel, run by hand per repo/variant'],

  // diagnostic CLIs run by hand — same shape as memory-doctor/token-report/agentdb-fleet-doctor above:
  ['calibrate-router', 'measurement harness run by hand to calibrate router tiers on real runs; '
    + 'billing-safety wrapped (strips API keys so it can only bill the subscription)'],
  ['check-indexation', 'diagnostic CLI run by hand; explicitly "always exit 0, not a gate" per its '
    + 'own header — live Bing/Google scraping to eyeball real-world SEO status, not CI-appropriate'],
  ['check-legibility', 'manual pre-ship check run by hand against a LOCAL dev server the developer '
    + 'starts themselves (--url http://127.0.0.1:.../page.html, via Playwright) — needs a live '
    + 'rendered page, not a static diff, so it is a dev-loop tool like gen-console-images.mjs, not a '
    + 'CI step'],
  ['dev-plugin-link', 'developer convenience CLI — its own header: "Users never run it." Hot-links '
    + 'the cached plugin install to the working tree so hook edits apply without a CC restart'],

  // ADR-0026 Meta LLM Proxy passthrough trial — both are human-run by design (one launches a proxied
  // session interactively via `exec claude "$@"`, the other is the trial's safety-net uninstaller):
  ['claude-proxied', 'ADR-0026 proxy trial: human-run launcher for one proxied Claude Code session '
    + '(exec claude "$@") — interactive by design, never invoked programmatically'],
  ['proxy-revert', 'ADR-0026 proxy trial: human-run safety-net uninstaller, run by hand to fully '
    + 'revert the trial'],

  // lesson-capture CLI — same shape as lesson-seed/lesson-ratify above: a human runs this with
  // --task/--tried/--worked/--critique flags. docs/ARCHITECTURE-MAP.md documents the pipeline as
  // "record-lesson.mjs -> lesson-store.mjs -> lesson-ratify.mjs (a human, never the model)":
  ['record-lesson', 'human-run structured lesson-capture CLI (--task/--tried/--worked/--critique); '
    + 'never invoked by the model itself, by design'],

  // one-shot, and its job is done: issue #4 closed 2026-07-10 (confirmed live via `gh issue view 4`).
  // Per the file's own header its 07:17 launchd trigger removed itself after firing, so no plist
  // remains to find. Kept for the historical record, same precedent as fix-metaharness-memretrieve
  // above — NOT re-wired, because there is nothing left for it to verify:
  ['verify-nightly-close-issue4', 'one-shot, job complete: issue #4 closed 2026-07-10 (confirmed '
    + 'live); its own launchd trigger self-removed after firing. Kept for the record — deletion is '
    + 'also reasonable and is flagged as a candidate in the wiring report, Stuart\'s call'],

  // Gates that ship deliberately INERT in hooks.json (SECURITY.md documents this exact class:
  // "ship as inert files with every install; they only ever run if something else explicitly wires
  // them into a settings.json") — an in-repo caller is structurally the wrong thing to demand for a
  // gate the INSTALLING USER activates in their own, out-of-repo settings.json:
  ['ground-before-write', 'PreToolUse (Write|Edit|MultiEdit) gate — confirmed LIVE 2026-07-23 wired '
    + 'into Stuart\'s own global ~/.claude/settings.json (ADR-0012), not this repo\'s files. '
    + 'SECURITY.md documents it as shipping inert in hooks.json by design'],
  ['kling-preflight', 'PreToolUse (Bash) gate — ships inert by design, same SECURITY.md class as '
    + 'ground-before-write. Per ADR-0014 ownership moved to the Kling skill (confirmed live: a copy '
    + 'ships at ~/.claude/skills/klingai/scripts/kling-preflight.sh); NOT currently wired into any '
    + 'settings.json there either — honestly dormant until a user opts in, not a silent gap'],
];
// REMOVED 2026-07-22, each verified before removal:
//   check-legibility / check-indexation / status-honesty — claimed "invoked from the workflow";
//     nothing in .github/ invokes them. The claim was false, so they are now audited for real.
//   claims-verify — the claim was TRUE (.github/workflows/ci.yml:56 runs `npm run claims:verify`).
//     It needs no entry now that package.json and *.yml are searched. Draft 1 of ADR-037 called this
//     one false too; it had grepped `claims-verify` while the npm script is `claims:verify`.
//   doc-currency, sync-version, build-bundle, health-repair, capability-audit, wired-check —
//     all have real invokers the corrected scanner now finds on its own.

/**
 * DELIBERATELY HELD — built, correct to keep, knowingly NOT wired, each with the bar it must clear.
 * A separate category from STANDALONE on purpose: filing held work under "standalone" would be a
 * small lie that hides a real gap. Held work is VISIBLE work.
 */
const HELD = {
  'correction-detect': 'N3 lesson extraction. Re-measured 2026-07-23 on a reproducible held-out split '
    + 'of 1,328 real transcripts (scripts/correction-detect-measure.mjs): 5 real detector bugs fixed, '
    + 'corpus detections 2->8, but still 4 firings on the holdout at ~50-100% precision (n far below the '
    + '>=100-detection / >=90% floor, ADR-033). The residual gap looks STRUCTURAL, not a tuning miss: '
    + 'genuine "learn a new rule" phrasing is lexically identical to the bug-report / spec-language '
    + 'false-positive classes the adversarial review killed. Clearing the floor needs a different '
    + 'primitive (an embedding classifier) or far more labeled data — not more regexes. Stays HELD.',
  'lesson-lifecycle': 'retirement + generalization for extracted lessons. Depends on '
    + 'correction-detect; wiring it alone would retire hand-written lessons on evidence that does '
    + 'not exist yet.',
};

/** Where first-party executables live. v1 knew only the first line of this table. */
const INVENTORY_ROOTS = [
  { dir: 'scripts', exts: ['.mjs', '.sh'], recurse: true },
  { dir: 'plugin/scripts', exts: ['.mjs', '.sh'], recurse: true },
  { dir: 'bin', exts: ['.mjs'], recurse: false },
  { dir: 'console', exts: ['.js'], recurse: false },
];

/**
 * Where callers live. NOT kb/ — it indexes 68 other repos and their filenames are not our callers.
 *
 * `.claude/` earns its place the hard way: the first run of the corrected gate reported
 * `version-bump-gate.sh` unwired, and it is invoked from `.claude/settings.json`. Per ADR-037 §3, an
 * invoker outside the roots proves the ROOTS are incomplete — the fix is to add the root, never to
 * write an exemption. That rule caught its own author within a minute of the gate first running.
 */
const CALLER_ROOTS = ['scripts', 'plugin', 'console', 'bin', '.github', '.claude', 'package.json'];
const CALLER_EXTS = new Set(['.mjs', '.js', '.sh', '.json', '.html', '.yml', '.yaml']);

const isTestFile = (f) => /\.(test|spec)\.(mjs|js)$/.test(path.basename(f))
  || f.includes(`${path.sep}tests${path.sep}`) || f.startsWith(`tests${path.sep}`);

function walk(abs, recurse, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(abs, e.name);
    if (e.isDirectory()) {
      if (recurse && e.name !== 'node_modules' && !e.name.startsWith('.')) walk(full, recurse, out);
    } else out.push(full);
  }
  return out;
}

/** Every first-party module expected to be USED by something. */
export function shippableModules(repo = REPO) {
  const out = [];
  for (const root of INVENTORY_ROOTS) {
    const abs = path.join(repo, root.dir);
    for (const full of walk(abs, root.recurse)) {
      const ext = path.extname(full);
      if (!root.exts.includes(ext)) continue;
      if (isTestFile(full)) continue;
      const rel = path.relative(repo, full);
      out.push({ base: path.basename(full, ext), file: path.basename(full), rel });
    }
  }
  return out;
}

/** Files that could contain a caller. */
function callerFiles(repo = REPO) {
  const out = [];
  for (const r of CALLER_ROOTS) {
    const abs = path.join(repo, r);
    let st; try { st = fs.statSync(abs); } catch { continue; }
    if (st.isFile()) { out.push(abs); continue; }
    for (const f of walk(abs, true)) if (CALLER_EXTS.has(path.extname(f))) out.push(f);
  }
  return out;
}

/**
 * INVOCATION-SHAPED match. The whole correction lives here.
 *
 * A caller references the file either inside a quoted string — covering `import ... from '...'`,
 * `require('...')`, npm scripts, and a workflow's `run:` — or directly after node/bash/sh. A bare
 * mention in prose does not match, which is what let a comment wire a module in v1.
 */
export function callerPattern(fileName) {
  const q = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // eslint-disable-next-line no-useless-escape
  return new RegExp(`["'\`][^"'\`\\n]*${q}|(?:node|bash|sh|exec|spawn\\w*)\\s+[^\\n]*${q}`);
}

/** Count REAL callers. Tests excluded deliberately: all seven failures had passing tests. */
export function callersOf(mod, files, repo = REPO) {
  const re = callerPattern(mod.file);
  const hits = [];
  for (const f of files) {
    const rel = path.relative(repo, f);
    if (rel === mod.rel) continue;              // self
    if (isTestFile(rel)) continue;              // a test is not a caller
    let src = '';
    try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (re.test(src)) hits.push(rel);
  }
  return hits;
}

export function audit({ repo = REPO, standalone = STANDALONE, held = HELD } = {}) {
  const dupes = [];
  const seen = new Map();
  for (const [name, why] of standalone) {
    if (seen.has(name)) dupes.push(name); else seen.set(name, why);
  }

  const files = callerFiles(repo);
  const all = shippableModules(repo);
  const rows = [];
  for (const m of all) {
    if (seen.has(m.base)) { rows.push({ ...m, state: 'exempt', why: seen.get(m.base) }); continue; }
    if (held[m.base]) { rows.push({ ...m, state: 'held', why: held[m.base] }); continue; }
    const callers = callersOf(m, files, repo);
    rows.push({ ...m, state: callers.length ? 'wired' : 'unwired', callers });
  }
  return { rows, dupes, inventory: all.length };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]).endsWith(`wired-check${path.extname(process.argv[1])}`);

if (invokedDirectly) {
  const { rows, dupes, inventory } = audit();
  const by = (s) => rows.filter((r) => r.state === s);
  const unwired = by('unwired');

  if (!argv.includes('--quiet')) {
    console.log(`\n  ${inventory} first-party module(s) in the inventory`);
    console.log(`    ${by('wired').length} wired · ${by('exempt').length} exempt · `
      + `${by('held').length} held · ${unwired.length} UNWIRED\n`);

    for (const u of unwired) console.log(`    ✗ ${u.rel}  — built, and invoked by nothing`);
    if (unwired.length) {
      console.log(`\n  A module with no caller is not a feature. Either wire it to a real user path,`);
      console.log(`  or add it to STANDALONE in this file WITH A TRUE REASON.\n`);
    }

    // Every exemption, every run. v1 never printed these, so 3 false reasons rotted unseen for a
    // day inside the gate built to stop exactly that.
    console.log(`  ${by('exempt').length} exempt — no caller required, and why:\n`);
    for (const e of by('exempt')) console.log(`    ○ ${e.rel}\n       ${e.why}`);

    console.log(`\n  ${by('held').length} HELD — built, not wired, and the bar each must clear:\n`);
    for (const h of by('held')) console.log(`    ⏸ ${h.rel}\n       ${h.why}\n`);

    if (dupes.length) console.log(`  ✗ DUPLICATE exemption(s): ${dupes.join(', ')}\n`);
  }

  const bad = unwired.length || dupes.length;
  process.exit(argv.includes('--check') && bad ? 1 : 0);
}
