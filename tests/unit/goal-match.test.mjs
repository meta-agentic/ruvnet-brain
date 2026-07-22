// goal-match.test.mjs — THE SILENCE PROOF.
//
// This suite is inverted on purpose. The happy path is the small table at the bottom; the primary
// artifact is NEGATIVE_PROMPTS, and the assertion that matters is that it produces zero matches.
//
// WHY THAT WAY ROUND. ADR-028 sets the targets asymmetrically and says why: false-alarm rate **0**
// ("one false alarm costs more trust than ten true ones earn"), recall only 0.80. A missed
// suggestion is invisible. A wrong suggestion is indistinguishable from salesmanship, which ADR-027
// names as "the FASTER way to destroy trust". So the expensive failure is the one that gets the
// large table, and a test suite weighted the other way would be testing the wrong product.
//
// NEGATIVE_PROMPTS is built around the specific trap: every word in the capability vocabulary
// (memory, hooks, routing, session, context, pattern, gate, cache, nightly, learning) is a homonym
// whose OTHER meaning is far more common in a developer's prompt. A bag-of-words matcher passes the
// happy-path table and fires on all of these. That exact bug already shipped here once in a
// different costume — a detector that read a CLI's human-readable table and announced "26 hooks off"
// while the learner held 457 trajectories, because it matched a surface pattern and reported the
// match as a fact.

import { describe, test, expect } from 'vitest';

import { matchGoal, classifyGoals, GOALS, CONFIDENCE_FLOOR } from '../../scripts/goal-match.mjs';
import { auditAll } from '../../scripts/capability-registry.mjs';

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────
//
// Every key below is a REAL key from capability-registry.auditAll(); the contract test at the bottom
// proves it, so this fixture cannot quietly drift into describing a machine that does not exist.
// `whatItBuysYou` / `evidence` are abridged — matchGoal only ever quotes them, never parses them.
const ALL_KEYS = [
  'learning-hooks', 'memory-distillation', 'workflow-pattern-learning', 'cheap-model-routing',
  'cross-project-lessons', 'lessons-in-force', 'harness-evolution', 'write-gates',
  'session-capture', 'mcp-servers', 'nightly-refresh',
];

/** Build an audit array with every capability at `base`, then apply per-key overrides. */
function caps(overrides = {}, base = 'on') {
  return ALL_KEYS.map((key) => ({
    key,
    label: key.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    whatItBuysYou: `What ${key} buys you.`,
    scope: 'user',
    state: overrides[key] ?? base,
    evidence: `observed evidence for ${key}`,
  }));
}

/** Everything dormant — the most permissive machine possible, so a [] here is the module's own doing. */
const ALL_OFF = caps({}, 'off');

