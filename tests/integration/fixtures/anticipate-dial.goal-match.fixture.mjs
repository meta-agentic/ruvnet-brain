/**
 * Fixture goal matcher for tests/integration/anticipate-dial.test.mjs — NOT real source, never
 * imported by anything except that test via RUVNET_GOAL_MATCH. Stands in for scripts/goal-match.mjs
 * so the dial tests do not depend on that module's actual matching heuristics — this file's only
 * job is to hand back a well-formed match (confidence above CONFIDENCE_FLOOR, non-empty `why`) for
 * every dormant row it is given, and only when the prompt actually mentions the fixture's keyword.
 */
export const CONFIDENCE_FLOOR = 0.6;

export function matchGoal(prompt, dormant) {
  if (!/vector cache/i.test(String(prompt || ''))) return [];
  return (Array.isArray(dormant) ? dormant : []).map((row) => ({
    capability: row.key,
    confidence: 0.95,
    why: 'the prompt is about rebuilding a vector cache, which this fixture capability turns on',
  }));
}
