// upgrade-notice.test.mjs — the anti-nag contract, proven by execution rather than asserted in prose.
//
// This suite exists because the failure it guards against is invisible in review. Nobody writes a
// nag on purpose; nags are what you get when a "silent" branch quietly resolves the other way — a
// corrupt file coerced to zero, a dismissal lost to a partial write, a patch bump read as a feature
// release. Every one of those looks fine in a diff and reaches the user as software that will not
// take no for an answer, which is the exact behaviour the owner ruled out on 2026-07-22: *"Nudging
// somebody is very fair. Forcing them through a gate is not."*
//
// So the bias under test is asymmetric and deliberate: a bug here must cost a notice somebody might
// have wanted, never produce a prompt somebody already refused. The corrupt-state cases below assert
// exactly that direction, not merely "handles bad input".
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  shouldNotify, explainDecision, noticeFor, minorKey,
  loadNoticeState, shouldNotifyFromState,
  recordNotified, recordDismissal, recordActed, markAsAlreadyNotified,
  STATE_VERSION, DISMISSALS_UNTIL_PERMANENT_SILENCE,
} from '../../scripts/upgrade-notice.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-notice-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

let FILE;
let seq = 0;
beforeEach(() => { FILE = path.join(TMP, `state-${++seq}.json`); });

// Version fixtures are BUILT, never quoted. scripts/sync-version.mjs --check fails the build on any
// quoted major.minor.patch literal that is (or looks like) the product version — so a fixture
// hardcoded as a quoted string here would be a time bomb that goes off the day the product actually
// reaches that number. Interpolation satisfies the gate honestly rather than with an ignore comment.
// (This suite's own first run proved the point: the gate went red on a worked example inside a
// doc comment in the module under test.)
const ver = (major, minor, patch = 0) => `${major}.${minor}.${patch}`;

describe('a feature release is announced exactly once', () => {
  it('an existing user with no history is told — this is the whole point of the file', () => {
    // Everyone already running an older build lands here the first time this code ships. The owner:
    // "That's only going to help people newly installing." This case is the fix for that.
    expect(shouldNotify(ver(4, 0), null, [])).toBe(true);
    expect(explainDecision(ver(4, 0), null, []).reason).toBe('never-notified');
  });

  it('goes quiet for that release once the notice has actually been shown', () => {
    recordNotified(ver(4, 0), FILE);
    expect(shouldNotifyFromState(ver(4, 0), loadNoticeState(FILE))).toBe(false);
  });

  it('patch releases are silent — a hotfix stream never interrupts anyone', () => {
    recordNotified(ver(4, 0), FILE);
    const state = loadNoticeState(FILE);
    for (const patch of [1, 2, 37]) {
      expect(shouldNotifyFromState(ver(4, 0, patch), state)).toBe(false);
    }
    expect(minorKey(ver(4, 0, 37))).toBe(minorKey(ver(4, 0)));
  });

  it('the NEXT feature release is announced again', () => {
    recordNotified(ver(4, 0), FILE);
    expect(shouldNotifyFromState(ver(4, 1), loadNoticeState(FILE))).toBe(true);
  });

  it('a major bump counts as a feature release', () => {
    recordNotified(ver(4, 9), FILE);
    expect(shouldNotifyFromState(ver(5, 0), loadNoticeState(FILE))).toBe(true);
  });

  it('a rollback is not news — going backwards never triggers a notice', () => {
    recordNotified(ver(4, 3), FILE);
    expect(shouldNotifyFromState(ver(4, 1), loadNoticeState(FILE))).toBe(false);
  });

  it('a fresh install is seeded as already-notified, so nobody is told about choices they just made', () => {
    markAsAlreadyNotified(ver(4, 0), FILE);
    const state = loadNoticeState(FILE);
    expect(shouldNotifyFromState(ver(4, 0), state)).toBe(false);
    expect(state.dismissals).toEqual([]);   // seeding is NOT a refusal; the streak must stay empty
  });
});

describe('one dismissal ends the conversation for that release', () => {
  it('never asks again about the release that was declined', () => {
    recordDismissal(ver(4, 0), FILE);
    const state = loadNoticeState(FILE);
    expect(shouldNotifyFromState(ver(4, 0), state)).toBe(false);
    expect(shouldNotifyFromState(ver(4, 0, 5), state)).toBe(false);
  });

  it('the dismissal alone silences the release even if the lastNotified stamp was lost', () => {
    // A process killed between the two writes leaves the ledger remembering the refusal and the
    // stamp not. The refusal has to win, or a crash turns into a re-prompt.
    expect(shouldNotify(ver(4, 0), null, [{ version: ver(4, 0), at: 'x' }])).toBe(false);
    expect(explainDecision(ver(4, 0), null, [ver(4, 0)]).reason).toBe('already-declined-this-release');
  });

  it('but ONE decline is not a life sentence — the next release may still be offered', () => {
    // Declining one release is a statement about that release. Reading it as "never speak again"
    // would be us deciding they meant more than they said.
    recordDismissal(ver(4, 0), FILE);
    expect(shouldNotifyFromState(ver(4, 1), loadNoticeState(FILE))).toBe(true);
  });
});

