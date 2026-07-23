#!/bin/sh
# anticipate.sh — the L4 DELIVERY surface (ADR-028 "Anticipatory"; anti-nag contract from ADR-027).
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHAT THIS IS. A UserPromptSubmit hook that reads the prompt the user is about to send, asks the
# goal matcher whether any DORMANT capability on this machine serves that goal, and — at most once
# per session per capability — says exactly one line about it. Silence is the default and by far the
# common case.
#
# WHY IT EXISTS AS A HOOK AND NOT A PAGE. ADR-028 is blunt about the failure it diagnoses: "The
# console is a page you have to visit. A surface the user must navigate to is a PULL surface.
# Advocacy that waits for you to open it is not proactivity — it is a dashboard with better copy."
# The measured cost of that shape was 21 days between a capability becoming dormant and anyone
# being told, with the data sitting there the whole time. A matcher nothing calls repeats that
# mistake exactly; this file is the thing that calls it.
#
# WHY IT IS SO AGGRESSIVELY QUIET. ADR-027: "Advocacy must not become nagging... a nag trains users
# to ignore the real alarm." ADR-028 fixes a hard precision floor of 0.60 (recommendations acted on
# ÷ recommendations fired) and states that frequency is "a feature with a hard ceiling, not a dial
# to turn up". A hook that speaks too often is a hook people disable, and a disabled hook protects
# nothing — so every ambiguous case in this file resolves to SILENCE, never to speech.
#
# THE FOUR SILENCE RULES, each enforced below and each with a test:
#   1. Only state 'off' ever speaks. NEVER 'unknown' — see the learning-hooks detector in
#      capability-registry.mjs, which reported "26 hooks off" from a CLI's cosmetic table column
#      while the learner held 457 trajectories. 'unknown' means we do not know, and a system that
#      renders not-knowing as a fault is lying. 'absent' is silent too: nothing to switch on.
#   2. No evidence, no speech. A match with no `why` string is dropped, same discipline as
#      console-engine.makeRecommendation() throwing on a recommendation with no evidence/undo.
#   3. Cannot remember → must not speak. If the "already said this" state fails to persist, we
#      stay silent rather than risk repeating on the very next prompt. Forgetting is a nag.
#   4. If in doubt, nothing. Missing module, unparseable payload, odd confidence, matcher naming a
#      capability that is not actually dormant — all silent, all exit 0.
#
# PERFORMANCE. This runs on EVERY prompt, inside a 5s hook budget already partly spent by
# ground-ruvnet.sh. Two guards keep it near-free: a no-node fast path (if the matcher module is not
# on disk, this hook costs one stat and exits — which is the state of the world until goal-match.mjs
# lands), and a hard watchdog that SIGKILLs the single node process. Nothing here can block a turn.
#
# NEVER DAEMONIZES. The registry's own comment records the bill for getting this wrong: one call to
# an earlier auditAll() left a live `node cli.js daemon start --foreground` running and wrote four
# files into HOME. auditAll() is now read-only (it LOCATES ruflo, never executes it), and this hook
# adds no execution of its own — it imports two modules and does filesystem reads.
#
# CONTRACT: always exit 0. stdout on exit 0 is injected verbatim into the model's context, so the
# single line printed here is phrased as an instruction to the model, matching ground-ruvnet.sh.
# The ONLY path this writes to is the state file under ~/.config/ruvnet-brain/.
#
# CLI (the "silence it" instruction we print must actually work — house rule: never render a
# control without a real executor AND a real undo):
#   anticipate.sh --dismiss <capability-key>     stop raising it, permanently   (the executor)
#   anticipate.sh --undismiss <capability-key>   start raising it again         (the undo)
#   anticipate.sh --status                       what is dismissed / said this session
# Kill switch for the whole hook: RUVNET_ANTICIPATE=0
# ─────────────────────────────────────────────────────────────────────────────────────────────────

set +e

SELF_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" 2>/dev/null && pwd)
[ -n "$SELF_DIR" ] || exit 0

