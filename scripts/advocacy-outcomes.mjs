// advocacy-outcomes.mjs — the ledger that tells us whether our own advocacy was RIGHT.
//
// THE MISSING HALF. ADR-027 gave the brain a voice: detect a dormant capability, recommend it,
// execute it, reverse it. ADR-028 then defined the honest measure of that voice — precision,
// "recommendations acted on ÷ recommendations fired, target ≥ 0.60. Below this we are nagging, and a
// nag trains users to ignore the real alarm." That number has never been computable, because nothing
// in this system records what happened AFTER a recommendation was shown. Every offer vanished the
// moment the page closed. A system that cannot see its own outcomes cannot improve, and one that
// reports a metric it cannot source is doing the fabrication this repo has a CI gate against.
//
// So: an append-only outcome ledger. Every offer resolves into exactly one record — applied,
// dismissed, or ignored — and those three records are the only evidence any claim about proactivity
// is allowed to rest on.
//
// THE ONE WAY TO FABRICATE THIS METRIC, named here so a reviewer can check for it: record only the
// applies. Precision is applied ÷ (applied + dismissed + ignored), so a caller that forgets to
// record the misses reports a beautiful 1.0. The invariant is therefore not "record outcomes" but
// "every offer produces exactly one record" — and `ignored` is what an unresolved offer becomes when
// the session ends. If you are adding a caller, the ignored-path is the one to write first.
//
// THE ASYMMETRY THIS FILE EXISTS TO ENCODE. The adversarial review of ADR-031 (GPT-5.6-Sol,
// 2026-07-22) killed the previous learning signal with one sentence: "repeat count measures the
// USER'S FRUSTRATION, not the lesson's correctness... a formatting preference corrected 52 times
// dominates a security rule corrected once." A dismissal ledger repeats that mistake exactly if it is
// read as a popularity contest, so it is not read as one here:
//
//     A dismissal is evidence about FIT, not about IMPORTANCE.
//
// "Not for me" and "not worth an interruption" are the same click. So the click cannot be allowed to
// mean the same thing for a cosmetic suggestion and for a corrupt-database warning — a nag dismissed
// once should vanish, and a high-severity finding dismissed once must not. That asymmetry is
// DISMISSAL_BUDGET below, and it is the whole design; the rest is bookkeeping.
//
// STORAGE. `~/.config/ruvnet-brain/` — user-level, and deliberately OUTSIDE `~/.cache/ruvnet-brain/`
// which `--update` replaces wholesale. Same reasoning as lesson-store.mjs: an outcome destroyed by
// the next release never compounds, and compounding (ADR-028 L5) is the only point of any of this.
//
// PURITY: node builtins only, no spawn, no network. It is read by surfaces; it does not render.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();

/**
 * ACTIONS — what became of an offer.
 *
 * The first three are the closed set ADR-028's precision metric is defined over: an offer that was
 * shown ends as exactly one of them. `ignored` is a real, declared value rather than an absence,
 * for the same reason UNDO_KINDS.NONE is one in remedy-registry.mjs: "the user did nothing" and
 * "nobody wrote the code to record it" must never look identical, and the second is what silently
 * inflates precision.
 *
 * RESET is the fourth, and it is here because of a house rule, not because the metric needs it.
 * Dismissal is a control — it makes the brain stop speaking — and this repo does not ship a control
 * without a real inverse (remedy-registry.mjs exists because a recommendation once promised an undo
 * that had no branch behind it, and reported "nothing to undo" instead of failing). Suppression with
 * no way back would be that same dead button pointed at silence. A reset is a CHECKPOINT, never a
 * deletion: the ledger stays append-only and complete, and only the suppression arithmetic starts
 * counting again after it.
 */
export const ACTIONS = Object.freeze({
  APPLIED: 'applied',
  DISMISSED: 'dismissed',
  IGNORED: 'ignored',
  RESET: 'reset',
});
const ACTION_VALUES = new Set(Object.values(ACTIONS));

