// correction-detect.mjs — decide whether a user utterance is a BEHAVIOURAL CORRECTION.
//
// This is the missing beginning of the learning pipeline. ADR-033 measured the gap: 14 lessons in
// the store, 14 of them transcribed by hand, 0 captured from a live correction. The middle and the
// end were built (store, trust boundary, gate); nothing ever answered "where does a lesson come
// from?". This module answers exactly that question and nothing else — it is pure, does no I/O,
// reads no transcript, writes no store. It is given one utterance and one piece of context, and it
// returns a candidate or, far more often, null.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NOT THE DETECTOR ADR-033 FIRST DESCRIBED
//
// ADR-033 §1 specifies a conjunction of four signals. Two independent adversarial reviews took that
// specification apart before a line was written, and both were right. The corrections they forced
// are the whole substance of this file:
//
//  • FABLE'S F1 — the load-bearing finding. Signals 2 ("directed at behaviour") and 4 ("negative
//    valence") were specified as semantic-role and sentiment problems with NO lexical realization
//    given, while LLM detection was simultaneously refused — a spec for a deadlock. Worse, a
//    15-utterance hand-walk showed the conjunction as written FIRES on the two classes that
//    dominate a coding transcript:
//
//        "It always crashes when I pass null — fix it."               ← a bug report
//        "Make sure the parser never accepts unquoted keys."          ← spec-speak
//
//    Signal 3 was quantifying over PROGRAM EXECUTIONS and over REQUIREMENTS, not over occasions of
//    agent behaviour, and no stated rule could tell the domains apart. With a 1.2% base rate, the
//    allowed false-positive rate is ~0.07% per turn; requirements dialect natively uses always/never,
//    so that FP class alone buries the detector.
//
//    THE FIX, which is Fable's own (a) and the single most important idea here: Signal 3 does not
//    look for a quantifier. It looks for a quantifier SYNTACTICALLY BOUND TO THE SECOND PERSON —
//    `you always`, `every time you`, `you keep`, `stop <gerund>`, or a quantifier in CLAUSE-INITIAL
//    IMPERATIVE position with nothing but discourse fillers in front of it. "the parser never" has a
//    third-person nominal subject and is refused; "Never just link to the HTML page" has an empty
//    clause prefix and is kept. That one syntactic move is what separates a rule about the agent
//    from a rule about a program, and it is implementable in exactly the lexical terms ADR-033
//    demands.
//
//    Because that same test IS the honest realization of Signal 2 (is the complaint about something
//    the agent did?), signals 2 and 3 are implemented as ONE predicate and said so out loud. Two
//    names for one test would be a claim of independent evidence we do not have — the precise
//    dishonesty lesson-store.mjs was built to refuse elsewhere.
//
//  • SOL'S C5 — the quote must come from the authenticated user utterance, not a reconstruction.
//    `plugin/scripts/ground-ruvnet.sh:19` already reads `.prompt` off the UserPromptSubmit payload;
//    that IS the user's words, structurally labelled as theirs by the harness. Hence the signature:
//    `promptText` is the payload, and `context` carries only what the payload cannot know (what the
//    assistant did immediately before). A transcript is never the source of the words.
//
//  • SOL'S C2 — `makeLesson()` destructures a fixed key list and silently DROPS unknown keys, so
//    every rich evidence field ADR-033 §3 specifies (quote, respondingTo, source, signals) would
//    vanish on the way into the store, leaving the human ratifier with no sentence to read. The one
//    array that passes through whole is `evidence[]`. So everything rides INSIDE evidence[0], and
//    `observed` is populated because `lesson-gate.mjs:75` is what actually prints it.
//
//  • SOL'S C7 + the meta-risk — hypotheticals, delegated instructions ("tell the subagent to
//    always…"), quoted policy, and this repository's OWN design documents (which are wall-to-wall
//    quantified second-person rules) are all live false-positive classes. They are excluded
//    structurally, before any signal is evaluated.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE OPERATING POINT, and why silence is the default
//
// ADR-033 §2 settles the asymmetry with a structural argument, not a preference: a miss costs one
// repetition and is SELF-HEALING (the repeat is itself ADR-030's escalation signal). A false
// positive becomes a candidate, then a ratification prompt, then noise the user learns to skip — and
// at the end of that road it reaches ADR-031 §4's objective function, where a search pursues it
// faithfully and at scale. Recall is a convenience. Precision is a safety property.
//
// So this module returns null on every doubt, and several genuine corrections are knowingly let go.
// The accepted misses are enumerated in ACCEPTED_MISSES below rather than left to be rediscovered —
// under-enumeration being its own recorded failure here (L10).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MEASURED ON THE REAL CORPUS, 2026-07-22 — and what it does NOT prove
//
// Run over this project's 1,299 transcripts (the same corpus ADR-033 measured, and turns nobody
// picked for this purpose):
//
//     user-role turns                 2,768
//     with a preceding agent action   1,451
//     DETECTIONS                          4      0.276% of considered turns
//
// All four hand-classified as genuine durable behavioural corrections, each at a defensible
// trigger. THREE of them independently rediscovered standing orders that a human had already
// transcribed by hand into the project memory index — the clickable-link rule, the scores-out-of-100
// rule, and "never show me a page you haven't gone through and checked visually", which ADR-033 §5
// quotes as its own worked example. That is the 45-standing-orders-vs-14-lessons gap closing by
// mechanism instead of by diligence, which is the entire point of the ADR.
//
// Three earlier revisions were fixed by that corpus rather than by argument, and each fix is
// commented at its site: the temporal-scope double-count, the contentless `stop doing that`, and
// trigger inference reading the whole turn (which filed a status-reporting rule as `ship` because
// "version numbers" appeared two sentences away, about something else).
//
// WHAT THIS DOES NOT ESTABLISH, stated plainly because the gate is a number and this is not it:
//  • ADR-033 §2 requires ≥90% precision on ≥100 detections. n=4. The sample is two orders of
//    magnitude too small to clear that bar, and 4/4 is not "100% precision" in any useful sense.
//  • Recall is very low — 4 found against 45+ known standing orders, roughly 9%. Accepted by §2's
//    argument, but it should be named, not glossed.
//  • The classification is the detector author's own, so it inherits ADR-033 Verification #6's
//    caveat exactly: this has NOT been independently graded.
// The honest status is therefore: the shape is right and the false-positive classes that killed the
// original design are closed, but the shipping gate is NOT cleared.
//
// WHAT THIS CAN NEVER DO. Every returned candidate is `origin: model-inferred`, `status: candidate`,
// unconditionally — INCLUDING when the user's words are quoted verbatim, and including when the
// utterance is a flawless imitation of a correction. ADR-033 §4: `user-stated` means a human
// asserted this rule, not that a string was found which looks like one. An automatic extractor that
// could mint `user-stated` would be the injection path of the original adversarial review,
// industrialised. `confidence` orders the ratification queue and does nothing else — a confidence
// threshold is just ratification with the human removed and the word "confidence" in front of it.

