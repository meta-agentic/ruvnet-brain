#!/bin/bash
# grounding-stamp.sh — PostToolUse hook on the brain's search_ruvnet tool.
#
# The other half of ground-before-write.sh. When the model ACTUALLY consults the RuvNet Brain,
# this records WHICH ecosystem products the query grounded — one stamp file per product term,
# read later by the write-path gate. No stamp, no write.
#
# ONLY the QUERY counts. The tool RESULT lists every repo in the corpus in its "Searched 37
# repos" banner — stamping from the result would mark EVERYTHING grounded on every call and
# the gate would never fire again. (A check that can't fail protects nothing.)
#
# CONTRACT: PostToolUse is non-blocking — always exit 0, swallow every failure.

set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0

# First raw "query" key in the JSON is tool_input's — inside tool_response text, quotes are
# escaped (\"query\") so they cannot match this pattern.
QUERY=""
re='"query"[[:space:]]*:[[:space:]]*"([^"]*)"'
[[ $INPUT =~ $re ]] && QUERY="${BASH_REMATCH[1]}"
[ -n "$QUERY" ] || exit 0

shopt -s nocasematch 2>/dev/null || true

DIR="$HOME/.cache/ruvnet-brain/grounded"
mkdir -p "$DIR" 2>/dev/null || exit 0

# Same product-term list as ground-before-write.sh — ONE list per concept, mirrored in both
# files on purpose (a shared sourced file would add a dependency a blocking hook must not have).
for t in agentdb metaharness ruvector aidefence agentic-flow agentic-qe ruv-swarm rvf ruflo; do
  [[ $QUERY == *"$t"* ]] && { : > "$DIR/$t" 2>/dev/null || true; }
done

exit 0
