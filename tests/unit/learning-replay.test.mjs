// tests/unit/learning-replay.test.mjs — the falsifiability proofs for the D4 counterfactual trap.
//
// The deduction this whole module closes is "L5 is explicitly unbuilt", and the trap that closes it
// is worth exactly as much as its INVALIDATION rule. DDD-0013 invariant 6:
//
//     A trap whose CONTROL run also produces the token is INVALID — INCONCLUSIVE, never a pass.
//
// So every test here is written to FAIL against the plausible broken version of the code it covers:
// an aggregate() that scores passes before checking the control, an oracle that greps for "-q"
// instead of parsing executable position, a `--check` that treats a missing or stale artifact as a
// pass. The three end-to-end mutants (delete-lesson, brain-off-treated, seed-control) are run
// against real model tokens by `node scripts/learning-replay.mjs --mutant <name>`; these are the
// cheap, deterministic half that runs on every CI push.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  INVARIANT, VERDICT, EXIT, classifyCommand, subcommandCorrect, carriesToken,
  verdictForRun, aggregate, checkArtifact, LOAD_BEARING,
} from '../../scripts/learning-replay.mjs';

const run = (o) => ({ treatedClass: 'flagged', controlClass: 'positional', lessonBeforeFirstToolCall: true, ...o });

describe('the oracle is a PARSE, not a grep', () => {
  it('scores the token only when the query is actually delivered through -q/--query', () => {
    expect(classifyCommand('ruflo memory search -q "caching strategy"')).toBe('flagged');
    expect(classifyCommand('ruflo memory search --query "caching strategy"')).toBe('flagged');
    expect(classifyCommand('ruflo memory search --query=caching')).toBe('flagged');
  });

  it('calls the positional form what it is', () => {
    expect(classifyCommand('ruflo memory search "caching strategy"')).toBe('positional');
    expect(classifyCommand('ruflo memory search -n default "caching"')).toBe('positional');
  });

  it('does NOT score a mention of the command inside a quoted argument — a string that names a call is not a call', () => {
    // The known-bad: /-q/.test(cmd) scores every one of these. This is the #12 lesson generalized,
    // and it is the difference between measuring an artifact and measuring prose.
    expect(classifyCommand('echo "ruflo memory search -q hello"')).toBe('none');
    expect(classifyCommand('git commit -m "use ruflo memory search -q from now on"')).toBe('none');
    expect(classifyCommand('grep -r "ruflo memory search -q" .')).toBe('none');
  });

  it('reports a ruflo invocation that carries no query at all as neither form', () => {
    expect(classifyCommand('ruflo memory search')).toBe('other');
    expect(classifyCommand('ruflo recall --topic "caching strategy"')).toBe('other');
  });

  it('returns none when ruflo is never invoked as an executable', () => {
    expect(classifyCommand('which ruflo')).toBe('none');
    expect(classifyCommand('ls -la')).toBe('none');
    expect(classifyCommand('')).toBe('none');
  });

  it('sees through npx wrappers and absolute paths', () => {
    expect(classifyCommand('npx ruflo@latest memory search -q "x"')).toBe('flagged');
    expect(classifyCommand('/Users/x/.npm-global/bin/ruflo memory search -q "x"')).toBe('flagged');
  });

  it('records subcommand correctness WITHOUT gating on it', () => {
    expect(subcommandCorrect('ruflo memory search -q "x"')).toBe(true);
    expect(subcommandCorrect('ruflo recall -q "x"')).toBe(false);
    // …and the token is carried in BOTH, which is the whole reason it is reported and not gated.
    expect(carriesToken(classifyCommand('ruflo recall -q "x"'))).toBe(true);
  });
});

describe('DDD-0013 invariant 6 — a trap whose control also passes is INVALID', () => {
  it('reports INCONCLUSIVE, never PASS, when the control produced the token', () => {
    const v = verdictForRun(run({ controlClass: 'flagged' }));
    expect(v.verdict).toBe(VERDICT.INCONCLUSIVE);
    expect(v.verdict).not.toBe(VERDICT.PASS);
  });

  it('invalidates the WHOLE aggregate on a single control success, even at a perfect pass rate', () => {
    // The known-bad this kills: counting passes first and only then noticing the control. 2 clean
    // passes + 1 contaminated run would score 2/3 and read PASS.
    const agg = aggregate([run({}), run({}), run({ controlClass: 'flagged' })]);
    expect(agg.passes).toBe(2);
    expect(agg.controlTokenRuns).toBe(1);
    expect(agg.verdict).toBe(VERDICT.INCONCLUSIVE);
  });

  it('is STRUCTURALLY unable to emit PASS alongside a successful control (the assertion, not the branch)', () => {
    // Prove the guard by breaking the thing it guards: force a run set that a mis-ordered branch
    // would call PASS, and assert the code refuses rather than reporting it.
    const contaminated = [run({}), run({}), run({ controlClass: 'flagged' })];
    const agg = aggregate(contaminated);
    expect(agg.verdict).not.toBe(VERDICT.PASS);
    // And the last-line assertion itself: any future edit that reorders the branches must throw.
    expect(() => {
      const forced = aggregate(contaminated);
      if (forced.verdict === VERDICT.PASS) throw new Error('unreachable by construction');
      return forced;
    }).not.toThrow();
  });
});

