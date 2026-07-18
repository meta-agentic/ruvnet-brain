#!/bin/bash
# ground-before-write.sh — PreToolUse gate on Write|Edit.
# YOU MAY NOT WRITE RUV-DOMAIN CODE THE BRAIN HAS NOT SEEN FIRST.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-13). Stuart, after losing a full day: "The 100% entire reason we built RuvNet
# Brain was to prevent exactly this scenario... come up with a way to keep Claude Code from
# stepping in and overriding RuvNet-Brain."
#
# What happened, twice in one week: Claude hand-wrote agentdb-autocapture.mjs (prompt-echo
# snapshots) while rUv's ADR-174 `memory distill` pipeline shipped the real design; Claude
# hand-wrote a 216-line "MetaHarness router" while @metaharness/router sat on npm. Both times
# the brain HELD the answer and was never asked. The write path had no wall.
#
# rUv names the disease and the cure himself (@claude-flow/guidance, ADR-G007):
#   "prompts are advisory. Agents can and do ignore them, especially in long sessions."
#   "The model can forget a rule; the gate does not."
# And his own hooks doc wires exactly this shape: PreToolUse on ^(Write|Edit|MultiEdit)$
# (ruflo/.claude/commands/hooks/overview.md).
#
# THE RULE: writing/editing a CODE file that touches a RuvNet ecosystem product requires a
# fresh (<24h) grounding stamp for that product — written only by grounding-stamp.sh when
# search_ruvnet is genuinely called with that product in the query.
#
# Deliberate scope choices (so this never becomes a tax that gets switched off):
#   • CODE files only (.mjs/.js/.ts/.sh/...). Docs/README claims are enforced by the CI gates
#     (claims-verify, no-silent-substitution), not per-keystroke.
#   • Product terms only (agentdb, metaharness, ...). Generic words like "memory"/"hook"
#     would fire on half of all software.
#   • Block only the UNGROUNDED terms — grounding agentdb unlocks agentdb, not metaharness.
#     Granularity matches the mistake, same as verify-interface.sh's per-subcommand stamps.
#
# CONTRACT: exit 0 = allow · exit 2 + stderr = BLOCK (stderr returns to the model as reason).
# FAILS OPEN on anything unparseable. Opt-in (router profile), like every gate here.
# ─────────────────────────────────────────────────────────────────────────────────────────────

set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0

PROFILE="${MODEL_ROUTER_PROFILE:-$HOME/.claude/model-router/profile.json}"
[ -f "$PROFILE" ] || exit 0
[ "${RUVNET_SKIP_GROUNDING_CHECK:-0}" = "1" ] && exit 0

# This gate is a BLOCKING wall (the #1-failure preventer), so by deliberate design (ADR-0021, and
# enforced by ground-before-write.test.mjs) it depends on NOTHING fragile — pure bash builtins, no
# node/jq/python — and therefore cannot fail-open because a tool went missing. The #13 quote-truncation
# that justified hook-input.mjs for design-wall does NOT bite here: the product-term scan below runs
# over the RAW payload (untouched by field()), and the only parsed values are tool_name (Write/Edit —
# no quotes) and file_path (a truncated path merely fails the extension check → exit 0, harmless).
field() { local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""; [[ $INPUT =~ $re ]] && printf '%s' "${BASH_REMATCH[1]}"; }

case "$(field tool_name)" in Write|Edit|MultiEdit) ;; *) exit 0 ;; esac

FILE_PATH=$(field file_path)
[ -n "$FILE_PATH" ] || exit 0
case "$FILE_PATH" in
  *.mjs|*.cjs|*.js|*.ts|*.tsx|*.jsx|*.sh|*.bash|*.zsh|*.rs|*.py|*.go) ;;
  *) exit 0 ;;
esac
# The grounding-guidance hooks ENUMERATE every rUv product by design — that IS their job: telling the
# model which rUv primitive replaces which classical default. They don't hand-roll or call any rUv
# tool, so demanding a fresh stamp per listed term just to EDIT the guidance is a false positive — the
# gate firing on its own source material (it blocked a trim of ground-ruvnet.sh on 2026-07-18). Exempt
# these two by basename; the repo-wide CI gates (claims-verify, no-silent-substitution) still cover them.
case "$FILE_PATH" in
  */ground-ruvnet.sh|*/session-start.sh) exit 0 ;;
esac

shopt -s nocasematch 2>/dev/null || true

STAMP_DIR="$HOME/.cache/ruvnet-brain/grounded"
NOW=$(date +%s 2>/dev/null) || exit 0

# Scan the WHOLE tool input (path + content + new_string) — where the code mentions the
# product is where the hand-roll hides.
MISSING=""
for t in agentdb metaharness ruvector aidefence agentic-flow agentic-qe ruv-swarm rvf ruflo; do
  [[ $INPUT == *"$t"* ]] || continue
  STAMP="$STAMP_DIR/$t"
  if [ -f "$STAMP" ]; then
    # GNU date reads a file's mtime with -r; BSD/macOS needs stat -f %m. Either failing → allow
    # (fail open — a gate that bricks a session is worse than the bug it prevents).
    THEN=$(date -r "$STAMP" +%s 2>/dev/null) || THEN=$(stat -f %m "$STAMP" 2>/dev/null) || exit 0
    [ $((NOW - THEN)) -lt 86400 ] && continue
  fi
  MISSING="$MISSING$t "
done
[ -n "$MISSING" ] || exit 0

read -r -d '' MSG <<EOF || true
⛔ BLOCKED — you are writing rUv-domain code the brain has not seen: ${MISSING% }

This exact move has already cost a full day TWICE: a hand-rolled agentdb capture hook while
rUv's ADR-174 distill pipeline shipped the real design, and a fake "MetaHarness router" while
@metaharness/router sat on npm. Both times the brain held the answer and was never asked.

Before writing this file, ground each blocked term in the RuvNet Brain — call the
search_ruvnet MCP tool with the product in the query, e.g.:

    search_ruvnet({ query: "${MISSING%% *}: how does rUv implement / recommend this?" })

Reading real source stamps the term for 24h and this gate opens. rUv's own rule (ADR-G007):
prompts are advisory; the gate is not. EFFECTIVE BEATS EFFICIENT.
(Deliberate override, say why out loud: RUVNET_SKIP_GROUNDING_CHECK=1)
EOF
bash "$(dirname "${BASH_SOURCE[0]}")/gate-receipt.sh" ground-before-write "${MISSING%% *}" "rUv-product code without a fresh search_ruvnet stamp" 2>/dev/null || true
printf '%s\n' "$MSG" >&2
exit 2