/** Corrections are short. The measured tightened detector used this bound; specs and briefs exceed it. */
export const MAX_UTTERANCE_CHARS = 800;

/** `makeLesson()` refuses a statement under 15 chars ("must say what to DO, specifically"). */
const MIN_STATEMENT_CHARS = 15;

/** Verbatim is the point (ADR-033 §3), but a ratification card must fit on one screen. */
const MAX_STATEMENT_CHARS = 300;
const MAX_QUOTE_CHARS = 600;

/**
 * Genuine corrections this detector KNOWINGLY drops. Written down because "a satisfyingly round
 * number is evidence of rounding" (L10), and because the next person to widen a rule should have to
 * argue against a named cost rather than discover it.
 */
export const ACCEPTED_MISSES = Object.freeze([
  'Recurrence carried only by "again" with no second-person binding — "I asked for a table. This is prose again."',
  'Bare prohibitions with no scope over occasions — "Don\'t do that." (also below the 15-char statement floor)',
  'Purely positive standing orders with no rejection anywhere — "Always give me a table." is indistinguishable from an ordinary instruction or a project convention.',
  'Corrections whose subject matter maps to no trigger in the closed TRIGGERS enum — a lesson that cannot name when it fires is prose, and the store refuses it anyway.',
  'Corrections phrased as a request to write a rule elsewhere — "add to CLAUDE.md that…" — which are authoring tasks, not corrections of the turn.',
  'Corrections that tie across two or more triggers. They fire at more than one moment, and picking one by list order would interrupt at the wrong one.',
]);

