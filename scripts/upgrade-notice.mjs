// upgrade-notice.mjs — telling EXISTING users what a new feature release changed, at most once,
// and shutting up the moment they say no.
//
// WHY THIS EXISTS AT ALL. The install conversation only ever reaches people who are installing.
// The owner's correction, 2026-07-22: *"That's only going to help people newly installing. It needs
// to be smart enough when it comes up to say: version 4 is here, here are some things about it, you
// have much more finely grained control, here's how you should install it, and here are your
// choices."* Everyone already running an older build is the majority of the userbase and, before
// this file, the one group the whole conversation could never reach.
//
// WHY IT IS SO CONSERVATIVE. The same session established what this project may not become. A power
// user's verdict, relayed by the owner: *"I can't use your stuff because it has hooks and this and
// that."* And the owner's rule on top of it: *"Nudging somebody is very fair. Forcing them through a
// gate is not."* A notice is a nudge; a notice that returns after being declined is a gate wearing a
// nudge's clothes, and it is worse than a gate because it pretends to be optional. So the anti-nag
// rules here are not politeness, they are the product:
//
//   1. AT MOST ONCE PER MINOR (ADR-027). Patch releases are silent. If the news is not worth a
//      feature-release number, it is not worth interrupting someone's work for.
//   2. A DISMISSAL IS FINAL FOR THAT VERSION. Not snoozed. Not "we'll ask after a restart."
//   3. TWO DISMISSALS IN A ROW AND WE NEVER ASK AGAIN. Two declines is an answer. Continuing to ask
//      past an answer is the coercion the owner rejected, just spread thinly enough to deny.
//   4. ANYTHING WE CANNOT READ MEANS SILENCE. Every unreadable, unparseable, ambiguous or
//      from-the-future state resolves to "say nothing" — never to "ask again to be safe". A bug in
//      this file must cost the user a notice they might have wanted, never a nag they refused.
//      That asymmetry is deliberate and every branch below is written to preserve it.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not install, update, migrate or change one byte of the
// user's setup, and it never implies their current setup is deficient. Somebody deliberately running
// per-project is not misconfigured, and a notice that treats them as a repair job is exactly the
// disrespect the owner warned about: *"All of these additional steps are the difference between
// acting as a good partner and forcing something down somebody's throat, which, even if it's good
// medicine, doesn't feel good."*

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();

/**
 * WHERE THE STATE LIVES — the same directory as user-settings.mjs, for the same checked reason.
 *
 * `--update` overwrites the cache directory entry-by-entry (install.mjs:410) and `--uninstall`
 * rmSync's the whole kb dir (install.mjs:1526), so anything under ~/.cache/ruvnet-brain is transient
 * BY DESIGN. Grepping install.mjs for `.config/ruvnet-brain` returns zero hits — the only program
 * that deletes things cannot see this path.
 *
 * That is load-bearing here in a way it is not for ordinary settings: this state is the record of a
 * user saying "no". If an update wiped it, every upgrade would re-ask everybody who had already
 * declined — the exact nag this file exists to prevent, reintroduced by the update mechanism itself.
 * A refusal that does not survive the next release is not a refusal.
 *
 * Env override matches the RUVNET_LESSON_STORE / RUVNET_SETTINGS_FILE idiom so tests never touch the
 * real user's file.
 */
export const STATE_PATH = process.env.RUVNET_UPGRADE_NOTICE_FILE
  || path.join(HOME, '.config', 'ruvnet-brain', 'upgrade-notice.json');

/** Bumped only when the on-disk shape changes incompatibly. Newer-than-known states go silent, never loud. */
export const STATE_VERSION = 1;

/** Two declines is an answer. Past this many consecutive dismissals we never ask again, about anything. */
export const DISMISSALS_UNTIL_PERMANENT_SILENCE = 2;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Version reading. Never a hardcoded literal anywhere in this file — scripts/sync-version.mjs
// --check fails the build on a stray quoted version, and more importantly a notice that names a
// version in its own source rots the day after it ships. Everything user-visible is derived from
// the string the caller passes in at runtime.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Parse a semver string — bare, `v`-prefixed, or carrying a prerelease suffix — into
 * {major,minor,patch}. Anything else → null, and null means silence everywhere downstream.
 *
 * Note the absence of worked examples in this comment: sync-version.mjs --check greps the whole tree
 * for quoted version literals, and a doc-comment example is indistinguishable from a real hardcoded
 * version to a scanner. It failed this file on exactly that, which is the gate working — an example
 * written today reads as the product's version the day the product reaches it.
 */
