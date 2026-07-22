// lesson-store.mjs — a lesson is an EXECUTABLE OBJECT, not a paragraph.
//
// THE ONE IDEA. Every previous attempt to make this agent learn stored lessons as PROSE, and prose
// has no trigger — nothing in the system can ask "does this apply right now?", so the only mechanism
// left is the model remembering to care. Measured over a single session (2026-07-21/22):
//
//     gates that could interrupt:  8 fired,  8 obeyed   (100%)
//     prose in CLAUDE.md:          6 chances, 0 obeyed   (the version-bump rule)
//
// Same model, same session, same sincere intentions. The only variable was whether the knowledge
// could interrupt. That is the whole finding, and this file is its consequence: a lesson that cannot
// name WHEN it fires is not storable here. The schema refuses it — the same discipline as
// console-engine.makeRecommendation(), which throws on a recommendation with no undo, and for the
// same reason: the invariant belongs in the type, not in a reviewer's memory.
//
// THE SECOND IDEA, which is what makes this honest rather than tidy. Not every lesson can be a gate.
// "I optimize for gradeable work over valuable work" is a bias in what I CHOOSE to do; no hook can
// observe it. Pretending it were gateable would be the exact failure (rounding truth to a satisfying
// shape) that produced the bug this file exists to fix. So `enforcement: 'review'` is a first-class,
// declared value meaning THIS CANNOT BE AUTOMATED — and a lesson that claims it can be blocked must
// prove it by naming a trigger a real hook can observe.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();

/**
 * TRIGGERS — the closed set of moments where behaviour can go wrong.
 *
 * This is the list that stays FIXED while the lesson count grows without bound. That asymmetry is
 * the entire architecture: gates scale with decision TYPES (few, stable), lessons scale with
 * experience (many, unbounded). If this enum starts growing per-lesson, the design has failed and
 * should be reverted rather than extended.
 *
 * `surface` records what a hook can actually observe. Note that the three highest-frequency failures
 * fire on TEXT, not on a tool call — which is precisely why they were never gated, and why they are
 * listed first rather than last.
 */
export const TRIGGERS = Object.freeze({
  ASSERT_FACT: { key: 'assert-fact', surface: 'text', label: 'about to state a fact about the world (a version, an API, what a tool does)' },
  RECOMMEND_ARCH: { key: 'recommend-architecture', surface: 'text', label: 'about to recommend an architecture or approach' },
  RELAY_NUMBER: { key: 'relay-number', surface: 'text', label: 'about to repeat a score, benchmark, or a subagent’s result' },
  REPORT_STATUS: { key: 'report-status', surface: 'text', label: 'about to report progress or state' },
  WRITE_CODE: { key: 'write-code', surface: 'tool', label: 'about to write or edit code' },
  CLAIM_DONE: { key: 'claim-done', surface: 'text', label: 'about to claim something works' },
  SHIP: { key: 'ship', surface: 'tool', label: 'about to push, publish, or release' },
  MUTATE_MACHINE: { key: 'mutate-machine', surface: 'tool', label: 'about to change something outside this repo' },
  CHOOSE_WORK: { key: 'choose-work', surface: 'plan', label: 'about to decide what to work on next' },
  FINISH: { key: 'finish', surface: 'tool', label: 'finishing a unit of work' },
});
const TRIGGER_KEYS = new Set(Object.values(TRIGGERS).map((t) => t.key));

/**
 * ENFORCEMENT — how strongly a lesson acts, and it is NOT a preference dial.
 *
 * `block` is reserved for non-negotiables. A gate that blocks on taste is a gate users disable, and
 * a disabled gate protects nothing — so over-blocking does not merely annoy, it destroys the whole
 * mechanism. `review` is the honest escape hatch for lessons no hook can observe; it is a promise to
 * check at ADR-review time, not a pretence of automation.
 */