/** The three that are OFFERS. `reset` is a user action on the ledger, not a recommendation shown. */
const OFFER_ACTIONS = new Set([ACTIONS.APPLIED, ACTIONS.DISMISSED, ACTIONS.IGNORED]);

/**
 * THE ASYMMETRY, as numbers.
 *
 * A `normal` item spends its whole budget on ONE dismissal: the user said no, and for a suggestion
 * that is the end of the conversation. Cheap to honour, and the cost of being wrong is that they
 * miss a nicety.
 *
 * A `high` item costs three, because the cost of being wrong runs the other way. The finding this
 * mechanism will most often suppress is the 2026-07-21 case: a corrupt AgentDB store, detected,
 * scored 49/100, rendered — and the owner had to notice it himself. If one distracted click could
 * bury that class of finding permanently, this file would have shipped a regression dressed as a
 * feature. Three refusals is a considered no; one is a busy hand.
 *
 * IGNORE_WEIGHT prices silence at a fifth of a refusal. Silence is the weakest signal we have — it is
 * consistent with "no", with "later", and with "I never saw the card" — so it may accumulate into
 * suppression (a card ignored fifteen times IS a nag) but it may never be mistaken for an answer.
 *
 * APPLIED_CREDIT lets acting on a recommendation buy back a stretch of ignores, because clicking it
 * is the single strongest evidence of fit we can observe, and a wanted card that fires again when
 * the state recurs is not a nag.
 *
 * HARD_DISMISSAL_CAP is the ceiling above severity: after five explicit refusals nothing re-fires,
 * ever, at any severity, whatever the evidence says. At that point we are wrong about the user, not
 * about the machine — and ADR-028's own anti-goal list puts "interruption without an off switch"
 * beside nagging.
 */
export const DISMISSAL_BUDGET = Object.freeze({ normal: 1, high: 3 });
export const IGNORE_WEIGHT = 0.2;
export const APPLIED_CREDIT = 1;
export const HARD_DISMISSAL_CAP = 5;

/** ADR-028's stated target and the sample floor below which reporting against it would be noise. */
export const PRECISION_TARGET = 0.60;
export const MIN_PRECISION_SAMPLES = 5;

// Field caps. These are a CORRECTNESS property, not tidiness — see appendLine() below: the atomicity
// of a concurrent append depends on each record being one small write. EXPORTED so a test can assert
// the arithmetic that makes the guard in appendLine() unreachable: every field is bounded, and the
// bounds sum to well under MAX_RECORD_BYTES. The guard stays anyway, as the tripwire that fires the
// day somebody raises one of these caps without redoing that sum.
export const MAX_ID = 200;
export const MAX_PROJECT = 120;
export const MAX_HASH = 64;
export const MAX_SEVERITY = 32;
export const MAX_RECORD_BYTES = 1024;

export const OUTCOMES_PATH = process.env.RUVNET_ADVOCACY_OUTCOMES
  || path.join(HOME, '.config', 'ruvnet-brain', 'advocacy-outcomes.jsonl');

/**
 * Severity → the two classes the budget is defined over.
 *
 * Accepts console-engine's vocabulary (`INFO` | `SUGGESTED` | `IMPORTANT`) and lesson-store's
 * (`normal` | `high`), because both produce things that get offered and neither is going to change
 * to suit this file.
 *
 * UNKNOWN SEVERITY RESOLVES TO `normal`, i.e. to the quieter class, and that direction is deliberate.
 * It means a caller that forgets to pass severity gets an item silenced after one dismissal rather
 * than one that is nearly unsilenceable. ADR-028: "One false alarm costs more trust than ten true
 * ones earn. Non-negotiable." When we do not know, we err toward respecting the refusal — and
 * because record() stores the severity it was told, the history stays self-describing rather than
 * quietly re-classified later.
 */
export function weightClass(severity) {
  const s = String(severity ?? '').trim().toLowerCase();
  return (s === 'important' || s === 'high' || s === 'critical') ? 'high' : 'normal';
}

