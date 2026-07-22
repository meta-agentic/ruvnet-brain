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

  return Object.freeze({
    id, statement, trigger, enforcement, evidence,
    surface,
    projects: [...projects],
    repeatCount,
    demoted: demoted === true,
    check: check ?? null,
  });
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