export function parseVersion(v) {
  if (typeof v !== 'string') return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * The identity of a FEATURE release: "major.minor". Patch differences are invisible to every
 * comparison in this file, which is rule 1 expressed as a data type rather than as an `if` somebody
 * can forget. A hotfix stream can ship all day without generating a single interruption.
 */
export function minorKey(v) {
  const p = parseVersion(v);
  return p ? `${p.major}.${p.minor}` : null;
}

/** Is `a` a LATER feature release than `b`? Patch is ignored on purpose (see minorKey). */
function isNewerMinor(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return false;
  return x.major !== y.major ? x.major > y.major : x.minor > y.minor;
}

/**
 * Normalize the dismissal ledger, and REFUSE anything we do not recognise.
 *
 * Accepts the three shapes a caller can plausibly hold: absent (the normal state — nobody has ever
 * dismissed anything), a plain count, or a list of records/version strings. Anything else — a string,
 * a bare object, a negative or fractional count, a list containing an entry we cannot read — comes
 * back `ok:false`, and every caller turns that into silence.
 *
 * The refusal is the point. The tempting version coerces junk to zero and carries on, which converts
 * "we lost the record of you declining" into "ask them again". Corrupt state must degrade toward the
 * quiet failure, never the loud one.
 */
function readDismissals(d) {
  if (d === undefined || d === null) return { ok: true, count: 0, versions: [] };

  if (typeof d === 'number') {
    if (!Number.isInteger(d) || d < 0) return { ok: false, count: 0, versions: [] };
    return { ok: true, count: d, versions: [] };
  }

  if (Array.isArray(d)) {
    const versions = [];
    for (const entry of d) {
      if (typeof entry === 'string') versions.push(entry);
      else if (entry && typeof entry === 'object' && typeof entry.version === 'string') versions.push(entry.version);
      // One unreadable entry condemns the whole ledger. It could have been the second dismissal —
      // the one that means "never again" — and guessing wrong in that direction is the failure we
      // are here to prevent.
      else return { ok: false, count: 0, versions: [] };
    }
    return { ok: true, count: versions.length, versions };
  }

  return { ok: false, count: 0, versions: [] };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The decision.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * WHY THIS RETURNS A REASON. Every silence in this file is a deliberate choice, and a surface that
 * cannot say WHICH choice it made cannot be audited — it looks identical to a surface that is simply
 * broken. Same argument as loadSettings() returning an envelope: "the user declined" and "we could
 * not read the file" are different facts and must never collapse into one.
 *
 * `dismissals` is the CONSECUTIVE-dismissal ledger, not a lifetime total. recordActed() clears it,
 * so "twice in a row" is enforced by what the writer stores rather than by date arithmetic the
 * reader would have to guess at. Someone who declines one release, acts on the next, then declines
 * again has not refused twice in a row and is not silenced.
 */
export function explainDecision(installedVersion, lastNotifiedVersion, dismissals) {
  const installed = parseVersion(installedVersion);
  if (!installed) {
    // We cannot name the release, so we cannot honestly describe it. Saying nothing beats saying
    // something vague — house rule: the product can never lie, and "a new version is here" without
    // being able to say which is a claim we cannot support.
    return { notify: false, reason: 'unreadable-installed-version' };
  }

  const led = readDismissals(dismissals);
  if (!led.ok) return { notify: false, reason: 'unreadable-dismissal-history' };

  if (led.count >= DISMISSALS_UNTIL_PERMANENT_SILENCE) {
    return { notify: false, reason: 'declined-twice-permanent-silence' };
  }

  const key = minorKey(installedVersion);

  // Belt AND braces with the lastNotified check below, and not redundantly so: these are two
  // separate writes. A process killed between "append the dismissal" and "stamp lastNotified"
  // leaves a ledger that remembers the refusal and a stamp that does not. The refusal wins.
  if (led.versions.some((v) => minorKey(v) === key)) {
    return { notify: false, reason: 'already-declined-this-release' };
  }

  if (lastNotifiedVersion === undefined || lastNotifiedVersion === null || lastNotifiedVersion === '') {
    // Never told this user about anything. This is the state every EXISTING user is in the first
    // time they run a build containing this file — precisely the audience the owner asked for.
    // A brand-new install is NOT meant to land here: bin/install.mjs seeds the state with
    // markAsAlreadyNotified() so nobody is handed "here's what changed" about software they just
    // chose and configured thirty seconds ago.
    return { notify: true, reason: 'never-notified' };
  }

  if (!parseVersion(lastNotifiedVersion)) {
    // We hold something, but cannot tell what we already said. We cannot prove we have not already
    // asked, so we do not ask. Silence on doubt, always.
    return { notify: false, reason: 'unreadable-last-notified' };
  }

  if (!isNewerMinor(installedVersion, lastNotifiedVersion)) {
    // Same feature release (patch bumps included), or older — a rollback is not news. Either way
    // there is nothing here they have not already been offered once.
    return { notify: false, reason: 'no-new-feature-release' };
  }

  return { notify: true, reason: 'new-feature-release' };
}

/** Should we say anything at all? The whole contract in one boolean. */
export function shouldNotify(installedVersion, lastNotifiedVersion, dismissals) {
  return explainDecision(installedVersion, lastNotifiedVersion, dismissals).notify;
}

/** Same decision, driven off a loaded state envelope. An unhealthy or from-the-future state is silent. */
export function shouldNotifyFromState(installedVersion, state) {
  if (!state || typeof state !== 'object') return false;
  if (state.healthy === false || state.fromFuture === true) return false;
  return shouldNotify(installedVersion, state.lastNotifiedVersion, state.dismissals);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The words.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * THE NOTICE. Plain text, no ANSI, no markdown — the identical bytes have to read correctly in a
 * terminal, in the console page, and in a test assertion, and a string that renders three ways is a
 * string that drifts three ways.
 *
 * FOUR THINGS IT HAS TO DO, and one it has to never do:
 *
 *   · Name what changed in language that survives a non-expert reading it.
 *   · State the recommended scope AND, in the same breath, that the choice is the user's. The owner
 *     dictated this one close to verbatim and the phrasing below tracks it deliberately: *"Our
 *     strong recommendation is per-user — but we always want YOU to be the arbiter of how things run
 *     on your machine."*
 *   · Give the exact command. Both commands here were read out of this repo before being printed —
 *     `--update` at bin/install.mjs:70 (documented README:41) and `--what-changed` at
 *     bin/install.mjs:80. A notice that tells someone to run a flag that does not exist destroys
 *     more trust than the notice was ever going to earn.
 *   · Say how to make it stop, in the notice itself. An interruption that hides its own off switch
 *     is not offering a choice.
 *
 *   · NEVER imply the current setup is broken. There is no "misconfigured", no "you should have",
 *     no "fix" anywhere in this copy, and a unit test enforces that against a blocklist. Someone
 *     running per-project on purpose made a decision; telling them it was a mistake is how you lose
 *     the exact power users this release is trying to win back.
 *
 * NO NUMBERS. Not one count, percentage or total appears here, because this string is composed
 * without touching the machine and any figure in it would therefore be fabricated. The house rule is
 * absolute: every number shown is derived at runtime, so a surface that cannot derive shows none.
 * `--what-changed` is offered precisely so the real, measured picture comes from the tool that
 * actually looks.
 *
 * @returns {string|null} the notice, or null for a version we cannot name (see explainDecision).
 */
export function noticeFor(version) {
  const v = parseVersion(version);
  if (!v) return null;

  const release = `${v.major}.${v.minor}`;   // derived, never a literal — see the header note

  return [
    `RuvNet Brain ${release} is here, and the headline is that more of it is yours to decide.`,
    ``,
    `What changed, plainly:`,
    ``,
    `  · The pieces are separate, and each one has a name. The brain itself (the searchable`,
    `    corpus of rUv's work), the search tool Claude calls, the hooks, the skills and the`,
    `    console are distinct parts. Any one of them runs perfectly well without the others.`,
    `    Take only the brain if that is all you want — that path is supported, not a fallback.`,
    ``,
    `  · Guidance leans, it does not shove. Where an earlier build would try to stop an action`,
    `    outright, it now tells you what it found and leaves the call to you. The few places`,
    `    that still stop anything are ones you switch on yourself, by name.`,
    ``,
    `  · Finer-grained control over which parts run, and where they run.`,
    ``,
    `Where it runs, and who decides:`,
    ``,
    `  Normally this happens on a per-user basis, which lets learning, intelligence, access and`,
    `  software versions stay updated universally across all your projects. Only choose`,
    `  per-project if this is something you absolutely only use on a per-project basis.`,
    ``,
    `  Our strong recommendation is per-user — but we always want YOU to be the arbiter of how`,
    `  things run on your machine. Both are fully supported, and if you already run it`,
    `  per-project on purpose, that keeps working exactly as it does today.`,
    ``,
    `The command:`,
    ``,
    `  npx ruvnet-brain@latest --update`,
    ``,
    `  Prefer to look first? npx ruvnet-brain --what-changed lists every piece currently on this`,
    `  machine and where each one lives. It reads; it changes nothing.`,
    ``,
    `You will see this at most once per feature release. Dismiss it and this release goes quiet.`,
    `Dismiss twice and it stops asking altogether — two declines is an answer, and we will take it.`,
    ``,
    `Tell us how this lands: https://github.com/stuinfla/ruvnet-brain/discussions`,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The state on disk.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const emptyState = (file) => ({
  path: file, exists: false, healthy: true, fromFuture: false,
  lastNotifiedVersion: null, dismissals: [],
});

/**
 * LOAD — an envelope, never a bare object, so callers can distinguish "nobody has been notified yet"
 * from "we could not read whether they have". Those are opposite instructions and collapsing them
 * would make a corrupt file indistinguishable from a fresh one, i.e. it would nag.
 *
 * On corrupt bytes this sets `healthy:false` AND replaces `dismissals` with a shape readDismissals()
 * rejects. That belt-and-braces is intentional: a caller who forgets to check `healthy` and passes
 * the fields straight into shouldNotify() still gets silence. There is no path through this module
 * where unreadable state produces an interruption.
 */
export function loadNoticeState(file = STATE_PATH) {
  const state = emptyState(file);

  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch { return state; }   // no file yet is the NORMAL state, not a fault — empty-first

  state.exists = true;

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch {
    state.healthy = false;
    state.dismissals = { unreadable: true };   // deliberately un-normalizable; see the note above
    return state;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    state.healthy = false;
    state.dismissals = { unreadable: true };
    return state;
  }

  if (typeof parsed.version === 'number' && parsed.version > STATE_VERSION) {
    // Written by a build newer than this code. Their real answers are in there and readable by the
    // version that wrote them; we neither reinterpret nor overwrite. Silent until that build runs
    // again — the safe direction, as always.
    state.fromFuture = true;
    state.dismissals = { unreadable: true };
    return state;
  }

  if (typeof parsed.lastNotifiedVersion === 'string') state.lastNotifiedVersion = parsed.lastNotifiedVersion;
  else if (parsed.lastNotifiedVersion != null) state.healthy = false;   // present but not a string

  if (Array.isArray(parsed.dismissals)) state.dismissals = parsed.dismissals;
  else if (parsed.dismissals != null) { state.healthy = false; state.dismissals = { unreadable: true }; }

  return state;
}

/** Write the state atomically, backing up unreadable bytes rather than deleting them silently. */
function writeState(file, next) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  fs.renameSync(tmp, file);   // rename is atomic on the same filesystem: no half-written refusal
  return next;
}

/**
 * Every writer funnels through here so the refuse-vs-recover rule is stated once.
 *
 *   fromFuture → REFUSE. The file is intact and full of a newer build's real answers. Writing would
 *                delete live data to record something we could just as well record later.
 *   corrupt    → RECOVER. Those answers are already gone; refusing would strand the user with a
 *                broken file forever and no way back. Back up the wreckage, write a clean file.
 *
 * This is the same distinction user-settings.loadSettings() draws, and it is drawn here for the same
 * reason: "can we still recover their intent?" is the question, not "can we parse it?"
 */
function mutate(file, fn) {
  const state = loadNoticeState(file);
  if (state.fromFuture) return { ok: false, reason: 'state-written-by-newer-version', state };

  if (state.exists && state.healthy === false) {
    try { fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`); } catch { /* best effort; never fatal */ }
  }

  const base = {
    version: STATE_VERSION,
    lastNotifiedVersion: state.healthy ? state.lastNotifiedVersion : null,
    dismissals: state.healthy && Array.isArray(state.dismissals) ? state.dismissals : [],
  };
  return { ok: true, state: writeState(file, fn(base)) };
}

/** Record that the notice for `version` was actually SHOWN. Call it when it renders, not when it is composed. */
export function recordNotified(version, file = STATE_PATH) {
  return mutate(file, (s) => ({ ...s, lastNotifiedVersion: version, lastNotifiedAt: new Date().toISOString() }));
}

/**
 * Record a decline. Appends to the consecutive-dismissal ledger AND stamps lastNotified, so either
 * write surviving on its own is still enough to keep us quiet about this release.
 */
export function recordDismissal(version, file = STATE_PATH) {
  return mutate(file, (s) => ({
    ...s,
    lastNotifiedVersion: version,
    dismissals: [...s.dismissals, { version, at: new Date().toISOString() }],
  }));
}

/**
 * Record that the user ACTED on a notice — ran the update, opened the choices, engaged at all.
 * Clearing the ledger here is what makes rule 3 mean "twice in a row" instead of "twice ever".
 * Someone who declines one release, acts on the next, then declines again has not refused twice
 * running, and treating them as though they had would silence a user who is plainly still listening.
 */
export function recordActed(version, file = STATE_PATH) {
  return mutate(file, (s) => ({ ...s, lastNotifiedVersion: version, dismissals: [], actedAt: new Date().toISOString() }));
}

/**
 * Seed a FRESH INSTALL as already-notified: no dismissal, no interruption, just a stamp saying this
 * release has had its conversation. Without this, a brand-new user finishes the install wizard and
 * is immediately told "here's what changed and here's how to choose" about choices they made ninety
 * seconds ago — which reads as software that was not paying attention.
 */
export function markAsAlreadyNotified(version, file = STATE_PATH) {
  return mutate(file, (s) => ({ ...s, lastNotifiedVersion: version }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// CLI. `--dismiss` ships in the same commit as the notice on purpose: this repo's standing rule is
// that anything which can interrupt you must ship its own off switch (ADR-027 §2, generalised —
// detection without a remedy is prohibited). A notice you cannot turn off is not a nudge.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('upgrade-notice.mjs')) {
  const argv = process.argv.slice(2);
  const flagValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  // The version is passed in, never read from a literal here — this file has no opinion about which
  // release it is describing, which is why it does not rot.
  const version = flagValue('--version') || process.env.RUVNET_BRAIN_VERSION;

  if (!version) {
    console.log('usage: node scripts/upgrade-notice.mjs --version <installed-version> [--dismiss|--acted|--seed]');
    process.exit(2);
  } else if (argv.includes('--dismiss')) {
    recordDismissal(version);
    console.log('Noted — you will not be asked about this release again.');
  } else if (argv.includes('--acted')) {
    recordActed(version);
  } else if (argv.includes('--seed')) {
    markAsAlreadyNotified(version);
  } else {
    const state = loadNoticeState();
    if (shouldNotifyFromState(version, state)) {
      console.log(noticeFor(version));
      recordNotified(version);
    } else if (argv.includes('--why')) {
      // Only on request: explaining a silence unprompted would itself be an interruption.
      console.log(`silent: ${explainDecision(version, state.lastNotifiedVersion, state.dismissals).reason}`);
    }
  }
}