/**
 * A stable fingerprint of the evidence a recommendation was built from.
 *
 * ADR-027's rule is "offered once per state change, dismissible, never re-fires while dismissed" —
 * which is only implementable if "the state" is a value something can compare. This is that value:
 * hash what we OBSERVED, not what we said about it, so rewording a card does not read as new
 * evidence and re-open a settled question.
 *
 * Returns null for no evidence. Null is honest ("we cannot tell whether the state changed") and it
 * is inert by construction: the state-change reprieve in shouldStillOffer() requires a real hash on
 * both sides, so an unknown state can never argue its way past a dismissal.
 */
export function stateHashOf(evidence) {
  const items = (Array.isArray(evidence) ? evidence : [evidence])
    .map((e) => {
      if (e === null || e === undefined) return '';
      if (typeof e === 'object') return String(e.observed ?? JSON.stringify(e));
      return String(e);
    })
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();   // order of evidence is presentation, not state
  if (!items.length) return null;
  return crypto.createHash('sha256').update(items.join(' ')).digest('hex').slice(0, 16);
}

function toIso(at) {
  if (at instanceof Date) return Number.isNaN(at.getTime()) ? new Date().toISOString() : at.toISOString();
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * THE WRITE. One line, one open-with-O_APPEND, one write() — and no read step at all.
 *
 * This repo has already paid for the alternative. saveSettings() did read-modify-write on a JSON
 * object, and MEASURED across 20 trials of four simultaneous writers, at least one setting was lost
 * in 19 of them — every writer returning ok:true, no error, no warning. The fix there was a lock,
 * because a settings file genuinely is a single mutable object.
 *
 * A ledger is not. Append-only removes the read, and with the read goes the entire class of bug:
 * there is no prior value to clobber. That is why this file is JSONL and not a JSON array, and the
 * shape is load-bearing rather than stylistic — an array would reintroduce read-modify-write and
 * with it the 19-in-20 silent loss, on the surface whose only job is to remember what the user chose.
 *
 * The remaining hazard is a partial write interleaving with another process's. POSIX makes the
 * offset-advance-and-write atomic for a single write() on an O_APPEND fd; Node issues one write()
 * for a single small buffer. So the size cap is the guarantee: every field is truncated, and a
 * record that still exceeds MAX_LINE_BYTES is refused rather than written and hoped for. And because
 * a torn line is still conceivable on an exotic filesystem, loadOutcomes() drops unparseable lines
 * instead of failing — one damaged record costs one record, never the ledger.
 */
function appendLine(file, row) {
  const line = JSON.stringify(row) + '\n';
  if (Buffer.byteLength(line) > MAX_RECORD_BYTES) {
    throw new Error(`Outcome for "${row.id}" invalid: record is ${Buffer.byteLength(line)} bytes, over the ${MAX_RECORD_BYTES}-byte cap that keeps a concurrent append atomic`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line);
  return line;
}

/**
 * Record what became of one offer. Append-only; nothing here ever rewrites history.
 *
 * THROWS on a malformed record — same discipline as makeRecommendation() and makeLesson(): an
 * invariant belongs in the constructor, not in a reviewer's memory. An unknown `action` written
 * quietly would corrupt the precision denominator forever, and the wrongness would show up as a
 * plausible number rather than as an error.
 *
 * DOES NOT THROW on an I/O failure — it returns `{ ok: false, reason }`, because callers are
 * surfaces and a read-only home directory must not take down the console. But a caller MUST surface
 * a failed `dismissed`: if the write fails silently, the user's "stop showing me this" does not
 * stick, they see the same card tomorrow, and the off switch has become theatre. That is the exact
 * failure shape as the undo that reported "nothing to undo" — a control that reports success and
 * does nothing.
 *
 * @param {{id:string, action:string, at?:Date|string, project?:string, severity?:string|null,
 *          stateHash?:string|null, scope?:'forever'|null}} spec
 */
export function record(spec, { file = OUTCOMES_PATH } = {}) {
  const {
    id, action, at = new Date(), project = null,
    severity = null, stateHash = null, scope = null,
  } = spec || {};
  const err = (m) => { throw new Error(`Outcome for "${id ?? '?'}" invalid: ${m}`); };

  if (!id || typeof id !== 'string') err('missing id — an outcome that cannot name the recommendation it belongs to measures nothing');
  if (!ACTION_VALUES.has(action)) err(`action must be one of: ${[...ACTION_VALUES].join(', ')}`);
  // `scope:'forever'` is the one-action permanent silence ADR-028 requires ("anything that speaks
  // in-session must be silenceable in one action, permanently, without penalty"). It is meaningless
  // on anything but a dismissal, and accepting it elsewhere would let a stray field mute a card
  // nobody asked to mute.
  if (scope !== null && scope !== 'forever') err(`scope must be null or "forever" (got ${JSON.stringify(scope)})`);
  if (scope === 'forever' && action !== ACTIONS.DISMISSED) err('scope:"forever" is only meaningful on a dismissal');

  const row = {
    v: 1,
    id: id.slice(0, MAX_ID),
    action,
    at: toIso(at),
    // The project is recorded but is NOT a scope — see shouldStillOffer(). It is here so the ledger
    // can answer "where did this happen", which is what ADR-028's L5 test is phrased in terms of.
    project: String(project ?? path.basename(process.cwd())).slice(0, MAX_PROJECT),
    severity: severity === null ? null : String(severity).slice(0, MAX_SEVERITY),
    stateHash: stateHash === null ? null : String(stateHash).slice(0, MAX_HASH),
    scope: scope ?? null,
  };

  try {
    appendLine(file, row);
    return { ok: true, file, row };
  } catch (e) {
    // Over-cap is a programming error and was already thrown by appendLine before any write; an
    // ENOSPC/EACCES/EROFS is the environment. Both arrive here as a receipt so the caller can decide
    // how loud to be, and the reason is preserved rather than flattened to a boolean.
    return { ok: false, reason: e.code || e.message, row };
  }
}

/**
 * Read the ledger. NEVER THROWS — a missing file, a corrupt file, a half-written last line, a file
 * full of someone else's JSON: all of them degrade to "no outcomes yet".
 *
 * This is the same contract lesson-gate.mjs holds itself to and for the same reason: a mechanism
 * that suppresses recommendations must fail toward SPEAKING. If an unreadable ledger threw, or worse
 * returned a partial count that happened to look like a spent budget, a corrupt file would silence
 * the brain — and it would be silent in exactly the way it is silent when everything is healthy, so
 * nobody would ever find out.
 */
export function loadOutcomes(file = OUTCOMES_PATH) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let r;
    try { r = JSON.parse(s); } catch { continue; }   // torn or hand-mangled line: drop it, keep the rest
    if (!r || typeof r !== 'object') continue;
    if (typeof r.id !== 'string' || !r.id) continue;
    if (!ACTION_VALUES.has(r.action)) continue;      // an action we do not understand is not counted as one we do
    out.push({
      v: Number(r.v) || 1,
      id: r.id,
      action: r.action,
      at: typeof r.at === 'string' ? r.at : null,
      project: typeof r.project === 'string' ? r.project : null,
      severity: typeof r.severity === 'string' ? r.severity : null,
      stateHash: typeof r.stateHash === 'string' ? r.stateHash : null,
      scope: r.scope === 'forever' ? 'forever' : null,
    });
  }
  return out;
}

