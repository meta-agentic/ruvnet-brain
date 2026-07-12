#!/bin/bash
# goldie-weekly.sh — the ONLY thing launchd invokes for Goldie (weekly model-landscape research).
# Same discipline as nightly-wrapper.sh: verified outcomes, exactly one phone summary per run,
# no silent path. Built 2026-07-12 per Stuart's mandate: the router must never run on a stale
# picture of the model landscape, and no scheduled job may ever die quietly.
#
# Two layers, independent by design:
#   1. DETERMINISTIC (scripts/goldie-research.mjs): live OpenRouter pricing -> catalog refresh +
#      drift flags + radar + the dated brief. Pure data, no LLM, no key needed.
#   2. JUDGMENT (headless Claude, subscription-covered): answers the brief's three standing
#      questions (bucket count, best-model-per-bucket per public evals, radar adoption) with real
#      web research, APPENDED to the same brief as a PROPOSAL — never auto-applied to policy.mjs.
#      Skippable (GOLDIE_SKIP_JUDGMENT=1) and its failure never hides layer 1's result.
set -u
cd /Users/stuartkerr/Code/ruvnet-brain || exit 1
mkdir -p logs
LOG=logs/goldie.log
TODAY=$(date +%F)
BRIEF="$HOME/.claude/model-router/goldie/$TODAY.md"

echo "===== goldie-weekly — $(date -u +%FT%TZ) =====" >> "$LOG"

# ── Layer 1: deterministic refresh (must succeed for the run to count) ──
if ! /usr/local/bin/node scripts/goldie-research.mjs >> "$LOG" 2>&1; then
  sh scripts/notify.sh "🔴 Goldie FAILED — model catalog is going stale" \
    "goldie-research.mjs could not produce this week's brief (OpenRouter fetch or catalog write failed). The router is now running on last week's picture. See logs/goldie.log." \
    urgent "rotating_light" || true
  exit 1
fi

# ── Layer 2: judgment (best-effort, never blocks; appends to the brief) ──
JUDGMENT="skipped"
if [ "${GOLDIE_SKIP_JUDGMENT:-0}" != "1" ] && command -v claude >/dev/null 2>&1; then
  PROMPT="You are Goldie, the weekly model-landscape researcher for a prompt->model router.
Read $BRIEF (this week's deterministic data) and ~/.claude/model-router/catalog.json (the candidate
catalog) and ~/.claude/model-router/policy.default.mjs (the current placeholder policy). Then use web
search on the current public evaluations (Artificial Analysis, LMArena, SWE-bench and similar) to
answer the brief's three standing questions with sources and dates:
(1) how many BUCKETS should prompts be classified into and what are they;
(2) the best model per bucket right now on capability-per-cost-per-speed, split into: covered by a
Claude Max subscription (claude-code harness), covered by a ChatGPT/Codex subscription (codex
harness), and cheapest-capable OpenRouter API model;
(3) whether any radar model in the brief deserves wiring up, and what that requires.
Rules: cite sources with dates for every claim; distinguish MEASURED numbers from vendor claims;
recommendations are PROPOSALS for catalog.json/policy.mjs — do not edit any file. End with a
'## Proposed policy changes' section in plain, reviewable prose.
Write your full answer to stdout as markdown."
  # env -u ANTHROPIC_API_KEY: a stray/stale API key in the environment makes headless claude bill
  # (or fail on) the API instead of riding the Claude Max login — the exact "spend where the
  # subscription is free" mistake this system exists to kill. Found live 2026-07-12: an invalid
  # inherited key failed the whole judgment layer with "Invalid API key". Subscription, always.
  if OUT=$(timeout 900 env -u ANTHROPIC_API_KEY claude -p "$PROMPT" --model sonnet --allowed-tools "WebSearch,WebFetch,Read" 2>>"$LOG"); then
    { echo ""; echo "---"; echo ""; echo "# Judgment layer (headless Claude, $(date -u +%FT%TZ))"; echo ""; echo "$OUT"; } >> "$BRIEF"
    JUDGMENT="ok"
  else
    JUDGMENT="FAILED (see logs/goldie.log)"
    { echo ""; echo "---"; echo ""; echo "# Judgment layer: FAILED this week ($(date -u +%FT%TZ)) — deterministic data above still fresh."; } >> "$BRIEF"
  fi
fi

# ── Exactly one summary push per run — success included (silence is never a signal) ──
HEADLINES=$(grep -E "PRICE DRIFT|NOT FOUND" "$BRIEF" | head -3)
sh scripts/notify.sh "🧭 Goldie ran — model catalog refreshed" \
  "Weekly brief: $BRIEF. Judgment layer: $JUDGMENT.${HEADLINES:+ ATTENTION: $HEADLINES}" \
  default "compass" || true
echo "===== goldie-weekly done (judgment: $JUDGMENT) =====" >> "$LOG"
exit 0