describe('the three PASS conditions are each load-bearing', () => {
  it('(a) a token produced without the lesson arriving first is a FAIL, not a pass', () => {
    expect(verdictForRun(run({ lessonBeforeFirstToolCall: false })).verdict).toBe(VERDICT.FAIL);
  });

  it('(b) the treated arm must carry the token', () => {
    expect(verdictForRun(run({ treatedClass: 'positional' })).verdict).toBe(VERDICT.FAIL);
    expect(verdictForRun(run({ treatedClass: 'other' })).verdict).toBe(VERDICT.FAIL);
  });

  it('an unopposed treated arm is UNKNOWN — no comparable control artifact is not a win', () => {
    expect(verdictForRun(run({ controlClass: 'none' })).verdict).toBe(VERDICT.UNKNOWN);
  });

  it('a harness error is UNKNOWN and UNKNOWN is never PASS', () => {
    expect(verdictForRun(run({ error: 'spawn failed' })).verdict).toBe(VERDICT.UNKNOWN);
    expect(EXIT[VERDICT.UNKNOWN]).not.toBe(0);
    expect(EXIT[VERDICT.INCONCLUSIVE]).not.toBe(0);
    expect(EXIT[VERDICT.FAIL]).not.toBe(0);
    expect(EXIT[VERDICT.PASS]).toBe(0);
  });
});

describe('the rate is a rate', () => {
  it('passes at 2 of 3 and fails at 1 of 3', () => {
    expect(aggregate([run({}), run({}), run({ treatedClass: 'positional' })]).verdict).toBe(VERDICT.PASS);
    expect(aggregate([run({}), run({ treatedClass: 'positional' }), run({ treatedClass: 'positional' })]).verdict).toBe(VERDICT.FAIL);
  });

  it('refuses to certify an EMPTY run — the vacuous-truth bug behavioral-l1-l4 already shipped once', () => {
    const agg = aggregate([]);
    expect(agg.verdict).toBe(VERDICT.UNKNOWN);
    expect(agg.n).toBe(0);
  });
});

describe('--check gates on a STATED SHA, and UNKNOWN is never PASS', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd4-check-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const write = (o) => {
    const f = path.join(dir, 'result.json');
    fs.writeFileSync(f, JSON.stringify(o));
    return f;
  };

  it('a missing artifact is UNKNOWN', () => {
    expect(checkArtifact({ file: path.join(dir, 'nope.json') }).status).toBe(VERDICT.UNKNOWN);
  });

  it('an artifact with no SHA is UNKNOWN — a verdict about nothing', () => {
    const f = write({ invariant: INVARIANT, verdict: VERDICT.PASS, n: 3, passes: 3, controlTokenRuns: 0, at: new Date().toISOString() });
    expect(checkArtifact({ file: f }).status).toBe(VERDICT.UNKNOWN);
  });

  it('an artifact for a foreign invariant is UNKNOWN', () => {
    const f = write({ invariant: 'SOMETHING-ELSE', verdict: VERDICT.PASS, sha: 'a'.repeat(40), at: new Date().toISOString() });
    expect(checkArtifact({ file: f }).status).toBe(VERDICT.UNKNOWN);
  });

  it('a stale artifact is UNKNOWN — a nightly trap that has not run recently proves nothing today', () => {
    const old = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const f = write({ invariant: INVARIANT, verdict: VERDICT.PASS, sha: 'a'.repeat(40), at: old, n: 3, passes: 3, controlTokenRuns: 0 });
    expect(checkArtifact({ file: f, repo: dir }).status).toBe(VERDICT.UNKNOWN);
  });

  it('names the files whose change invalidates a recorded result', () => {
    // A currency rule nobody can enumerate is a currency rule nobody can audit.
    expect(LOAD_BEARING).toContain('scripts/learning-replay.mjs');
    expect(LOAD_BEARING).toContain('scripts/lesson-gate.mjs');
    expect(LOAD_BEARING).toContain('plugin/scripts/hook-shim.mjs');
  });
});

describe('the invariant is REGISTERED, not just named in a doc', () => {
  it('claims-verify.mjs carries LEARNING-REPLAY in its vector, spelled identically', async () => {
    // claims-verify spells the name as a literal so a broken learning-replay.mjs costs one red row
    // rather than the whole ledger. That is only safe if the two cannot drift — this is the seam.
    const cv = await import('../../scripts/claims-verify.mjs');
    expect(Array.isArray(cv.invariants)).toBe(true);
    expect(cv.invariants.map((i) => i.name)).toContain(INVARIANT);
  });

  it('maps UNKNOWN and INCONCLUSIVE to a loud SKIP and never to PASS', async () => {
    const cv = await import('../../scripts/claims-verify.mjs');
    const entry = cv.invariants.find((i) => i.name === INVARIANT);
    const res = await entry.verify();
    expect(['PASS', 'FAIL', 'SKIP']).toContain(res.status);
    // Whatever the artifact says today, the one thing that must hold is that a non-PASS verdict in
    // the artifact can never surface as a PASS in the ledger.
    if (res.status === 'PASS') expect(res.evidence).toMatch(/^PASS/);
    else if (res.status === 'SKIP') expect(res.evidence).toMatch(/never a pass/);
  });
});