/**
 * The records for one id that the suppression arithmetic is allowed to see: everything appended
 * after the most recent `reset`.
 *
 * ORDERED BY FILE POSITION, NOT BY `at`. The timestamp comes from whichever process wrote it, and a
 * machine with a skewed clock (or a caller passing its own `at`, which record() permits) could
 * otherwise re-order a reset behind the dismissals it was meant to clear — resurrecting a
 * suppression the user explicitly lifted. Append order is the one ordering we actually control.
 */
function liveRecords(id, all) {
  const mine = all.filter((r) => r.id === id);
  let start = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].action === ACTIONS.RESET) { start = i + 1; break; }
  }
  return mine.slice(start);
}

/**
 * What we know about one recommendation.
 *
 * `precision` is null — not 0 — when nothing has been offered yet. This is the repo's oldest live
 * rule: a detector once read a CLI's table and reported "26 hooks off" while the learner held 457
 * trajectories, because unknown rendered as off. A recommendation nobody has seen has an UNKNOWN
 * precision; rendering that as 0.00 would say "this advice is always rejected" about advice that has
 * never been given.
 */
export function outcomesFor(id, { file = OUTCOMES_PATH, all = null, project = null } = {}) {
  let recs = liveRecords(id, all ?? loadOutcomes(file));
  if (project) recs = recs.filter((r) => r.project === project);

  const count = (a) => recs.filter((r) => r.action === a).length;
  const applied = count(ACTIONS.APPLIED);
  const dismissed = count(ACTIONS.DISMISSED);
  const ignored = count(ACTIONS.IGNORED);
  const offered = applied + dismissed + ignored;

  const dismissals = recs.filter((r) => r.action === ACTIONS.DISMISSED);
  const offers = recs.filter((r) => OFFER_ACTIONS.has(r.action));
  const last = offers.length ? offers[offers.length - 1] : null;

  return {
    id,
    applied,
    dismissed,
    ignored,
    offered,
    precision: offered ? +(applied / offered).toFixed(4) : null,
    projects: [...new Set(recs.map((r) => r.project).filter(Boolean))],
    silencedForever: dismissals.some((r) => r.scope === 'forever'),
    lastAction: last?.action ?? null,
    lastAt: last?.at ?? null,
    lastSeverity: [...offers].reverse().find((r) => r.severity)?.severity ?? null,
    lastDismissal: dismissals.length ? dismissals[dismissals.length - 1] : null,
  };
}