# <codeRoot>/plugin/scripts/anticipate.sh → <codeRoot>. Resolved from THIS file's own location, so
# it is correct under the Stable Spine (an immutable ~/.cache/ruvnet-brain/versions/<gen> tree) and
# in a dev checkout alike, without reading active.json — hook-shim.mjs has already chosen the tree
# by the time it executes this body.
CODE_ROOT=$(CDPATH='' cd -- "$SELF_DIR/../.." 2>/dev/null && pwd)
[ -n "$CODE_ROOT" ] || exit 0

# Both module paths are env-overridable, matching the RUVNET_LESSON_STORE / RUVNET_SETTINGS_FILE
# idiom already used across this repo — so tests never load the real registry or touch a real user's
# state, and a future relocation needs no edit here.
GOAL_MATCH="${RUVNET_GOAL_MATCH:-$CODE_ROOT/scripts/goal-match.mjs}"
CAP_REGISTRY="${RUVNET_CAPABILITY_REGISTRY:-$CODE_ROOT/scripts/capability-registry.mjs}"

# ── Subcommands (dismiss/undismiss/status) run the same node program in a different mode ─────────
MODE="suggest"
ARG=""
case "${1:-}" in
  --dismiss)   MODE="dismiss";   ARG="${2:-}"; [ -n "$ARG" ] || { echo "usage: anticipate.sh --dismiss <capability-key>" >&2; exit 0; } ;;
  --undismiss) MODE="undismiss"; ARG="${2:-}"; [ -n "$ARG" ] || { echo "usage: anticipate.sh --undismiss <capability-key>" >&2; exit 0; } ;;
  --status)    MODE="status" ;;
  "") ;;
  *) exit 0 ;;
esac

if [ "$MODE" = "suggest" ]; then
  # Kill switch. Checked before anything else so a user who has switched this off pays nothing.
  case "${RUVNET_ANTICIPATE:-1}" in 0|off|false|no|OFF|FALSE|No) exit 0 ;; esac

  # FAST PATH, and the reason this hook is honestly free today: no matcher on disk, no work at all.
  # Degrading silently on a missing module is also the documented contract with goal-match.mjs.
  [ -f "$GOAL_MATCH" ] || exit 0
  [ -f "$CAP_REGISTRY" ] || exit 0

  EVENT=$(cat 2>/dev/null)
  # A payload this small cannot contain a goal-shaped prompt ("ok", "yes", "continue", or nothing at
  # all). Deliberately a LENGTH test and not a vocabulary test: a keyword prefilter here would be a
  # second matcher that silently drifts from goal-match.mjs, suppressing true matches with no way to
  # notice. Length makes no claim about meaning, so it cannot disagree with the matcher.
  [ "${#EVENT}" -ge 30 ] || exit 0
else
  EVENT=""
fi

# ── The one node process ─────────────────────────────────────────────────────────────────────────
# The program is fed to node on stdin by a QUOTED heredoc, and the payload travels in the
# environment — so no temp file is created anywhere and neither the JS nor the user's prompt is ever
# exposed to shell quoting.
#
# The heredoc goes DIRECTLY to node rather than through `PROG=$(cat <<'JS' ... )`. That indirection
# is what the first version did and it does not survive contact with real JavaScript: inside `$( )`
# the shell keeps parsing, so the backticks of a template literal read as nested command
# substitution and the apostrophes in the comments read as quotes. It failed at parse time with
# "unexpected EOF while looking for matching `'" — before a single line of the hook ran. Fed
# straight to a command, a quoted-delimiter heredoc is genuinely literal, which is the property
# being relied on here.
RUVNET_ANTICIPATE_MODE="$MODE" \
RUVNET_ANTICIPATE_ARG="$ARG" \
RUVNET_ANTICIPATE_EVENT="$EVENT" \
RUVNET_ANTICIPATE_SELF="$SELF_DIR/anticipate.sh" \
RUVNET_GOAL_MATCH="$GOAL_MATCH" \
RUVNET_CAPABILITY_REGISTRY="$CAP_REGISTRY" \
  node --input-type=module 2>/dev/null <<'JS' &
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MODE = process.env.RUVNET_ANTICIPATE_MODE || 'suggest';
const ARG = process.env.RUVNET_ANTICIPATE_ARG || '';
const SELF = process.env.RUVNET_ANTICIPATE_SELF || 'anticipate.sh';