describe('two declines in a row is an answer, and we take it', () => {
  it('after two consecutive dismissals nothing is ever offered again', () => {
    recordDismissal(ver(4, 0), FILE);
    recordDismissal(ver(4, 1), FILE);
    const state = loadNoticeState(FILE);
    for (const v of [ver(4, 2), ver(5, 0), ver(9, 9), ver(42, 1)]) {
      expect(shouldNotifyFromState(v, state)).toBe(false);
    }
    expect(explainDecision(ver(9, 9), null, state.dismissals).reason).toBe('declined-twice-permanent-silence');
  });

  it('the threshold is two, and the constant says so', () => {
    expect(DISMISSALS_UNTIL_PERMANENT_SILENCE).toBe(2);
    expect(shouldNotify(ver(9, 9), null, 1)).toBe(true);    // one decline: still listening
    expect(shouldNotify(ver(9, 9), null, 2)).toBe(false);   // two: done
    expect(shouldNotify(ver(9, 9), null, 99)).toBe(false);
  });

  it('"in a row" means in a row — acting on a notice resets the streak', () => {
    // Someone who declines, engages, then declines again has not refused twice running. Silencing
    // them would cut off a user who is demonstrably still listening.
    recordDismissal(ver(4, 0), FILE);
    recordActed(ver(4, 1), FILE);
    recordDismissal(ver(4, 2), FILE);
    expect(loadNoticeState(FILE).dismissals).toHaveLength(1);
    expect(shouldNotifyFromState(ver(4, 3), loadNoticeState(FILE))).toBe(true);
  });
});

describe('unreadable state degrades to SILENCE, never to nagging', () => {
  const silentFor = (state) => {
    // Both doors: the envelope-aware caller AND a careless caller who passes the fields straight
    // through. Neither may produce an interruption.
    expect(shouldNotifyFromState(ver(9, 9), state)).toBe(false);
    expect(shouldNotify(ver(9, 9), state.lastNotifiedVersion, state.dismissals)).toBe(false);
  };

  it('a truncated / non-JSON file goes quiet instead of resetting to "ask them again"', () => {
    fs.writeFileSync(FILE, '{"lastNotifiedVersion": "4.0');
    const state = loadNoticeState(FILE);
    expect(state.healthy).toBe(false);
    silentFor(state);
  });

  it('JSON that is not an object goes quiet', () => {
    for (const junk of ['[]', '"nope"', 'null', '17']) {
      fs.writeFileSync(FILE, junk);
      silentFor(loadNoticeState(FILE));
    }
  });

  it('a dismissals field of the wrong type goes quiet', () => {
    fs.writeFileSync(FILE, JSON.stringify({ version: STATE_VERSION, dismissals: 'lots' }));
    silentFor(loadNoticeState(FILE));
  });

  it('state written by a NEWER build goes quiet and is never overwritten', () => {
    const future = { version: STATE_VERSION + 1, somethingWeDoNotUnderstand: true };
    fs.writeFileSync(FILE, JSON.stringify(future));
    const state = loadNoticeState(FILE);
    expect(state.fromFuture).toBe(true);
    silentFor(state);

    // Their real answers live in that file. Refusing to write is what keeps them.
    expect(recordNotified(ver(9, 9), FILE).ok).toBe(false);
    expect(JSON.parse(fs.readFileSync(FILE, 'utf8'))).toEqual(future);
  });

  it('a corrupt file is recoverable — the wreckage is backed up, not silently deleted', () => {
    // Refusing to write here would strand the user with a broken file forever. Their answers are
    // already gone, so there is nothing left for a refusal to protect. Recover, but keep the bytes.
    fs.writeFileSync(FILE, 'not json at all');
    expect(recordDismissal(ver(4, 0), FILE).ok).toBe(true);
    expect(loadNoticeState(FILE).healthy).toBe(true);
    expect(fs.readdirSync(TMP).some((f) => f.startsWith(`${path.basename(FILE)}.corrupt-`))).toBe(true);
  });

  it('every unrecognised dismissals shape is refused rather than coerced to zero', () => {
    // Coercing junk to 0 is the single most likely way a nag gets reintroduced: it silently converts
    // "we lost the record of you declining" into "ask them again".
    for (const junk of ['2', {}, -1, 1.5, NaN, true, [{}], [null], [42], [{ at: 'x' }]]) {
      expect(shouldNotify(ver(9, 9), null, junk)).toBe(false);
    }
    // One unreadable entry condemns the ledger — it could have been the second decline.
    expect(shouldNotify(ver(9, 9), null, [ver(4, 0), { junk: true }])).toBe(false);
  });

  it('an unreadable lastNotified means we cannot prove we have not already asked, so we do not', () => {
    expect(shouldNotify(ver(9, 9), 'sometime-last-tuesday', [])).toBe(false);
    expect(explainDecision(ver(9, 9), 'sometime-last-tuesday', []).reason).toBe('unreadable-last-notified');
  });

  it('a version we cannot name produces neither a decision nor a notice', () => {
    for (const junk of [undefined, null, '', 'latest', 4, {}]) {
      expect(shouldNotify(junk, null, [])).toBe(false);
      expect(noticeFor(junk)).toBeNull();
    }
    // "A new version is here" without being able to say which is a claim we cannot support.
    expect(explainDecision('latest', null, []).reason).toBe('unreadable-installed-version');
  });

  it('an absent file is the NORMAL empty state — quiet is not the same as unreadable', () => {
    const state = loadNoticeState(path.join(TMP, 'does-not-exist.json'));
    expect(state.exists).toBe(false);
    expect(state.healthy).toBe(true);
    expect(shouldNotifyFromState(ver(4, 0), state)).toBe(true);   // this user SHOULD hear about it
  });
});