/**
 * Should this recommendation be offered again? The question ADR-027 phrases as "dismissible, never
 * re-fires while dismissed".
 *
 * NOT SCOPED BY PROJECT, AND THAT IS THE POINT. A dismissal recorded while working in project A
 * suppresses the same recommendation in project B. This is the falsifiable L5 claim in ADR-028 —
 * "a lesson validated in project A demonstrably changes behaviour in project B" — expressed on the
 * signal we can actually observe today, and it is also just true of the subject matter: these
 * recommendations are about the user's MACHINE (a dormant learner, a corrupt store, a stale install),
 * so per-repo suppression would ask the same person the same question once per checkout.
 *
 * The order of the checks is the safety argument:
 *   1. Never offered  → offer. Silence has to be earned.
 *   2. Silenced forever → never. One action, permanent, no penalty, no severity override. A finding
 *      important enough to argue past an explicit permanent mute does not exist; that argument is
 *      what turns a notification system into spam.
 *   3. Budget by severity class → the asymmetry. A nag dies on one dismissal; a high-severity
 *      finding needs three, so a distracted click cannot bury a corrupt database.
 *   4. State-change reprieve, HIGH SEVERITY ONLY. New evidence re-opens a high-severity question,
 *      because the underlying risk genuinely changed. It does NOT re-open a suggestion: for a nag, a
 *      changed number is not new information worth interrupting a person for, and granting it a
 *      reprieve would let a flapping metric nag forever through a budget it had already spent.
 *   5. HARD_DISMISSAL_CAP overrides even that.
 */
