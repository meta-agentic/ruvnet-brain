// ~/.claude/model-router/policy.default.mjs — the DEFAULT (placeholder) routing policy.
//
// HOW TO SWAP IN YOUR HEURISTICS: create ~/.claude/model-router/policy.mjs with the same
// `choose` signature. The engine prefers policy.mjs when it exists and only falls back to this
// file otherwise. A learned router (e.g. a @metaharness/router / tiny-dancer JSON) can also be a
// policy — load it inside choose() and map its output to {model, provider, tier}.
//
// SIGNATURE:
//   choose({ features, candidates, harness }) -> { model, provider, tier, reason, confidence }
//     features   = output of the engine's extractFeatures() (chars, estTokens, hasCode,
//                  codeFences, fileTypes, questionCount, taskHints, harness)
//     candidates = the catalog entries (already filterable by .harness)
//     harness    = 'claude-code' | 'codex'
//
// WHY THIS DEFAULT IS DELIBERATELY WEAK (and says so): ADR-040 (DRACO) MEASURED that a
// hand-built self-signal threshold routed WORSE than always-cheapest, while a learned map from a
// real feature beat the best fixed model. So this placeholder makes NO claim of optimality — it is
// a transparent complexity proxy so the engine is usable TODAY, to be replaced by your researched
// (ideally learned) policy. confidence is pinned low to signal "not tuned."

export function choose({ features, candidates, harness }) {
  const pool = candidates.filter((m) => Array.isArray(m.harness) && m.harness.includes(harness));
  if (pool.length === 0) {
    return { model: null, provider: null, tier: null, reason: `no candidate supports harness=${harness}`, confidence: 0 };
  }
  const c = complexity(features);
  const tier = c < 0.33 ? 'cheap' : c < 0.66 ? 'mid' : 'frontier';
  let pick = cheapestInTier(pool, tier, harness) || cheapestInTier(pool, 'mid', harness) || pool[0];
  let floorNote = '';
  // $1,600 floor, CROSS-TIER (Goldie 2026-07-12): when the in-tier winner is a BILLED model but a
  // subscription-covered model exists at-or-above the needed tier, the subscription model wins —
  // more capability for $0 beats less capability for money, always. (Found live: demoting the
  // unreachable gpt-5.6 tiers left codex cheap/mid pointing at billed DeepSeek while gpt-5.5,
  // subscription-covered and MORE capable, sat unused one tier up.)
  if (effCost(pick, harness) > 0) {
    const order = ['cheap', 'mid', 'frontier'];
    const atOrAbove = order.slice(order.indexOf(tier));
    const subs = pool
      .filter((m) => Array.isArray(m.subscription) && m.subscription.includes(harness) && atOrAbove.includes(m.tier))
      .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier)); // least-capable sufficient one
    if (subs.length) { pick = subs[0]; floorNote = ` [cross-tier $0 floor: subscription ${pick.tier} model beats billed ${tier} candidate]`; }
  }
  return {
    model: pick.id,
    provider: pick.provider,
    tier,
    reason: `default(placeholder) policy: complexity≈${c.toFixed(2)} → ${tier} tier; subscription-covered model preferred ($0), else cheapest ${harness} candidate.${floorNote} NOT a tuned heuristic — replace via policy.mjs.`,
    confidence: 0.4,
  };
}

// Transparent, crude complexity proxy in [0,1]. Documented as a starting point, not a claim.
function complexity(f) {
  let s = 0;
  s += Math.min(0.3, (f.estTokens || 0) / 4000); // longer prompt → likely harder
  if (f.hasCode) s += 0.25;
  s += Math.min(0.15, (f.codeFences || 0) * 0.05);
  const hints = f.taskHints || '';
  // Accumulate hard/easy signals rather than one flat bump, so genuinely complex prompts
  // (architect + prove + optimize + security + debug …) actually climb past the tier thresholds
  // instead of maxing out at a single +0.25. Still crude on purpose — a learned policy replaces this.
  const hard = (hints.match(/\b(refactor|architect|design|debug|migrat\w*|optimi[sz]\w*|security|secure|proof|prove|correctness|distributed|consensus|concurren\w*|race\s+condition|algorithm|cryptograph\w*)\b/gi) || []).length;
  const easy = (hints.match(/\b(summari[sz]e|translate|classify|extract|rephrase|list|format|rename|typo|lookup)\b/gi) || []).length;
  s += Math.min(0.5, hard * 0.12);
  s -= Math.min(0.3, easy * 0.12);
  return Math.max(0, Math.min(1, s));
}

function cheapestInTier(pool, tier, harness) {
  const inTier = pool.filter((m) => m.tier === tier);
  // cheapest by EFFECTIVE cost for this harness; unknown-price candidates sort last (Infinity) so a
  // priced option is preferred over an unpriced one, but an unpriced one is still returned last
  // rather than nothing.
  return inTier.sort((a, b) => effCost(a, harness) - effCost(b, harness))[0];
}
// SAFETY FLOOR — the cardinal $1,600 lesson (cross-ref AgentDB intel-1600-postmortem): a model
// covered by THIS harness's subscription is marginal-$0 to the user, so it must NEVER lose to a
// billed OpenRouter/API model that only looks cheaper by sticker price. Spending money where the
// subscription is free is exactly the "clever but reckless" mistake this system exists to prevent.
function effCost(m, harness) {
  if (m && Array.isArray(m.subscription) && m.subscription.includes(harness)) return 0;
  return m && m.costPerMTok && typeof m.costPerMTok.out === 'number' ? m.costPerMTok.out : Infinity;
}