// Same directory, and for the same reason, as user-settings.mjs STORE_PATH and lesson-store's
// STORE_PATH: bin/install.mjs rmSync's ~/.cache/ruvnet-brain on --update and --uninstall, and has
// ZERO code paths that touch ~/.config/ruvnet-brain. The argument for this path is not that it
// feels permanent — it is that the only program which deletes things cannot see it. A "don't say
// this again" promise that a release quietly revokes is worse than never having made it.
const STATE_FILE = process.env.RUVNET_ANTICIPATE_STATE
  || path.join(os.homedir(), '.config', 'ruvnet-brain', 'anticipate-state.json');

const STATE_VERSION = 1;
// Per-capability "once per session" is the ADR-027 rule. This ceiling bounds the WORST case on top
// of it: with eleven capabilities in the registry, "once each" is still eleven interruptions in one
// session, which is a nag by any honest reading of the precision floor.
const MAX_PER_SESSION = 2;
// A matcher that cannot express how sure it is does not get to speak: non-numeric or NaN confidence
// is silence, never a guess dressed as a suggestion.
//
// The NUMBER, though, is the matcher's to own, not this hook's. The first version hardcoded 0.7
// here — and goal-match.mjs publishes `CONFIDENCE_FLOOR = 0.6` and already filters to it, so every
// match it deliberately surfaced between 0.6 and 0.69 was being thrown away by a second, invisible
// threshold that its author could not see or tune. Two thresholds for one decision is how a matcher
// gets "fixed" for a silence it never caused. This reads the matcher's own floor when it exports
// one; the fallback exists only for a module that publishes none.
const FALLBACK_CONFIDENCE_FLOOR = 0.6;
// Nothing the matcher can say should turn one advisory line into a wall of injected context — this
// runs on every prompt and the repo meters that cost for a reason.
const MAX_WHY = 400;
const KEEP_SESSIONS = 20;   // bound the file; sessions are worthless once they end

const out = [];
const quit = () => { if (out.length) process.stdout.write(out.join('\n') + '\n'); process.exit(0); };

function readState() {
  try {
    const j = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    // An unknown or newer on-disk shape degrades to defaults rather than throwing. Worst case we
    // re-offer once; the alternative is a hook that crashes on a file a future version wrote.
    if (j && typeof j === 'object' && j.version === STATE_VERSION) return j;
  } catch { /* absent or unreadable — defaults */ }
  return { version: STATE_VERSION, dismissed: [], sessions: {} };
}