// ── THE NEGATIVE TABLE — the primary artifact ────────────────────────────────────────────────────
//
// Grouped by WHY each must be silent, because "it returns []" is not a finding; "it returns [] for
// this reason" is what stops the next person weakening the wrong guard.
const NEGATIVE_PROMPTS = [
  // — Homonym traps. Our exact vocabulary, used in its ordinary software sense. These are the ones
  //   a keyword matcher gets wrong, and they are the reason the two-key rule exists. —
  'fix the memory leak in my C++ parser, valgrind says 4MB is lost per run',
  'why does my useEffect hook fire twice on mount in strict mode',
  'write a custom hook that debounces the search input',
  'set up routing for the /admin pages in Next.js',
  'the session cookie expires too early, users get logged out mid-checkout',
  'our nightly build is failing on the ARM runner',
  'add a quality gate to the CI pipeline so coverage cannot drop',
  'how do I cache API responses in Redis with a sensible TTL',
  'the model is overfitting — training loss falls but validation loss climbs',
  'explain the difference between a design pattern and an idiom',
  'my dependencies are out of date, should I run npm outdated first',
  'refactor this reducer to use useContext instead of prop drilling',
  'the garbage collector is thrashing and the heap keeps growing',

  // — Ordinary development work with no overlap at all. If any of these match, something is
  //   catastrophically loose rather than subtly loose. —
  'refactor this function to use async/await instead of promise chains',
  'add a dark mode toggle to the settings page',
  'center a div inside a flex container',
  'write a unit test for the date parser',
  'rename this variable to something clearer',
  'migrate the users table to add a nullable phone column',
  'reduce the bundle size, it is 2.4MB gzipped',
  'explain this regex to me',
  'convert this class component to a function component',
  'why is my docker build so slow',

  // — Unrelated entirely. —
  'what is the capital of France',
  'summarise this article for me',
  'what time is it in Tokyo',

  // — SUBJECT present, INTENT absent. Talking about the assistant is not a goal, and a module that
  //   fires whenever "Claude" appears is a module that fires constantly. —
  'Claude, write me a haiku about the ocean',
  'explain what MCP is and how it works',
  'is ruflo the same thing as claude-flow',
  'what does agentdb store exactly',
  'my AI setup is working well, thanks',

  // — INTENT present, SUBJECT absent. THESE ARE THE ONES THAT KEEP THE TWO-KEY RULE HONEST.
  //
  //   Every prompt below trips at least one real INTENT regex. The only thing standing between it
  //   and a recommendation is the SUBJECT requirement — the prompt is about a form, a socket, a
  //   linter, a query, never about the assistant. Verified by mutation: deleting the subject check
  //   turns this block red. An earlier draft of this table had no such case, so the subject rule
  //   could be removed with the whole suite still green — an untested guard is not defence in
  //   depth, it is superstition, and it was caught here rather than in review. —
  //   The first two are the sharpest: each trips THREE OR MORE intent cues, enough to clear the
  //   floor on intent alone, so nothing but the subject rule keeps them quiet.
  'the import wizard forgets the answers, loses the thread entirely, and starts over from scratch',
  'the CI bot ignores my config, keeps making the same mistake, and I already told the vendor twice',
  'the form forgets the user input when they navigate back',       // forget(s|ting)
  'the websocket loses the thread history on reconnect',           // los(e|es|ing) the thread
  'the setup wizard starts over if you refresh the page',          // starts over
  'this query is expensive, can we add a covering index',          // expensive
  'the logger keeps writing to stdout during tests',               // keeps writing
  'the linter ignores my eslintrc overrides',                      // ignores my
  'the retry loop keeps making the same request twice',            // keeps making / same
  'do not reinvent the wheel here, just use lodash',               // reinvent
  'build a knowledge base feature for our support site',           // knowledge base
  'distill this 40 page document into bullet points',              // distill
  'the container cannot reach our postgres instance',              // cannot reach our
  'the onboarding flow re-explains the same steps to returning users', // re-explain
  'we keep telling the vendor about this bug and nothing changes', // keep telling
  'we keep solving the same problem from scratch every sprint',
  'this is getting expensive, the bill went up again',
  'the team keeps making the same mistake in code review',
  'our documentation is stale and nobody updates it',
  'I have to re-explain the deployment process to every new hire',

  // — SUBJECT present, INTENT present, and STILL WRONG: the user is BUILDING an AI product, not
  //   configuring their own workflow. Every one of these scores above the floor with the veto
  //   removed, which is what makes GLOBAL_VETO load-bearing rather than ornamental. Recommending
  //   "turn on session capture" to someone debugging their own chat app's history handling is the
  //   purest form of the salesmanship failure: on-topic, confident, and useless. —
  //   Auth work, which owns "session" at least as strongly as we do. These two are why the auth
  //   patterns are GLOBAL rather than scoped to the losing-work goal: when they were goal-scoped,
  //   both prompts still fired — suppressing the session goal merely handed the match to the
  //   learning goal via "starts over from scratch every session". A veto that silences one claimant
  //   and leaves ten others holding the same bad match is not a veto.
  'my agent forgets the login state and starts over from scratch every session',
  'my AI assistant forgets everything and starts from scratch once authentication expires each session',

  'my Claude SDK integration forgets the conversation history between requests and starts from scratch every time',
  'in production my agent loses the whole context thread whenever the deployment restarts',
  'the assistant I am building for customers keeps making the same mistake I already told it about in the system prompt',

  // — Building AGAINST an AI API. "Claude" appears, but this is application work, and every one of
  //   our capabilities is about the user's own workflow. Recommending here would be the purest form
  //   of the salesmanship failure: technically on-topic, completely unhelpful. —
  'my Claude API call returns 429, how should I back off',
  'which Claude model should I use in production for my app',
  'the SDK throws on empty content blocks, is that expected',
  'store the api key in an env var or a secret manager for deployment',
];

