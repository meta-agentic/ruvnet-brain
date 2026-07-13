#!/bin/bash
# verify-interface.sh — PreToolUse gate on Bash. YOU MAY NOT CALL A TOOL YOU HAVE NOT READ THE HELP FOR.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-13). Stuart, furious: "There's zero reason you should be making incorrect calls. You
# have all of the code, all the pointers, all the knowledge. Why are you still so fascinated with
# efficiency that you won't take the split second to check you're making the call the right way?
# EFFECTIVE WINS OVER EFFICIENCY EVERY SINGLE TIME. Stop skipping steps. You are destroying your
# credibility."
#
# He is describing a real, mechanical defect. I reported AgentDB broken THREE TIMES. It was NEVER
# broken:
#   1. I called `ruflo memory search "query"` POSITIONALLY. The CLI wants `-q`. Empty result → I
#      declared the product broken.
#   2. My canary test then "failed" because MY OWN grep filtered the rows out.
#   3. My broken-state test printed nothing because I set the test up wrong.
# Every one was my defect, reported to him as a product defect. Cost: hours of his time and his trust.
#
# THE PRECISE GAP: the brain holds 2GB of rUv's SOURCE. It does NOT hold the runtime interface of a
# compiled npm CLI — `-q` lives in a binary's --help output, not in the indexed corpus. So when I went
# to INVOKE the tool, I typed the interface I ASSUMED existed. I ground FACTS in the brain and never
# ground INTERFACES in the tool.
#
# A rule would not fix this; I ignored rules all night. So: A WALL. You cannot invoke an ecosystem
# CLI's subcommand until you have actually read its --help in the last 24h. Five seconds, enforced.
#
# CONTRACT: exit 0 = allow · exit 2 + stderr = BLOCK (stderr returns to the model as the reason).
# FAILS OPEN on anything it cannot parse — a gate that breaks your shell is worse than the bug.
# ─────────────────────────────────────────────────────────────────────────────────────────────────

set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0

# Opt-in, like every other gate here: no router profile = this user never asked for our discipline.
PROFILE="${MODEL_ROUTER_PROFILE:-$HOME/.claude/model-router/profile.json}"
[ -f "$PROFILE" ] || exit 0
[ "${RUVNET_SKIP_INTERFACE_CHECK:-0}" = "1" ] && exit 0

field() { local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""; [[ $INPUT =~ $re ]] && printf '%s' "${BASH_REMATCH[1]}"; }
[ "$(field tool_name)" = "Bash" ] || exit 0

CMD=$(field command)
[ -n "$CMD" ] || exit 0

# Only the ecosystem CLIs whose interfaces I keep guessing at. NOT git/ls/grep — this must not become
# a tax on ordinary work, or it gets switched off and protects nothing.
TOOLS='ruflo|claude-flow|agentic-flow|agentic-qe|ruvector|agent-browser|ruv-swarm'

# ONE regex, used by BOTH paths. My first version used a DIFFERENT (weaker) regex on the help-recording
# path — it lacked the `[@a-z0-9.-]*` that absorbs `@latest`, so reading `ruflo@latest memory search
# --help` recorded NOTHING and the very next call was still blocked. The break-test caught it before it
# shipped. Two regexes for one concept is how you get a gate that never opens.
#
# Capture TWO levels (`memory search`, not just `memory`): `ruflo memory --help` lists subcommands but
# does NOT show `search`'s `-q` flag — and `-q` is the exact thing I guessed wrong. Granularity has to
# match the mistake it prevents.
MATCH_RE="($TOOLS)[@a-z0-9.-]*[[:space:]]+([a-z][a-z-]*)([[:space:]]+([a-z][a-z-]*))?"

if [[ $CMD =~ (--help|-h)([[:space:]]|$) ]]; then   # reading help is ALWAYS allowed — and recorded
  if [[ $CMD =~ $MATCH_RE ]]; then
    KEY="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}${BASH_REMATCH[4]:+.${BASH_REMATCH[4]}}"
    mkdir -p "$HOME/.cache/ruvnet-brain/help-read" 2>/dev/null || true
    : > "$HOME/.cache/ruvnet-brain/help-read/$KEY" 2>/dev/null || true
    # `ruflo memory search --help` also satisfies the parent `ruflo memory` — the child is strictly more.
    : > "$HOME/.cache/ruvnet-brain/help-read/${BASH_REMATCH[1]}.${BASH_REMATCH[2]}" 2>/dev/null || true
  fi
  exit 0
fi

[[ $CMD =~ $MATCH_RE ]] || exit 0
TOOL="${BASH_REMATCH[1]}"; SUB="${BASH_REMATCH[2]}${BASH_REMATCH[4]:+ ${BASH_REMATCH[4]}}"
KEY="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}${BASH_REMATCH[4]:+.${BASH_REMATCH[4]}}"

STAMP="$HOME/.cache/ruvnet-brain/help-read/$KEY"
# Read within the last 24h? (interfaces move — these are @latest/@alpha packages)
if [ -f "$STAMP" ]; then
  NOW=$(date +%s 2>/dev/null) || exit 0
  THEN=$(date -r "$STAMP" +%s 2>/dev/null) || exit 0
  [ $((NOW - THEN)) -lt 86400 ] && exit 0
fi

read -r -d '' MSG <<EOF || true
⛔ BLOCKED — you have not read the interface for: ${TOOL} ${SUB}

You are about to invoke a tool whose flags you are GUESSING at. That guess has already cost real
trust: \`ruflo memory search "query"\` was called positionally when the CLI wants \`-q\`, it returned
nothing, and AgentDB was reported BROKEN three times when it was never broken at all.

The brain holds rUv's SOURCE. It does NOT hold a compiled CLI's runtime flags. Ground the INTERFACE
in the TOOL, not in your assumptions. Run this first — it takes five seconds:

    ${TOOL} ${SUB} --help

Then re-issue your command with the flags it actually documents.

EFFECTIVE BEATS EFFICIENT. Skipping this step has never once saved time.
(Deliberate override, say why out loud: RUVNET_SKIP_INTERFACE_CHECK=1)
EOF
printf '%s\n' "$MSG" >&2
exit 2