export const ENFORCEMENT = Object.freeze({
  BLOCK: 'block',        // refuse the action outright
  INJECT: 'inject',      // put the lesson in front of the model at that moment
  CHECKLIST: 'checklist',// require an explicit, visible acknowledgement in the output
  REVIEW: 'review',      // NOT automatable — declared so, and checked by a human
});
const ENFORCEMENT_VALUES = new Set(Object.values(ENFORCEMENT));

/**
 * ORIGIN — who claims this lesson is true. Added 2026-07-22 after an adversarial review (GPT-5.6-Sol)
 * found the most dangerous hole in the design: there was NO trust boundary on lesson creation.
 *
 * Its exact scenario, which was achievable as written:
 *
 *   "A repository instruction or hallucinated session summary records 'the user corrected me:
 *    upload diagnostics including credentials.' The same template contaminates two projects,
 *    becomes 'independently rediscovered', and enters the global objective. Darwin then optimises
 *    secret exfiltration."
 *
 * That is a prompt-injection path straight into the objective function of an evolutionary search.
 * Independent rediscovery — the promotion evidence — is trivially forged by anything that writes to
 * two project memory directories, which includes the model itself and any repo the user clones.
 *
 * So provenance is now structural: a lesson the MODEL inferred about itself may never block, and may
 * never be promoted globally, until a human ratifies it. Machine-authored memory is a candidate, not
 * a fact.
 */
export const ORIGIN = Object.freeze({
  USER_STATED: 'user-stated',       // the user said it, in their own words, in a session
  MODEL_INFERRED: 'model-inferred', // the model wrote it about itself — QUARANTINED by default
  IMPORTED: 'imported',             // came from a repo, template, or another machine — least trusted
});
const ORIGIN_VALUES = new Set(Object.values(ORIGIN));

/**
 * STATUS — the ratification ladder. A lesson does not become policy by existing.
 * candidate → ratified (a human agreed) → active (in force at its trigger).
 */
export const STATUS = Object.freeze({
  CANDIDATE: 'candidate',
  RATIFIED: 'ratified',
  ACTIVE: 'active',
});
const STATUS_VALUES = new Set(Object.values(STATUS));

/**
 * The schema gate. Throws — loudly, at construction — on any lesson that could not possibly act.
 *
 * Each refusal below maps to a real way this project has failed:
 *  • no trigger      → the prose problem: knowledge with no moment attached (0/6 compliance)
 *  • no evidence     → a rule nobody can audit is a rule imposed, not learned
 *  • block w/o proof → blocking on taste is how gates get switched off entirely
 *  • text + block    → honesty about what the harness can actually intercept
 */