describe('silence on unrelated prompts — the primary contract', () => {
  test.each(NEGATIVE_PROMPTS)('returns [] for: %s', (prompt) => {
    expect(matchGoal(prompt, ALL_OFF)).toEqual([]);
  });

  // The aggregate assertion. Per-case failures tell you WHICH prompt broke; this one states the
  // property as ADR-028 states it, as a rate, so it cannot be quietly eroded one xfail at a time.
  test('false-positive rate across the whole negative table is exactly 0', () => {
    const fired = NEGATIVE_PROMPTS.filter((p) => matchGoal(p, ALL_OFF).length > 0);
    expect(fired).toEqual([]);
    expect(fired.length / NEGATIVE_PROMPTS.length).toBe(0);
  });
});

// ── Corroboration: one cue is a coincidence ──────────────────────────────────────────────────────
describe('a single cue is never enough', () => {
  // These are ON topic and still silent. That is the design: BASE (0.55) sits below the floor, so a
  // lone intent cue plus a lone subject cue cannot speak. If someone raises BASE to 0.6 to "catch
  // more", these tests are what fail, and they should.
  const BORDERLINE = [
    'Claude keeps forgetting to run the tests',
    'my Claude bill is high this month',
    'the agent ignores my instructions sometimes',
  ];

  test.each(BORDERLINE)('stays silent without corroboration: %s', (prompt) => {
    const scored = classifyGoals(prompt);
    expect(scored.length).toBeGreaterThan(0);              // it DID recognise the topic…
    expect(scored[0].confidence).toBeLessThan(CONFIDENCE_FLOOR); // …and still declined to speak
    expect(matchGoal(prompt, ALL_OFF)).toEqual([]);
  });
});

