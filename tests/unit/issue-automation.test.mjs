// tests/unit/issue-automation.test.mjs — the 2026-07-24 incident, pinned as regressions.
//
// Four issues (#38/#39/#41/#42) sat 28h with zero pages while the auto-fixer posted 22 public
// failure comments on #38 alone. Three mechanisms, each tested here against the exact broken
// behavior that shipped:
//   1. issue-watch counted the fixer's bot comments (posted through the owner's gh auth) as "the
//      owner responded" — silencing every SLA page.
//   2. issue-fix's attempt-start state write was a fresh object, erasing failureCommentAt each
//      run — so the failure-comment dedup NEVER operated.
//   3. No circuit breaker: a fixer that failed 20+ times kept retrying (and posting) forever.
// Every "fixed" case below has a paired known-bad assertion so the test fails on the old code —
// a guard that cannot fail on broken code is not a guard.

import { describe, it, expect } from 'vitest';
import { judgeIssue, BOT_MARKER } from '../../scripts/issue-watch.mjs';
import { isEligible, attemptStartRecord } from '../../scripts/issue-fix.mjs';

const H = 3_600_000;
const NOW = Date.parse('2026-07-24T20:00:00Z');
const issueAgedHours = (h) => ({ number: 38, createdAt: new Date(NOW - h * H).toISOString(), title: 't' });
const botComment = { author: { login: 'stuinfla' }, body: `${BOT_MARKER} (issue-fix.mjs) — a human reviews before anything merges.\n\nStatus: ...` };
const humanOwnerComment = { author: { login: 'stuinfla' }, body: 'Thanks — looking at this now.' };
const contributorComment = { author: { login: 'sparkling' }, body: 'Any update?' };

describe('issue-watch judgeIssue — a bot comment is not an owner response', () => {
  it('KNOWN-BAD pinned: 5h-old issue whose ONLY owner comment is bot-marked IS a breach', () => {
    // The old predicate (any stuinfla comment) returned breach=false here — that exact judgment
    // muted every page for 28h. If this assertion ever flips, the alarm-silencer is back.
    const r = judgeIssue(issueAgedHours(5), [botComment], NOW);
    expect(r.ownerComment).toBe(false);
    expect(r.breach).toBe(true);
  });

  it('a real human owner comment still satisfies the SLA', () => {
    const r = judgeIssue(issueAgedHours(5), [botComment, humanOwnerComment], NOW);
    expect(r.ownerComment).toBe(true);
    expect(r.breach).toBe(false);
  });

  it('a contributor comment never satisfies the SLA (issue #12 rule, unchanged)', () => {
    const r = judgeIssue(issueAgedHours(5), [contributorComment], NOW);
    expect(r.breach).toBe(true);
  });

  it('a stranger opening their comment with the marker changes nothing (spoof-safety)', () => {
    const spoof = { author: { login: 'mallory' }, body: `${BOT_MARKER} pretending to be automation` };
    const r = judgeIssue(issueAgedHours(5), [spoof], NOW);
    expect(r.breach).toBe(true); // still unanswered by the owner
  });

  it('inside the SLA window nothing breaches, bot comment or not', () => {
    expect(judgeIssue(issueAgedHours(3), [botComment], NOW).breach).toBe(false);
    expect(judgeIssue(issueAgedHours(3), [], NOW).breach).toBe(false);
  });
});

describe('issue-fix attemptStartRecord — state writes preserve what they do not own', () => {
  it('KNOWN-BAD pinned: failureCommentAt and failCount survive the attempt-start write', () => {
    // The old write was `{ attemptedAt, status: 'running' }` — a fresh object. failureCommentAt
    // died there every run, which is why the "once per 24h" failure comment posted 22 times.
    const prev = { failureCommentAt: '2026-07-23T22:27:45Z', failCount: 7, logPath: '/x' };
    const rec = attemptStartRecord(prev, NOW);
    expect(rec.failureCommentAt).toBe('2026-07-23T22:27:45Z');
    expect(rec.failCount).toBe(7);
    expect(rec.status).toBe('running');
    expect(rec.attemptedAt).toBe(new Date(NOW).toISOString());
  });

  it('first attempt (no prior record) still produces a clean running record', () => {
    const rec = attemptStartRecord(undefined, NOW);
    expect(rec).toEqual({ attemptedAt: new Date(NOW).toISOString(), status: 'running' });
  });
});

describe('issue-fix isEligible — the circuit breaker', () => {
  const attemptedAt = new Date(NOW - 2 * H).toISOString(); // cooldowns comfortably elapsed
  const failedRec = (failCount) => ({ attemptedAt, status: 'failed', outcome: 'timeout-failed', failCount });

  it('KNOWN-BAD pinned: at the failure cap with no issue activity, the fixer STOPS', () => {
    // The old filter had no concept of failCount — this returned true forever (attempt #23…).
    const issue = { number: 38, updatedAt: new Date(NOW - 3 * H).toISOString() };
    expect(isEligible(failedRec(2), issue, NOW)).toBe(false);
  });

  it('below the cap, a failed attempt retries within the hour as before', () => {
    const issue = { number: 38, updatedAt: new Date(NOW - 3 * H).toISOString() };
    expect(isEligible(failedRec(1), issue, NOW)).toBe(true);
  });

  it('new activity on the issue AFTER the last attempt re-arms one more try', () => {
    const issue = { number: 38, updatedAt: new Date(NOW - 1 * H).toISOString() }; // after attemptedAt
    expect(isEligible(failedRec(2), issue, NOW)).toBe(true);
  });

  it('a real success keeps the full 24h cooldown', () => {
    const rec = { attemptedAt, status: 'completed', outcome: 'branch-pushed', failCount: 0 };
    expect(isEligible(rec, { number: 39, updatedAt: attemptedAt }, NOW)).toBe(false);
    expect(isEligible(rec, { number: 39, updatedAt: attemptedAt }, NOW + 25 * H)).toBe(true);
  });

  it('an unseen issue is always eligible', () => {
    expect(isEligible(undefined, { number: 43 }, NOW)).toBe(true);
  });
});