/** Atomic write, entirely INSIDE the config dir. Returns false on any failure — never throws. */
function writeState(st) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    // The temp file is a sibling, not a /tmp entry: this hook's whole footprint must stay inside
    // one directory a user can inspect and delete, and rename() is only atomic within a filesystem.
    const tmp = `${STATE_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(st, null, 2));
    fs.renameSync(tmp, STATE_FILE);
    return true;
  } catch { return false; }
}

const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);

// ── outcome ledger (L5) ─────────────────────────────────────────────────────────────────────────
// Loaded lazily and wrapped: the ledger is an improvement mechanism, never a dependency of the
// thing it measures. If it is missing or throws, advocacy still works and simply learns nothing —
// which is the current state, and is strictly better than a hook that fails because a log failed.
function recordOutcome(action, id, extra) {
  if (!id) return;
  // SYNCHRONOUS BY NECESSITY. The first version did a dynamic import() and fired the record into a
  // promise — but quit() calls process.exit(0), which kills the process before that promise ever
  // resolves. Result: the ledger stayed EMPTY while the code looked correct and every test of the
  // hook passed. Caught only by checking the ledger file itself, which is the one channel capable
  // of observing whether a write happened (L01).
  //
  // The ledger is append-only JSONL, so a synchronous append IS the native operation. The two
  // validity checks record() enforces are replicated here rather than imported, because importing
  // ESM synchronously is not possible and a detached spawn would add latency to every prompt.
  try {
    if (!VALID_ACTIONS.has(action)) return;
    if (typeof id !== 'string' || !id || id.length > 200) return;
    const file = process.env.RUVNET_ADVOCACY_OUTCOMES
      || path.join(os.homedir(), '.config', 'ruvnet-brain', 'advocacy-outcomes.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ id, action, at: new Date().toISOString(), ...(extra || {}) }) + '\n');
  } catch { /* the ledger measures advocacy; it must never break it */ }
}
const VALID_ACTIONS = new Set(['offered', 'applied', 'dismissed', 'ignored']);

// ── dismiss / undismiss / status ────────────────────────────────────────────────────────────────
if (MODE === 'dismiss' || MODE === 'undismiss' || MODE === 'status') {
  const st = readState();
  const dismissed = new Set(strings(st.dismissed));
  if (MODE === 'status') {
    const said = Object.values(st.sessions && typeof st.sessions === 'object' ? st.sessions : {})
      .flatMap((s) => strings(s?.said));
    out.push(`dismissed (never raised again): ${dismissed.size ? [...dismissed].join(', ') : 'none'}`);
    out.push(`raised in recent sessions:      ${said.length ? [...new Set(said)].join(', ') : 'none'}`);
    out.push(`state file:                     ${STATE_FILE.replace(os.homedir(), '~')}`);
    quit();
  }
  // FEED THE OUTCOME LEDGER. Until now advocacy-outcomes.mjs had ZERO callers: a dismissal changed
  // whether we speak, and taught the system nothing about WHETHER WE SHOULD HAVE. That is L5
  // (compounding) with its input disconnected — the ledger could compute precision forever over an
  // empty file. ADR-028 sets precision >= 0.60 as the line between advocating and nagging, and it
  // was unmeasurable because nothing recorded the denominator.
  //
  // Best-effort by construction: a failure here must never break the user's dismiss. Losing one
  // outcome row is a small loss; refusing to silence something the user asked to silence is a
  // large one.
  // ONLY a dismissal is an outcome. --undismiss means "I changed my mind, keep offering it" — it is
  // a correction of a previous signal, NOT evidence the user acted on the suggestion. Recording it
  // as `applied` would inflate precision (applied ÷ offered), which is the metric ADR-028 uses to
  // decide whether we are advocating or nagging. A system that games its own success metric is
  // worse than one with no metric, because the number then actively misleads.
  if (MODE === 'dismiss') recordOutcome('dismissed', ARG);

  if (MODE === 'dismiss') dismissed.add(ARG); else dismissed.delete(ARG);
  st.dismissed = [...dismissed];
  // Report what actually happened on disk. Claiming success on a failed write is the exact
  // "asserted, not derived" failure this project keeps paying for.
  if (!writeState(st)) out.push(`could not write ${STATE_FILE.replace(os.homedir(), '~')} — nothing changed`);
  else if (MODE === 'dismiss') out.push(`dismissed: "${ARG}" will not be raised again (undo: ${SELF} --undismiss ${ARG})`);
  else out.push(`un-dismissed: "${ARG}" can be raised again`);
  quit();
}

// ── suggest ─────────────────────────────────────────────────────────────────────────────────────
let ev = null;
try { ev = JSON.parse(process.env.RUVNET_ANTICIPATE_EVENT || ''); } catch { /* not JSON */ }
if (!ev || typeof ev !== 'object') quit();

const prompt = [ev.prompt, ev.user_prompt, ev.input].find((v) => typeof v === 'string' && v.trim()) || '';
if (prompt.trim().length < 12) quit();

// THE DIAL, ENFORCED (ADR-032 / DDD-0004 "The three channels"). This hook is the ADVOCACY channel —
// unsolicited suggestions — so the user's `advocacy` level governs whether it may speak. Alarms live
// in session-start.sh and bypass this by design; nothing here can silence a broken-brain warning.
// Read the settings file DIRECTLY (no ESM import) so a missing module path can never turn the dial
// into a no-op — the exact failure that left it declared-but-dead. Default is 'important-only' (the
// owner's "recommend on, do not force"): on out of the box for important findings, one setting away
// from silent. Unreadable/absent settings resolve to that same default rather than to unbounded speech.
function advocacyLevel() {
  try {
    const f = process.env.RUVNET_SETTINGS_FILE
      || path.join(os.homedir(), '.config', 'ruvnet-brain', 'settings.json');
    const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
    // user-settings.mjs saveSettings() writes a VERSIONED ENVELOPE: { version, updated, settings:{…} }.
    // Read the nested `.settings.advocacy` FIRST — reading top-level `.advocacy` (which an earlier
    // version did) meant every real save through the console/CLI was invisible here and the dial
    // silently fell back to the default. Keep a top-level fallback for a hand-written/legacy file.
    const v = (parsed && parsed.settings && parsed.settings.advocacy) ?? (parsed && parsed.advocacy);
    return (v === 'off' || v === 'important-only' || v === 'all') ? v : 'important-only';
  } catch { return 'important-only'; }
}
const ADVOCACY = advocacyLevel();
// THE DIAL for this emitter. anticipate produces exactly ONE class of output: a dormant-capability
// nudge that has already cleared a high evidence bar (two independent cues + the matcher's confidence
// floor + once-per-session). Its meaningful dial is therefore off-vs-on: `off` is verifiably silent;
// both `important-only` (the default — the owner's "recommend on") and `all` let the gated nudge
// through. There is NO severity axis to split on here — auditAll()/matchGoal() emit none — so a
// severity gate at this point silences the whole feature at the default (a real regression, caught by
// the dial integration test 2026-07-23 and removed). The `off` gate is the real, honoured control.
if (ADVOCACY === 'off') quit();

// Session identity decides what "once per session" means. Claude Code supplies session_id; when it
// is missing we do NOT fall back to something unbounded (that would make every prompt a fresh
// session and turn this hook into the nag it exists to avoid). A cwd+day key keeps the promise
// bounded — at worst once per capability per project per day — while still being able to fire.
const sid = typeof ev.session_id === 'string' && ev.session_id.trim()
  ? ev.session_id.trim()
  : `fallback:${process.cwd()}:${new Date().toISOString().slice(0, 10)}`;

const st = readState();
const dismissed = new Set(strings(st.dismissed));
const sessions = st.sessions && typeof st.sessions === 'object' ? st.sessions : {};
const said = new Set(strings(sessions[sid]?.said));
if (said.size >= MAX_PER_SESSION) quit();

let auditAll, matchGoal, floor;
try { ({ auditAll } = await import(pathToFileURL(process.env.RUVNET_CAPABILITY_REGISTRY).href)); } catch { quit(); }
try {
  const gm = await import(pathToFileURL(process.env.RUVNET_GOAL_MATCH).href);
  matchGoal = gm.matchGoal;
  floor = gm.CONFIDENCE_FLOOR;
} catch { quit(); }
if (typeof auditAll !== 'function' || typeof matchGoal !== 'function') quit();
const MIN_CONFIDENCE = typeof floor === 'number' && Number.isFinite(floor) ? floor : FALLBACK_CONFIDENCE_FLOOR;

let rows = [];
try { rows = auditAll({ project: process.cwd() }) || []; } catch { quit(); }

// SILENCE RULE 1. 'off' is the only state that has earned a sentence: installed, and switched off.
// 'unknown' is a detector saying it could not tell — advocating on it would be fabricating a fault,
// which is precisely the "26 hooks off" incident. 'absent' means there is nothing to turn on.
const dormant = rows.filter((r) => r && r.state === 'off' && !dismissed.has(r.key) && !said.has(r.key));
if (!dormant.length) quit();

let matches = [];
try { matches = matchGoal(prompt, dormant) || []; } catch { quit(); }
if (!Array.isArray(matches) || !matches.length) quit();

// The matcher is trusted to rank, never to assert existence: every match is re-resolved against the
// dormant rows THIS audit produced. A capability the matcher names that is not dormant right now is
// dropped, so a stale or over-eager matcher can only ever cause silence, never a false claim.
const byKey = new Map(dormant.map((r) => [r.key, r]));
const scored = [];
for (const m of matches) {
  if (!m || typeof m !== 'object') continue;
  const key = typeof m.capability === 'string'
    ? m.capability
    : (m.capability && typeof m.capability.key === 'string' ? m.capability.key : '');
  const row = byKey.get(key);
  if (!row) continue;
  const conf = m.confidence;
  if (typeof conf !== 'number' || !Number.isFinite(conf) || conf < MIN_CONFIDENCE) continue;
  const why = typeof m.why === 'string' ? m.why.trim() : '';
  if (!why) continue;   // SILENCE RULE 2 — no evidence, no speech
  scored.push({ row, why, conf });
}
if (!scored.length) quit();
scored.sort((a, b) => b.conf - a.conf);
const best = scored[0];

// SILENCE RULE 3, and the ordering here is the whole rule: PERSIST FIRST, SPEAK SECOND. Killed
// between the two, we lose one suggestion (silent, harmless). The other order risks speaking
// without recording it, which repeats on the next prompt — and repeating is the failure mode that
// gets hooks switched off for good. Losing a suggestion is cheap; becoming a nag is not.
said.add(best.row.key);
sessions[sid] = { said: [...said], ts: Date.now() };
st.sessions = Object.fromEntries(
  Object.entries(sessions).sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0)).slice(0, KEEP_SESSIONS),
);
st.dismissed = [...dismissed];
if (!writeState(st)) quit();   // cannot remember having spoken → do not speak

// Only real, derived values reach this line: `label`, `whatItBuysYou` and `turnOn` come straight
// off the audited row, `why` from the matcher. Where the registry has no verified command it says
// so in those words — there is no invented one-liner and no fabricated state anywhere in it.
const cmd = best.row.turnOn && typeof best.row.turnOn.cmd === 'string' && best.row.turnOn.cmd.trim()
  ? `turn on with \`${best.row.turnOn.cmd.trim()}\``
  : 'no verified one-line command exists for it — offer to walk them through it';