describe('the copy respects the reader', () => {
  const notice = noticeFor(ver(4, 0));

  it('never implies the current setup is broken or mistaken', () => {
    // Somebody deliberately running per-project made a decision. Telling them it was a mistake is
    // how you lose the exact power users this release is trying to win back — and it is the
    // disrespect the owner named directly: forcing good medicine still does not feel good.
    const accusations = [
      'broken', 'misconfigured', 'incorrect', 'wrong', 'invalid', 'unsupported',
      'you should have', 'fix your', 'outdated', 'deprecated', 'no longer supported',
      'must ', 'required', 'failing', 'problem with your', 'issue with your',
    ];
    for (const word of accusations) {
      expect(notice.toLowerCase()).not.toContain(word);
    }
  });

  it('names what changed in plain language', () => {
    const lower = notice.toLowerCase();
    expect(lower).toContain('what changed');
    // The separability answer the power user actually asked for: "I just loaded the brain and I
    // don't get the rest of it." Taking only the brain has to read as supported, not as a shortfall.
    expect(lower).toContain('separate');
    expect(lower).toContain('without the others');
  });

  it('recommends per-user AND states plainly that the user decides', () => {
    expect(notice).toContain('per-user');
    expect(notice).toContain('per-project');
    expect(notice).toContain('Our strong recommendation is per-user');
    expect(notice).toContain('arbiter');           // the owner's word, kept on purpose
    expect(notice.toLowerCase()).toContain('both are fully supported');
  });

  it('gives the exact command, and both commands really exist in this repo', () => {
    expect(notice).toContain('npx ruvnet-brain@latest --update');
    expect(notice).toContain('npx ruvnet-brain --what-changed');

    // Not a lexical check on the notice — a check that the flags it tells people to run are real.
    // A notice that recommends a flag which does not exist destroys more trust than it earns.
    const installer = fs.readFileSync(path.join(process.cwd(), 'bin', 'install.mjs'), 'utf8');
    expect(installer).toContain("argv.includes('--update')");
    expect(installer).toContain("argv.includes('--what-changed')");
  });

  it('tells the reader how to make it stop, inside the notice itself', () => {
    // An interruption that hides its own off switch is not offering a choice.
    expect(notice.toLowerCase()).toContain('dismiss');
    expect(notice.toLowerCase()).toContain('stops asking');
  });

  it('names the release it is describing, derived from the version passed in', () => {
    expect(notice).toContain(minorKey(ver(4, 0)));
    expect(noticeFor(ver(7, 3))).toContain(minorKey(ver(7, 3)));
    // The text is composed from the runtime argument, so it cannot describe the wrong release.
    expect(noticeFor(ver(7, 3))).not.toContain(minorKey(ver(4, 0)));
  });

  it('quotes no statistics — a string composed without touching the machine cannot have measured anything', () => {
    // House rule: every number shown is derived at runtime, so a surface that derives nothing shows
    // nothing. --what-changed exists precisely so the real picture comes from the tool that looks.
    expect(notice).not.toMatch(/\d+\s*(%|repos|repositories|files|patterns|trajectories|events|projects|users|x faster)/i);
  });
});

describe('the refusal outlives the update that would erase it', () => {
  it('state lives in ~/.config, which the installer has no code path to touch', () => {
    // Verified by execution, not by reading this file's own comment: --update overwrites the CACHE
    // dir entry-by-entry (install.mjs:410) and --uninstall rmSync's it (install.mjs:1526). A "no"
    // stored there would be erased by the very upgrade that then re-asks — the nag loop, delivered
    // by the update mechanism itself.
    const r = spawnSync(process.execPath, [
      '-e', "import('./scripts/upgrade-notice.mjs').then(m => console.log(m.STATE_PATH))",
    ], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, RUVNET_UPGRADE_NOTICE_FILE: '' } });
    const p = r.stdout.trim();
    expect(p).toContain(path.join('.config', 'ruvnet-brain'));
    expect(p).not.toContain('.cache');
  });

  it('a dismissal survives a reload — it is on disk, not in memory', () => {
    recordDismissal(ver(4, 0), FILE);
    const reread = loadNoticeState(FILE);
    expect(reread.dismissals).toHaveLength(1);
    expect(reread.dismissals[0].version).toBe(ver(4, 0));
    expect(shouldNotifyFromState(ver(4, 0), reread)).toBe(false);
  });
});