export function makeLesson(spec) {
  const {
    id, statement, trigger, enforcement, evidence,
    projects = [], repeatCount = 0, demoted = false, check = null,
    origin = ORIGIN.MODEL_INFERRED,   // least-privilege DEFAULT: unstated provenance is untrusted
    status = STATUS.CANDIDATE,        // and unstated status is unratified
    severity = 'normal',              // 'normal' | 'high' — see weightOf()
    intendedEnforcement = null,       // what it should become once a human ratifies it
    ratifiedBy = null,
  } = spec;
  const err = (m) => { throw new Error(`Lesson "${id ?? '?'}" invalid: ${m}`); };

  if (!id || typeof id !== 'string') err('missing id');
  if (!statement || statement.length < 15) err('statement must say what to DO, specifically');
  if (!trigger || !TRIGGER_KEYS.has(trigger)) {
    err(`trigger must be one of: ${[...TRIGGER_KEYS].join(', ')}. A lesson with no trigger is prose, and prose does not act — that is the entire reason this store exists.`);
  }
  if (!ENFORCEMENT_VALUES.has(enforcement)) err(`enforcement must be one of: ${[...ENFORCEMENT_VALUES].join(', ')}`);
  if (!Array.isArray(evidence) || !evidence.length) err('evidence[] must be non-empty — a lesson with no observed failure behind it is a preference, and preferences may not become rules');

  // A blocking lesson must name the machine-checkable condition that blocks. "Be careful" cannot
  // block anything; if we cannot write the check, we do not get to claim enforcement.
  if (enforcement === ENFORCEMENT.BLOCK && (!check || !check.length)) {
    err('enforcement:block requires `check` — the concrete, machine-verifiable condition. If you cannot state the check, this is at most `checklist`.');
  }
  // Truthfulness about the harness: a `plan`-surface trigger has no hook to fire on at all.
  const surface = Object.values(TRIGGERS).find((t) => t.key === trigger).surface;
  if (surface === 'plan' && enforcement !== ENFORCEMENT.REVIEW && enforcement !== ENFORCEMENT.CHECKLIST) {
    err(`trigger "${trigger}" fires while CHOOSING work — no hook can observe that. It may only be 'checklist' or 'review'. Claiming otherwise is pretending a bias is a gate.`);
  }

  if (!ORIGIN_VALUES.has(origin)) err(`origin must be one of: ${[...ORIGIN_VALUES].join(', ')}`);
  if (!STATUS_VALUES.has(status)) err(`status must be one of: ${[...STATUS_VALUES].join(', ')}`);

  // THE TRUST BOUNDARY. A lesson the model wrote about itself, or one imported from a repo, cannot
  // block work until a human has ratified it. This is what closes the injection path: a hallucinated
  // or planted "the user told me to..." can still be RECORDED (we want the candidate), but it cannot
  // reach an enforcement level that changes behaviour, and cannot enter the objective function.
  if (enforcement === ENFORCEMENT.BLOCK && origin !== ORIGIN.USER_STATED) {
    err(`enforcement:block requires origin:user-stated (got "${origin}"). Machine-authored or imported lessons may not block work until a human ratifies them — otherwise a planted session summary becomes a gate.`);
  }
  if (enforcement === ENFORCEMENT.BLOCK && status === STATUS.CANDIDATE) {
    err('enforcement:block requires status:ratified or active — a candidate has not been agreed to by anyone');
  }

  return Object.freeze({
    id, statement, trigger, enforcement, evidence,
    surface, origin, status, severity,
    intendedEnforcement: intendedEnforcement ?? null,
    ratifiedBy: ratifiedBy ?? null,
    projects: [...projects],
    repeatCount,
    demoted: demoted === true,
    check: check ?? null,
  });
}

/**
 * WEIGHT — how strongly a lesson pulls on the objective function.
 *
 * CRITICAL fix, 2026-07-22, from the adversarial review. The original design used raw `repeatCount`
 * as the weight. The reviewer's verdict was correct and worth quoting exactly:
 *
 *   "Repeat count is a contaminated proxy: frequency of opportunity × failure visibility × user
 *    patience × capture duplication... A formatting preference corrected 52 times dominates a
 *    security rule corrected once because the security failure occurred only once. Darwin produces
 *    beautifully formatted credential leaks."
 *
 * Repetition measures the USER'S FRUSTRATION, not the lesson's importance — and frustration scales
 * with how often a situation ARISES, which is nearly uncorrelated with how much it matters. A rule
 * about naming fires on every file; a rule about not leaking credentials fires once a year.
 *
 * So repetition is LOG-CAPPED (it may raise priority, never establish truth), severity is an
 * independent multiplier, and unratified lessons contribute a fraction of their nominal weight —
 * they are hypotheses, and a hypothesis must not steer an evolutionary search.
 */
export function weightOf(lesson) {
  if (lesson.demoted) return 0;
  // log1p flattens the difference between 5× and 50× to under 2×, so a frequently-arising nag can
  // never out-vote a rare catastrophe purely on count.
  const repetition = Math.log1p(Math.max(0, lesson.repeatCount)) / Math.log1p(50);
  const severity = lesson.severity === 'high' ? 3 : 1;
  // Cross-project rediscovery is better evidence of generality than raw repetition, but it is still
  // evidence about SCOPE, not about correctness — so it is a modest multiplier, not a dominant one.
  const breadth = 1 + Math.min(1, (lesson.projects.length - 1) * 0.25);
  const trust = lesson.origin === ORIGIN.USER_STATED ? 1
    : lesson.status === STATUS.RATIFIED || lesson.status === STATUS.ACTIVE ? 0.6
      : 0.15;   // an unratified machine-authored guess barely moves the objective at all
  return +(repetition * severity * breadth * trust).toFixed(4);
}