// ── HARD EXCLUSIONS ──────────────────────────────────────────────────────────────────────────────
// Applied before any signal. Each entry killed a real false-positive class, named in the comment.

/** Not an utterance at all. The single highest-scoring hit in ADR-033's measurement was one of these. */
const HARNESS_TEMPLATES = [
  /\[Your previous response/i,
  /\[Request interrupted/i,
  /<\/?system-reminder>/i,
  /<\/?(?:command-name|command-message|command-args|local-command-stdout|function_results|function_calls|budget)\b/i,
  /^\s*Caveat:/i,
  /Base directory for this skill:/i,
  /This session is being continued from a previous conversation/i,
  /^\s*#\s*claudeMd\b/im,
  /\[INTELLIGENCE\]/i,
];

/**
 * Pasted content, not speech. Includes markdown structure — this repository's own ADRs and DDDs are
 * dense with quantified second-person rules, so its design documents are a minefield for its own
 * detector (Sol C7, meta-risk). A document is never a correction.
 */
const DOCUMENT_MARKERS = [
  /```/,                       // code fence
  /^\s*(?:\+\+\+|---\s|@@ )/m, // diff
  /^\s*#{1,6}\s+\S/m,          // markdown heading
  /^\s*\|.*\|/m,               // markdown table
  /^\s*[-*•]\s+\S/m,           // bullet list
  /^\s*\d+\.\s+\S/m,           // numbered list
  /^\s*\{\s*"/m,               // JSON blob
  /^\s+at\s+\S+\s*\(/m,        // stack frame
];

/**
 * THE INJECTION KILLER. A real user does not refer to themselves in the third person. Every planted
 * "the user told me to always…" — the exact sentence the original adversarial review used to
 * demonstrate the attack — carries this tell, because it is written ABOUT a user by something that
 * is not one.
 */
const USER_THIRD_PERSON = [
  /\bthe user\b/i,
  /\bthe owner\s+(?:said|told|wants|corrected|asked)/i,
  /\buser\s+(?:told|said|corrected|instructed)\s+(?:me|you|us|the model|the assistant)\b/i,
  /\bper the user\b/i,
  /\bas instructed by\b/i,
];

/** Reported policy. Quoting a rule is not issuing one — "CLAUDE.md already says never pin versions". */
const ATTRIBUTION = [
  /\b(?:says?|said|states?|reads?|specifies|requires|mandates)\b[^.!?]{0,40}?\b(?:always|never)\b/i,
  /\baccording to\b/i,
  /\b(?:CLAUDE\.md|the\s+(?:docs?|readme|adr|rules?|spec|guide|standing order|policy|instructions))\b[^.!?]{0,30}?\b(?:says?|said|states?|tells?)\b/i,
  /\brule\s*\d+\b/i,
];

/** Delegated instruction: the quantified action's subject is a third party, not this agent. */
const DELEGATION = [
  /\b(?:tell|ask|have|make|instruct|remind|get)\s+(?:the\s+|a\s+|an\s+|my\s+|your\s+)?[\w-]+\s+to\s+(?:always|never|not\b)/i,
  /\b(?:add|write|put|append|record|save)\b[^.!?]{0,50}?\b(?:to|in|into)\b[^.!?]{0,25}?(?:CLAUDE\.md|memory|the rules?|a rule|the store|the lessons?)\b/i,
];

/** Spec dialect. "make sure the X never…" is a requirement about an artifact, not about the agent. */
const SPEC_FRAME = /\b(?:make sure|ensure|guarantee)\s+(?:that\s+)?(?:the|a|an|it|this|these|those|my|our|your)\b/i;

/**
 * Third-person subject immediately governing a quantifier. Belt-and-braces behind the clause test:
 * it closes the conjunct leak where "Make sure the parser never accepts unquoted keys AND always
 * preserves order" splits on `and` and hands the second conjunct a clause with an empty prefix.
 * `you` is excluded from the subject set by lookahead — "You never bump the version" must survive.
 */
const THIRD_PERSON_QUANT =
  /\b(?!(?:you)\b)(?:it|they|he|she|we|this|that|these|those|there|[A-Z][\w.'-]*|(?:the|a|an|my|our|its|their|his|her)\s+[\w.'-]+)\s+(?:(?:should|must|shall|will|would|can|could|may|might|does|do|did|is|are|was|were|has|have|had|keeps?|seems?|tends? to)\s+)*(?:always|never)\b/;

/** Hedges and hypotheticals — thinking aloud is not instructing (Sol C7). Applied per sentence. */
const HEDGE =
  /\b(?:maybe|perhaps|possibly|might want|what if|suppose|hypothetically|for example|for instance|e\.?g\.?|imagine|let'?s say|in theory|i wonder|not sure if|thinking out loud|just brainstorming)\b/i;

// ── SIGNAL 3 (+2): A QUANTIFIER BOUND TO THE AGENT ───────────────────────────────────────────────

/** Explicit second-person subject. The quantified occasions are unambiguously the agent's. */
const BOUND_SECOND_PERSON = [
  /\byou\s+(?:always|never|constantly|repeatedly|keep|keep on)\b/i,
  /\byou'?(?:ve|\s+have)\s+(?:always|never|repeatedly|constantly)\b/i,
  /\b(?:every|each|any)\s*time\s+you\b/i,
  /\bwhenever\s+you\b/i,
  /\b(?:second|third|fourth|fifth|sixth|\d+(?:st|nd|rd|th))\s+time\s+(?:you|i'?ve|i have)\b/i,
];

/**
 * `stop <gerund>` is inherently imperative-to-you and is in ADR-033 §1's own Signal 3 list. The
 * gerund requirement is load-bearing: it is what separates "Stop giving me scores out of 10" (a
 * rule) from "Stop and clear it" (the tail of a rant at Vercel, Fable's N4).
 *
 * The PRO-VERB exclusion was added after a corpus run: "Stop doing that." fired, and it is a
 * correction — but `doing`/`being`/`having` carry no transferable content, so the resulting lesson
 * is the literal string "Stop doing that", which would interrupt a future gate with a rule nobody
 * can act on. A statement must carry content beyond the correction frame itself, or it is a
 * deictic pointing at a moment that has already passed.
 */
const STOP_GERUND = /\bstop\s+(?:\w+\s+){0,2}?(?!(?:doing|being|having)\b)\w+ing\b/i;

/**
 * Temporal scope markers. These quantify over future occasions, but say nothing about WHOSE — so
 * they only count when the utterance also addresses the agent (second person, or a clause-initial
 * prohibition). "From now on, close the issue yourself" counts; "From now on the parser should
 * validate input" does not.
 */
const TEMPORAL_SCOPE = /\b(?:from now on|going forward|in (?:the )?future|henceforth|next time)\b/i;
const ADDRESSES_AGENT = /\byou(?:r|rself)?\b/i;

/** Clause boundaries. Splitting on coordinators is why THIRD_PERSON_QUANT exists as a backstop. */
const CLAUSE_SPLIT = /\s*(?:[,;:—–]|\.\.\.|\band\b|\bbut\b|\bso\b|\bthen\b|\byet\b)\s*/i;

/** Discourse material that may precede a genuine imperative without giving it a subject. */
const FILLERS =
  '(?:please|just|also|again|ok|okay|well|right|look|hey|actually|honestly|seriously|by the way|btw|remember|note|and|but|from now on|going forward|in the future|in future|next time)';

/** A quantifier in clause-initial imperative position — nothing but fillers between it and the boundary. */
const CLAUSE_INITIAL_QUANT = new RegExp(
  `^(?:${FILLERS}[\\s,]+)*(always|never(?!\\s*mind)|no longer|no more|constantly|repeatedly)\\b`,
  'i',
);

// ── SIGNAL 4: NEGATIVE VALENCE TOWARD THE AGENT'S ACTION ─────────────────────────────────────────
// A bare positive standing order is refused. "Always use tabs" is indistinguishable from a project
// convention being stated for the first time; a CORRECTION rejects something that already happened.

const VALENCE = [
  ['prohibition', /\b(?:never(?!\s*mind)|don'?t|do not|stop|quit|no longer|no more|cut it out|knock it off)\b/i],
  ['reproach', /\b(?:you keep|you always|i (?:told|asked) you|i already (?:told|asked|said)|you (?:were supposed to|should have|failed to|forgot to|didn'?t)|why (?:did|didn'?t|are|aren'?t) you|(?:second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s+time)\b/i],
  ['rejection', /\b(?:wrong|incorrect|that'?s not|not what i (?:asked|wanted|said)|instead of|rather than|isn'?t what)\b/i],
  ['change-of-behaviour', TEMPORAL_SCOPE],
];

// ── TRIGGER INFERENCE ────────────────────────────────────────────────────────────────────────────
// TRIGGERS is a CLOSED enum in lesson-store.mjs, and deliberately so: gates scale with decision
// types, lessons scale with experience. A correction that maps to no trigger is prose, and the store
// throws on prose — so failing to map is a silence, never a default bucket.
//
// A TIE IS ALSO A SILENCE, and that rule was earned rather than assumed. Scoring the ten genuine
// corrections in the test suite produced a strict winner for nine of them and a three-way tie at 1
// for "Every time you finish you skip the tests. From now on run both suites before you tell me it
// works" — which really does fire at three different moments (`finish`, `claim-done`, `choose-work`)
// depending on how it is read. The first implementation broke that tie by list order, which is an
// arbitrary mechanism wearing the costume of a decision. A lesson filed at the wrong trigger
// interrupts at the wrong moment, and a gate that fires at the wrong moment is the one users learn
// to scroll past (ADR-030 §5). So ambiguity resolves the same way every other doubt in this module
// resolves: nothing is emitted. Measured cost: one of ten.

const TRIGGER_VOCAB = [
  ['relay-number', /\b(?:scores?|scored|scoring|benchmarks?|metrics?|percent(?:age)?|out of \d+|ratings?|grades?|stats?|subagent'?s? (?:result|number))\b/gi],
  ['finish', /\b(?:finish(?:ed|ing)?|close the issue|closing the issue|wrap up|when you'?re done|hand (?:it )?back|sign off)\b/gi],
  // `push(?!\s+(?:through|back|forward))` — a corpus run filed "always push through them and do the
  // careful planning" (persevere) as a shipping rule. The idiom is common and it is not `git push`.
  ['ship', /\b(?:push(?:ed|ing|es)?(?!\s+(?:through|back|forward|on))|publish(?:ed|ing)?|releas(?:e|ed|ing)|deploy(?:ed|ing|ment)?|ship(?:ped|ping)?|commit(?:ted|ting|s)?|versions?|bump(?:ed|ing)?|npm publish|merge[ds]?)\b/gi],
  ['write-code', /\b(?:code|functions?|files?|refactor(?:ed|ing)?|implement(?:ed|ing)?|hardcod(?:e|ed|ing)|wrote|edit(?:ed|ing)?|hand[- ]?roll(?:ed|ing)?|modules?|scripts?)\b/gi],
  ['recommend-architecture', /\b(?:architect(?:ure|ural)?|designs?|designed|approach(?:es)?|recommend(?:ed|ation|ing)?|suggest(?:ed|ion|ing)?|tradeoffs?|propos(?:e|ed|al))\b/gi],
  ['mutate-machine', /\b(?:install(?:ed|ing)?|uninstall|delet(?:e|ed|ing)|keychain|globally|launchagent|outside (?:this|the) repo|my machine)\b/gi],
  ['claim-done', /\b(?:done|finished|works?|working|verif(?:y|ied|ying)|tested|completed?|proven?|all set|it'?s live)\b/gi],
  ['assert-fact', /\b(?:assert(?:ed|ing|ion)?|claim(?:ed|ing)?|assum(?:e|ed|ing|ption)|guess(?:ed|ing)?|memory|recall(?:ed)?|live source|source of truth|the api|look(?:ed)? it up)\b/gi],
  ['report-status', /\b(?:status|report(?:ed|ing)?|progress|summar(?:y|ise|ize|ised|ized)|where (?:we|things) (?:are|stand)|update me|tables?|prose|narrative|clickable|links?|urls?|paths?|show me|present(?:ed|ing)?)\b/gi],
  ['choose-work', /\b(?:choose|chose|pick(?:ed)?|priorit(?:y|ise|ize|ised|ized)|work on|backlog|skip(?:ped|ping)?)\b/gi],
];

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Redaction runs before anything is returned. ADR-033 names the transcript corpus as "a new
 * secret-leakage surface"; a candidate is a durable artifact that a human will read and a store will
 * keep, so a key pasted into a correction must not survive into it.
 */
function redact(text) {
  return text
    .replace(/-----BEGIN[^-]{0,40}-----[\s\S]*?-----END[^-]{0,40}-----/g, '[redacted-pem]')
    .replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}/g, '[redacted-key]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, '[redacted-token]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-aws-key]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, 'Bearer [redacted]')
    .replace(/\b[A-Fa-f0-9]{40,}\b/g, '[redacted-hex]')
    .replace(/\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S+/gi, '$1=[redacted]');
}

const sentencesOf = (text) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const anyMatch = (patterns, text) => patterns.some((re) => re.test(text));

/**
 * SIGNALS 2+3, as one predicate — see the header. Returns the markers that bind a quantifier to the
 * agent within this sentence, or [] if the sentence quantifies over something else (a program, a
 * spec, a third party) or does not quantify at all.
 */
function agentBoundQuantifiers(sentence) {
  // A third-person subject governing the quantifier settles it: this is a claim about the world.
  if (THIRD_PERSON_QUANT.test(sentence)) return [];

  const hits = [];
  for (const re of BOUND_SECOND_PERSON) {
    const m = re.exec(sentence);
    if (m) hits.push({ marker: m[0].toLowerCase().replace(/\s+/g, ' '), binding: 'second-person' });
  }
  const stop = STOP_GERUND.exec(sentence);
  if (stop) hits.push({ marker: stop[0].toLowerCase(), binding: 'imperative' });

  for (const clause of sentence.split(CLAUSE_SPLIT)) {
    const m = CLAUSE_INITIAL_QUANT.exec(clause.trim());
    if (m) hits.push({ marker: m[1].toLowerCase(), binding: 'clause-initial-imperative' });
  }

  // Temporal scope quantifies over occasions but not over an agent — it counts only when the
  // utterance actually addresses this agent.
  if (TEMPORAL_SCOPE.test(sentence) && (ADDRESSES_AGENT.test(sentence) || hits.length)) {
    hits.push({ marker: TEMPORAL_SCOPE.exec(sentence)[0].toLowerCase(), binding: 'temporal-scope' });
  }
  return hits;
}

function inferTrigger(text) {
  const scored = TRIGGER_VOCAB
    .map(([key, re]) => ({ key, score: (text.match(new RegExp(re.source, 'gi')) || []).length }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;                                   // no trigger → prose → silence
  if (scored.length > 1 && scored[1].score === scored[0].score) return null;  // ambiguous → silence
  return scored[0];
}

// ── The detector ─────────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} promptText  the user's own words, from the UserPromptSubmit payload's `.prompt`
 *                             (Sol C5: the authenticated utterance, never a transcript reconstruction)
 * @param {object} context
 *   @param {object|null} context.precedingAssistantAction  what the agent did immediately before —
 *          `{ tool?, summary? }`. REQUIRED: Signal 1 (adjacency). Its absence means there is nothing
 *          for the utterance to be correcting, which is how the harness-injected turn — the single
 *          highest-scoring hit in the corpus — is refused structurally rather than by blacklist.
 *   @param {string} [context.transcriptPath]  provenance only, so a ruling can be checked
 *   @param {number} [context.turnIndex]
 *   @param {string} [context.timestamp]
 * @returns {null | {statement, trigger, evidence, confidence, origin, status}}
 */
export function detectCorrection(promptText, context = {}) {
  if (typeof promptText !== 'string') return null;
  const raw = promptText.trim();
  if (!raw || raw.length > MAX_UTTERANCE_CHARS || raw.length < MIN_STATEMENT_CHARS) return null;

  // SIGNAL 1 — adjacency. No preceding agent action, no correction.
  const prior = context.precedingAssistantAction;
  const respondingTo = prior && (prior.summary || prior.tool) ? String(prior.summary || prior.tool).slice(0, 200) : null;
  if (!respondingTo) return null;

  // Hard exclusions — cheapest first, and every one of them is a named FP class.
  if (anyMatch(HARNESS_TEMPLATES, raw)) return null;   // not an utterance
  if (anyMatch(DOCUMENT_MARKERS, raw)) return null;    // pasted content, incl. this repo's own ADRs
  if (anyMatch(USER_THIRD_PERSON, raw)) return null;   // the injection tell
  if (anyMatch(ATTRIBUTION, raw)) return null;         // quoting a rule is not issuing one
  if (anyMatch(DELEGATION, raw)) return null;          // the subject is a third party
  if (SPEC_FRAME.test(raw)) return null;               // requirement about an artifact
  if (raw.startsWith('/')) return null;                // slash command, not speech

  // SIGNALS 2+3 — a quantifier bound to the agent, in a sentence that is neither a question nor a
  // hypothetical. Both filters are applied per sentence: "Always give me a link. Does that work?"
  // must survive its own trailing question.
  const bearing = [];
  const signals = [];
  for (const sentence of sentencesOf(raw)) {
    if (sentence.endsWith('?')) continue;
    if (HEDGE.test(sentence)) continue;
    const hits = agentBoundQuantifiers(sentence);
    if (!hits.length) continue;
    bearing.push(sentence);
    signals.push(...hits.map((h) => ({ ...h, span: sentence.slice(0, 120) })));
  }
  if (!bearing.length) return null;

  // SIGNAL 4 — negative valence. A correction rejects something; a first-time convention does not.
  const valence = VALENCE.filter(([, re]) => re.test(raw)).map(([name]) => name);
  if (!valence.length) return null;

  // NO SINGLE MARKER MAY SATISFY TWO INDEPENDENT SIGNALS. A temporal scope marker ("in the future")
  // is the one token that appears in both tests — as a weak Signal 3 binding and as Signal 4's
  // change-of-behaviour valence — so an utterance carrying nothing else clears a four-signal
  // conjunction on the strength of one lexical fact wearing two hats.
  //
  // Found by running the real corpus, not by reasoning: both surviving false positives in 1,451
  // turns were this exact shape, and both were statements of DESIRE rather than correction —
  // "The point is I want you to be able to do it now and in the future." The genuine ones in the
  // same shape ("From now on, close the issue yourself — don't ask me") always carry an independent
  // prohibition. Requiring that independence drops both FPs and keeps every true positive.
  const bindings = new Set(signals.map((s) => s.binding));
  if (bindings.size === 1 && bindings.has('temporal-scope')
      && valence.length === 1 && valence[0] === 'change-of-behaviour') {
    return null;
  }

  const statement = redact(bearing.join(' ')).slice(0, MAX_STATEMENT_CHARS).trim();
  if (statement.length < MIN_STATEMENT_CHARS) return null;

  // The closed enum has the last word: no trigger, no lesson.
  //
  // Inferred from the CORRECTION SENTENCES, not from the whole turn. The first version scored the
  // whole utterance and the corpus caught it out: a turn whose rule was "never give me an issue
  // without a solution in the same line" (a status-reporting rule) filed as `ship`, because the
  // user had mentioned "version numbers" two sentences earlier about something else entirely.
  // Incidental vocabulary elsewhere in a turn should not decide when a rule interrupts — that is
  // the same misfiling that makes the tie-break rule above refuse rather than guess.
  const trigger = inferTrigger(statement);
  if (!trigger) return null;

  // Ordering only. Never a gate, never an auto-ratification threshold, and never 1.0.
  const corroboration = new Set(signals.map((s) => s.binding)).size + valence.length;
  const confidence = Math.min(0.9, 0.5 + 0.1 * (corroboration - 1));

  return {
    statement,
    trigger: trigger.key,

    // Sol C2: `makeLesson()` drops unknown top-level keys but passes `evidence[]` through whole, so
    // the entire ratification surface rides inside it. `observed` is what lesson-gate.mjs prints.
    evidence: [{
      observed: `you said: "${redact(raw).slice(0, MAX_QUOTE_CHARS)}"`,
      quote: redact(raw).slice(0, MAX_QUOTE_CHARS),
      respondingTo,
      signals,
      valence,
      detector: 'correction-detect',
      source: {
        transcriptPath: context.transcriptPath ?? null,
        turnIndex: context.turnIndex ?? null,
        timestamp: context.timestamp ?? null,
      },
    }],

    confidence,

    // ADR-033 §4, unconditional and with no override parameter — a caller cannot ask for anything
    // else, because the only honest answer to "who put this row in the store" is: a machine.
    origin: 'model-inferred',
    status: 'candidate',
  };
}