export function shouldStillOffer(id, {
  severity = null, stateHash = null, file = OUTCOMES_PATH, all = null,
} = {}) {
  const o = outcomesFor(id, { file, all });

  if (o.silencedForever) return false;
  if (!o.offered) return true;

  // Severity is DERIVED per offer from evidence measured on this machine (ADR-028: "Severity is
  // derived from measured evidence on this machine. Nothing is IMPORTANT because it would be good
  // for adoption."), so the CURRENT call's severity wins over what history recorded. A capability
  // whose dormancy has become serious must not stay suppressed because it was cosmetic last month.
  const cls = weightClass(severity ?? o.lastSeverity);
  const budget = DISMISSAL_BUDGET[cls];

  // Dismissals count in full; silence counts at a fifth; having actually used it buys credit back.
  // Floor at zero so a long history of applies cannot bank immunity against a later refusal.
  const spend = Math.max(0, o.dismissed + (IGNORE_WEIGHT * o.ignored) - (APPLIED_CREDIT * o.applied));
  if (spend < budget) return true;

  if (o.dismissed >= HARD_DISMISSAL_CAP) return false;
  if (cls === 'high' && stateHash && o.lastDismissal?.stateHash && stateHash !== o.lastDismissal.stateHash) {
    return true;
  }
  return false;
}

/**
 * ADR-028's precision metric: recommendations acted on ÷ recommendations fired. Target ≥ 0.60.
 *
 * A DISMISSAL IS NOT AN ACTION. It is in the denominator and never the numerator, even though the
 * user did click something. Counting it as "acted on" would let us hit target by annoying people
 * into clicking X, which is the precise behaviour the metric exists to catch — the number would rise
 * as the product got worse, and a metric that inverts under pressure is worse than no metric.
 *
 * `precision: null` when nothing has been offered, and `meetsTarget: null` below the sample floor.
 * One rejected offer is not a 0.00 precision rate, and reporting it as one would be the same
 * unknown-rendered-as-a-number failure this repo has a gate against. A grade we have not earned the
 * right to state is stated as "not yet measurable", loudly, in the return value.
 *
 * COUNTS EVERY RECORDED OFFER, INCLUDING BEFORE A RESET. shouldStillOffer() honours the reset
 * checkpoint because that is a user preference about the future; this is a measurement of how the
 * product has actually behaved, and letting a reset launder a bad precision score would make the one
 * number that judges us the one number we can clear.
 */
export function precision({ file = OUTCOMES_PATH, all = null, since = null, id = null } = {}) {
  let recs = (all ?? loadOutcomes(file)).filter((r) => OFFER_ACTIONS.has(r.action));
  if (id) recs = recs.filter((r) => r.id === id);
  if (since) {
    const cut = toIso(since);
    recs = recs.filter((r) => typeof r.at === 'string' && r.at >= cut);
  }

  const count = (a) => recs.filter((r) => r.action === a).length;
  const applied = count(ACTIONS.APPLIED);
  const dismissed = count(ACTIONS.DISMISSED);
  const ignored = count(ACTIONS.IGNORED);
  const offered = applied + dismissed + ignored;

  if (!offered) {
    return {
      precision: null, offered: 0, applied: 0, dismissed: 0, ignored: 0,
      target: PRECISION_TARGET, sufficient: false, meetsTarget: null,
      reason: 'no offers recorded yet — precision is unknown, not zero',
    };
  }

  const value = +(applied / offered).toFixed(4);
  const sufficient = offered >= MIN_PRECISION_SAMPLES;
  return {
    precision: value,
    offered, applied, dismissed, ignored,
    target: PRECISION_TARGET,
    sufficient,
    meetsTarget: sufficient ? value >= PRECISION_TARGET : null,
    reason: sufficient ? null : `only ${offered} offer(s) recorded — below the ${MIN_PRECISION_SAMPLES}-sample floor, so this is not yet judgeable against the target`,
  };
}

/**
 * Every id the ledger knows about, with its derived state. What a management surface renders — and
 * every field is computed from records on disk, never asserted.
 */
export function summarize({ file = OUTCOMES_PATH, all = null } = {}) {
  const recs = all ?? loadOutcomes(file);
  const ids = [...new Set(recs.map((r) => r.id))];
  return ids.map((id) => {
    const o = outcomesFor(id, { all: recs });
    return { ...o, suppressed: !shouldStillOffer(id, { all: recs, severity: o.lastSeverity }) };
  }).sort((a, b) => b.offered - a.offered);
}