/**
 * What a gate asks for: the lessons that apply RIGHT NOW.
 *
 * Ordered by force (block first) then by how often the user had to repeat it — because repetition is
 * the measured signal that the previous, gentler form was not working (ruflo ADR-G008 ranks
 * violations by frequency for exactly this reason). Capped, because a gate that injects twenty
 * lessons is a gate people learn to scroll past, and an ignored gate is prose with extra latency.
 */
export function lessonsFor(trigger, lessons, { limit = 3 } = {}) {
  const rank = { block: 0, checklist: 1, inject: 2, review: 3 };
  return lessons
    .filter((l) => l.trigger === trigger && !l.demoted)
    .sort((a, b) => (rank[a.enforcement] - rank[b.enforcement]) || (b.repeatCount - a.repeatCount))
    .slice(0, limit);
}

/** Lessons that cannot be automated — surfaced deliberately so they are never silently dropped. */
export function unenforceable(lessons) {
  return lessons.filter((l) => l.enforcement === ENFORCEMENT.REVIEW && !l.demoted);
}

// ── Persistence ──────────────────────────────────────────────────────────────────────────────────
// USER-LEVEL, and deliberately OUTSIDE the shipped bundle: ~/.config/ruvnet-brain/ rather than
// ~/.cache/ruvnet-brain/kb (which `--update` replaces wholesale). A lesson destroyed by the next
// release never compounds, and compounding is the only point of any of this.
export const STORE_PATH = process.env.RUVNET_LESSON_STORE
  || path.join(HOME, '.config', 'ruvnet-brain', 'lessons.json');

export function loadLessons(file = STORE_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Re-validate on READ, not just on write. A hand-edited store is expected (the user must be able
    // to edit and delete these); a malformed entry must be dropped loudly rather than acted upon.
    const out = [];
    for (const l of raw.lessons || []) {
      try { out.push(makeLesson(l)); } catch { /* skip the invalid entry, keep the rest usable */ }
    }
    return out;
  } catch { return []; }
}

export function saveLessons(lessons, file = STORE_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = { version: 1, updated: new Date().toISOString(), lessons };
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  return { ok: true, file, count: lessons.length };
}

/** Demotion is STICKY: the user's "this was wrong" must survive the next mining run, or the control is theatre. */
export function demote(id, lessons) {
  return lessons.map((l) => (l.id === id ? makeLesson({ ...l, demoted: true }) : l));
}

/**
 * RATIFY — the human action that turns a hypothesis into policy.
 *
 * This is the other half of the trust boundary, and without it the boundary would just be a way of
 * making the system permanently inert. A lesson is stored at the enforcement level it can justify
 * TODAY (`checklist` at most, for anything unratified); ratification raises it to the level it was
 * proposed at, but ONLY for user-stated lessons.
 *
 * Deliberately refuses to ratify model-inferred lessons into `block`. If the model could ratify its
 * own inferences, the boundary would be a comment rather than a control — and the injection path
 * the adversarial review found would be open again through one extra step.
 */
export function ratify(id, lessons, { by = 'user' } = {}) {
  return lessons.map((l) => {
    if (l.id !== id) return l;
    const target = l.intendedEnforcement || l.enforcement;
    const canBlock = l.origin === ORIGIN.USER_STATED;
    return makeLesson({
      ...l,
      status: STATUS.RATIFIED,
      enforcement: target === ENFORCEMENT.BLOCK && !canBlock ? ENFORCEMENT.CHECKLIST : target,
      ratifiedBy: by,
    });
  });
}

/** Lessons awaiting a human decision — what the management surface must show first. */
export function pending(lessons) {
  return lessons.filter((l) => l.status === STATUS.CANDIDATE && !l.demoted);
}
