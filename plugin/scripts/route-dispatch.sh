#!/bin/bash
# route-dispatch.sh — PreToolUse gate on subagent dispatch. THE MECHANISM THAT ENDS MODEL INHERITANCE.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-13). Stuart: "What happens when I'm right here in Opus 4.8 and it has 10 things to run?
# Is it going to just run them as Opus 4.8?"  The answer was YES — and that is the single biggest
# cost leak in Claude Code:
#
#     A SUBAGENT INHERITS THE MAIN-LOOP MODEL UNLESS YOU EXPLICITLY PASS `model`.
#
# So a 10-agent fan-out on an Opus session is 10 Opus agents; on a Fable session, 10 Fable agents at
# $10/$50 per Mtok — 10x what Haiku costs for identical mechanical work. The router existed. The rule
# to use it existed. And the router's ENTIRE LIFETIME OUTPUT was 3 test pings and $0.018 saved,
# because the rule was ADVISORY and advisory rules get ignored — by me, repeatedly, for two days.
#
# The fix is not another rule. It is a WALL: you cannot dispatch a subagent without declaring what it
# costs. Same principle as scripts/job-heartbeat.sh — replace good intentions with a mechanism that
# CANNOT be forgotten, because forgetting it is a hard error.
#
# CONTRACT (verified against this machine's live hook config, not assumed):
#   exit 0            → allow the dispatch
#   exit 2 + stderr   → BLOCK the tool, and stderr is fed back to the model as the reason
# So a blocked dispatch does not fail the turn — it comes back to me with instructions, and I retry
# WITH a model. That is the point: the wall teaches, it does not just punish.
# ─────────────────────────────────────────────────────────────────────────────────────────────────

set -uo pipefail
INPUT=$(cat)

TOOL=$(printf '%s' "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")
case "$TOOL" in Task|Agent) ;; *) exit 0 ;; esac   # only subagent dispatches

# An escape hatch that must be USED ON PURPOSE, never by accident or omission.
if [ "${RUVNET_ALLOW_INHERITED_MODEL:-0}" = "1" ]; then exit 0; fi

read -r HAS_MODEL MODEL SUBTYPE DESC <<<"$(printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
    ti = json.load(sys.stdin).get('tool_input', {}) or {}
except Exception:
    print('1 - - -'); sys.exit(0)
m = (ti.get('model') or '').strip()
st = (ti.get('subagent_type') or '-').strip() or '-'
d  = (ti.get('description') or '-').strip().replace(' ', '_')[:40] or '-'
print(f\"{'1' if m else '0'} {m or '-'} {st} {d}\")
" 2>/dev/null || echo "1 - - -")"

# A 'fork' inherits the parent's model BY DESIGN (that is what a fork IS) — blocking it would be wrong.
if [ "$SUBTYPE" = "fork" ]; then exit 0; fi

if [ "$HAS_MODEL" = "1" ]; then
  # Declared. Record it so routing is AUDITABLE rather than merely claimed — the receipts file is the
  # scoreboard that catches me if I quietly stop routing (it is how Stuart caught the $0.018 lifetime).
  mkdir -p "$HOME/.claude/metaharness" 2>/dev/null || true
  printf '{"ts":"%s","event":"dispatch","model":"%s","agent":"%s","task":"%s"}\n' \
    "$(date -u +%FT%TZ)" "$MODEL" "$SUBTYPE" "$DESC" \
    >> "$HOME/.claude/metaharness/dispatch-log.jsonl" 2>/dev/null || true
  exit 0
fi

# ── BLOCKED: no model declared → it would silently inherit the session model. ──
cat >&2 <<'EOF'
⛔ SUBAGENT DISPATCH BLOCKED — you did not declare a `model`.

An agent with no `model` INHERITS this session's model. On an Opus session that is an Opus
agent; on a Fable session it is $10/$50 per Mtok — up to 10x what the same work costs on Haiku.
Inheritance-by-omission is the single biggest cost leak in this harness, and it is why the
router sat unused with $0.018 saved in its entire life. Advisory rules did not fix it. This does.

Re-issue the SAME Agent call with an explicit `model`, chosen by what the task actually IS:

  model: "haiku"   mechanical — greps, file sweeps, log triage, mechanical edits, fixture rewrites
  model: "sonnet"  analytical — trace a bug across files, summarize a subsystem, draft tests
  model: "opus"    judgment   — architecture, root cause, security, anything user-facing
                   (and if it truly needs the main model's judgment, ask whether it should be a
                    subagent at all, or work you do inline)

Not sure? Ask rUv's real router — it predicts each model's quality on THIS task and returns the
cheapest one that clears the bar, with your subscriptions priced at $0:

  node ~/.claude/model-router/bin/model-router-engine.mjs --harness claude-code --prompt "<task>" --json

Then log the receipt after it returns, so the saving is visible instead of merely asserted:

  node scripts/dispatch-receipt.mjs --model <m> --inherited <this session's model> \
       --task "<what it did>" --total-tokens <the agent's reported total>

Deliberate exception (rare, and say WHY out loud): RUVNET_ALLOW_INHERITED_MODEL=1
EOF
exit 2