// ── True positives ───────────────────────────────────────────────────────────────────────────────
//
// ADR-028's falsifiable test for L4: "given a stated task with a known better RuvNet path, the brain
// names that path before the user commits to the worse one."
describe('names the right capability for a clearly stated goal', () => {
  const POSITIVE = [
    {
      prompt: 'I keep having to re-explain my coding standards to Claude in every new project',
      expect: 'cross-project-lessons',
    },
    {
      prompt: 'I already told Claude not to use console.log and it keeps doing it — same mistake three times now',
      expect: 'lessons-in-force',
    },
    {
      prompt: 'Claude forgets everything once the conversation compacts and I start from scratch every time',
      expect: 'session-capture',
    },
    {
      prompt: 'my Claude bill is huge and most of my token spend is just reading files',
      expect: 'cheap-model-routing',
    },
    {
      prompt: 'I have hundreds of notes in agentdb but Claude never recalls any of them, even past decisions',
      expect: 'memory-distillation',
    },
    {
      prompt: 'Claude keeps writing raw SQL and I only catch it in review',
      expect: 'write-gates',
    },
    {
      prompt: "I want Claude to read my Notion pages — right now it can't see my notes at all",
      expect: 'mcp-servers',
    },
    {
      prompt: 'my knowledge base is stale and Claude keeps citing the old interface',
      expect: 'nightly-refresh',
    },
    {
      prompt: 'I want to a/b test which version of my CLAUDE.md rules performs better',
      expect: 'harness-evolution',
    },
  ];

  test.each(POSITIVE)('$expect ← $prompt', ({ prompt, expect: key }) => {
    const out = matchGoal(prompt, ALL_OFF);
    expect(out.map((r) => r.capability.key)).toContain(key);
    for (const r of out) expect(r.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
  });
});

// ── The "already on" filter ──────────────────────────────────────────────────────────────────────
describe('never advocates for something already working', () => {
  // A recommendation to switch on what is already on does not merely waste a line — it proves to the
  // reader that we did not look, and every other claim we make is downgraded accordingly.
  test('a perfectly matching prompt yields nothing when every capability is on', () => {
    for (const { prompt } of [
      { prompt: 'I keep having to re-explain my coding standards to Claude in every new project' },
      { prompt: 'Claude forgets everything once the conversation compacts and I start from scratch every time' },
      { prompt: 'I already told Claude not to use console.log and it keeps doing it — same mistake three times now' },
    ]) {
      expect(matchGoal(prompt, caps({}, 'on'))).toEqual([]);
    }
  });

  test('when a goal serves two capabilities, only the dormant one is returned', () => {
    // 'resolving-the-same-problem' serves learning-hooks AND workflow-pattern-learning.
    const prompt = 'Claude solves the same problem from scratch every session and never learns what worked last time';
    const out = matchGoal(prompt, caps({ 'learning-hooks': 'off', 'workflow-pattern-learning': 'on' }, 'on'));
    expect(out.map((r) => r.capability.key)).toEqual(['learning-hooks']);
  });
});

// ── 'unknown' is not 'off' ───────────────────────────────────────────────────────────────────────
describe("'unknown' state is discounted and never described as off", () => {
  // The house rule from capability-registry's own header: "'unknown' is a first-class state, and it
  // outranks 'off' every single time a probe could not run." Surfacing an unknown capability is a
  // guess about the machine stacked on a guess about the goal, so it must clear a higher bar.
  const PROMPT = 'I keep having to re-explain my coding standards to Claude in every new project';

  test('the same prompt speaks when off, and is silent when unknown', () => {
    expect(matchGoal(PROMPT, caps({ 'cross-project-lessons': 'off' }, 'on'))).toHaveLength(1);
    expect(matchGoal(PROMPT, caps({ 'cross-project-lessons': 'unknown' }, 'on'))).toEqual([]);
  });

  test('a strongly corroborated goal may still surface an unknown capability, worded honestly', () => {
    const prompt = 'Claude solves the same problem from scratch every session and never learns what worked last time';
    const out = matchGoal(prompt, caps({ 'learning-hooks': 'unknown' }, 'on'));
    expect(out).toHaveLength(1);
    // THE NON-NEGOTIABLE: 'unknown' must never render as 'off'. This is the "26 hooks off" defect,
    // asserted directly on the sentence the user reads.
    expect(out[0].why).toMatch(/could not be read/);
    expect(out[0].why).not.toMatch(/switched off/);
  });

  test("an 'off' capability's sentence does say switched off", () => {
    const out = matchGoal(PROMPT, caps({ 'cross-project-lessons': 'off' }, 'on'));
    expect(out[0].why).toMatch(/switched off/);
  });
});

// ── The sentence is derived, not written ─────────────────────────────────────────────────────────
describe('every clause of `why` comes from the registry row', () => {
  test('quotes the row label, its whatItBuysYou, and its evidence verbatim', () => {
    const rows = caps({ 'cross-project-lessons': 'off' }, 'on');
    const row = rows.find((r) => r.key === 'cross-project-lessons');
    const [hit] = matchGoal('I keep having to re-explain my coding standards to Claude in every new project', rows);
    expect(hit.why).toContain(row.label);
    expect(hit.why).toContain(row.whatItBuysYou);
    expect(hit.why).toContain(row.evidence);
  });
});

// ── Shape, caps, and hostile input ───────────────────────────────────────────────────────────────
describe('contract and robustness', () => {
  test('returns at most 2 results even when many goals match', () => {
    const kitchenSink = 'Claude forgets everything after the conversation compacts, keeps making the same mistake '
      + 'I already told it about, my token spend is huge and the bill keeps climbing, and I re-explain '
      + 'my standards in every new project';
    const out = matchGoal(kitchenSink, ALL_OFF);
    expect(out.length).toBeLessThanOrEqual(2);
    expect(out.length).toBeGreaterThan(0);
  });

  test('results are sorted by descending confidence', () => {
    const out = matchGoal(
      'Claude forgets everything after the conversation compacts and I re-explain my standards in every new project',
      ALL_OFF,
    );
    const confs = out.map((r) => r.confidence);
    expect([...confs].sort((a, b) => b - a)).toEqual(confs);
  });

  test('each result carries capability, why, and confidence', () => {
    const [hit] = matchGoal('I keep having to re-explain my coding standards to Claude in every new project', ALL_OFF);
    expect(hit).toMatchObject({
      capability: expect.objectContaining({ key: expect.any(String) }),
      why: expect.any(String),
      confidence: expect.any(Number),
    });
  });

  test('never returns the same capability twice', () => {
    for (const prompt of NEGATIVE_PROMPTS.concat([
      'Claude forgets everything after the conversation compacts, keeps making the same mistake I already told it about, and I re-explain my standards in every new project',
    ])) {
      const keys = matchGoal(prompt, ALL_OFF).map((r) => r.capability.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test.each([
    ['empty string', ''],
    ['whitespace', '   \n  '],
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['an object', { prompt: 'hi' }],
  ])('degrades to [] on %s input', (_label, value) => {
    expect(matchGoal(value, ALL_OFF)).toEqual([]);
  });

  test.each([
    ['empty capabilities', []],
    ['null capabilities', null],
    ['not an array', { key: 'x' }],
  ])('degrades to [] with %s', (_label, value) => {
    expect(matchGoal('I keep having to re-explain my standards to Claude in every new project', value)).toEqual([]);
  });

  test('tolerates malformed capability rows without throwing', () => {
    const junk = [null, undefined, {}, { key: 42 }, { key: 'cross-project-lessons', state: 'off' }];
    expect(() => matchGoal('I keep having to re-explain my standards to Claude in every new project', junk)).not.toThrow();
  });

  test('is pure — the same inputs give the same answer and the rows are not mutated', () => {
    const rows = caps({ 'cross-project-lessons': 'off' }, 'on');
    const before = JSON.stringify(rows);
    const p = 'I keep having to re-explain my coding standards to Claude in every new project';
    expect(matchGoal(p, rows)).toEqual(matchGoal(p, rows));
    expect(JSON.stringify(rows)).toBe(before);
  });
});

// ── Grounding: the taxonomy may not invent capabilities ──────────────────────────────────────────
describe('goals are grounded in the real registry', () => {
  // The evangelism failure has a quiet form: a goal for a capability that does not exist, which can
  // only ever produce a recommendation nobody can act on. This binds the taxonomy to reality rather
  // than to a fixture we wrote ourselves.
  const realKeys = new Set(auditAll().map((r) => r.key));

  test('every capability a goal claims to serve exists in auditAll()', () => {
    for (const goal of GOALS) {
      for (const key of goal.serves) {
        expect(realKeys, `goal "${goal.id}" serves unknown capability "${key}"`).toContain(key);
      }
    }
  });

  test('the test fixture describes real capabilities only', () => {
    for (const key of ALL_KEYS) expect(realKeys).toContain(key);
  });

  test('every real capability is reachable by at least one goal', () => {
    // Not a hard product requirement, but an unreachable capability means L4 can never surface it —
    // so if this fails, it should fail loudly and be a deliberate decision rather than an oversight.
    const served = new Set(GOALS.flatMap((g) => g.serves));
    for (const key of realKeys) expect(served, `no goal serves "${key}"`).toContain(key);
  });

  test('runs against the live audit without throwing, and stays silent on an unrelated prompt', () => {
    const live = auditAll();
    expect(matchGoal('center a div inside a flex container', live)).toEqual([]);
    expect(matchGoal('fix the memory leak in my C++ parser', live)).toEqual([]);
  });
});