// DO NOT REPEAT THE PAYOFF. goal-match.mjs's explain() already folds `whatItBuysYou` into its `why`,
// so appending the row's copy of it printed the same sentence twice in one line — which only showed
// up when the hook was first run against the real matcher instead of a fixture. Add it only when the
// matcher has not already said it.
// Cut at the last word boundary inside the cap rather than mid-word ("nothing it discov…" was the
// real output). Falls back to a hard slice when the text has no space to break on.
let why = best.why;
if (why.length > MAX_WHY) {
  const cut = why.slice(0, MAX_WHY);
  const brk = cut.lastIndexOf(' ');
  why = `${(brk > MAX_WHY * 0.6 ? cut.slice(0, brk) : cut).trimEnd()}…`;
}
const buys = typeof best.row.whatItBuysYou === 'string' ? best.row.whatItBuysYou.trim() : '';
const payoff = buys && !why.includes(buys) ? ` It buys them: ${buys}` : '';

// RECORD THE DENOMINATOR. precision = acted-on / OFFERED, and without this line the denominator is
// always zero — the metric ADR-028 uses to separate "advocating" from "nagging" would be
// permanently unmeasurable while appearing to be implemented.
recordOutcome('offered', best.row.key, { severity: best.row.severity || 'normal', scope: best.row.scope });

out.push(`[RuvNet Brain — anticipating] "${best.row.label}" is installed here and switched OFF, and it serves this turn: ${why}${payoff} Offer it ONCE, in one plain sentence (${cmd}), then drop it and get on with the actual work — it will not be raised again. If they decline: ${SELF} --dismiss ${best.row.key}`);
quit();
JS
NODE_PID=$!

# HARD WATCHDOG. Not optional and not a `timeout` binary: macOS ships no `timeout`, and a hook that
# silently depends on coreutils is a hook that hangs on half the machines it runs on. 2s against a
# 5s hook budget that ground-ruvnet.sh has already partly spent. A SIGKILL mid-write can at worst
# truncate one advisory line — it can never fail the turn, and the state file was already committed
# by then (see the persist-first ordering above).
( sleep 2; kill -9 "$NODE_PID" 2>/dev/null ) >/dev/null 2>&1 &
WATCHDOG_PID=$!
wait "$NODE_PID" 2>/dev/null
kill "$WATCHDOG_PID" 2>/dev/null

# ALWAYS. Every failure above already routed to silence; this makes the guarantee unconditional.
exit 0
