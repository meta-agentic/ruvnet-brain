#!/bin/bash
# design-wall.sh — PreToolUse gate on Bash. NOTHING VISUAL SHIPS, COMMITS, OR OPENS UNGRADED.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# WHY (2026-07-16). Stuart, after a carelessly-composed public band shipped twice: "You are always,
# and I mean always, supposed to look at a page as an end user would: take pictures of it, review it,
# analyze it, grade it, see if it gets a 95 or better, and if it doesn't, tweak it until it does —
# before you ever tell me something is ready." And when that landed as a memory note instead of a
# mechanism: "Suggestions mean bullshit to you. RuvNet Brain needs to be smart enough to make sure
# those suggestions become law and the law becomes followed."
#
# He is right about the mechanism. This repo's entire history says advisory rules fail and walls hold
# (route-dispatch, verify-interface, ground-before-write, substitution:check, narrative-version).
# So the 95-gate is a WALL: deploying the explainer, committing visual surfaces, or opening a page
# for the user REQUIRES a fresh passing design-grade stamp for that surface. The only key is
# scripts/design-grade.mjs, which itself refuses to stamp without >=2 fresh screenshots at distinct
# widths and written deductions. The grade stays judgment; the ritual is enforced; the receipt is
# auditable.
#
# CONTRACT: exit 0 = allow · exit 2 + stderr = BLOCK (stderr returns to the model as the reason).
# FAILS OPEN on anything it cannot parse — a gate that breaks the shell protects nothing.
# ─────────────────────────────────────────────────────────────────────────────────────────────────
set -uo pipefail

INPUT=""
while IFS= read -r _l || [ -n "$_l" ]; do INPUT+="$_l"; done
[ -n "$INPUT" ] || exit 0
[ "${RUVNET_SKIP_DESIGN_WALL:-0}" = "1" ] && exit 0

field() { local re="\"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""; [[ $INPUT =~ $re ]] && printf '%s' "${BASH_REMATCH[1]}"; }
[ "$(field tool_name)" = "Bash" ] || exit 0
CMD=$(field command)
[ -n "$CMD" ] || exit 0

STAMPDIR="$HOME/.cache/ruvnet-brain"
need=()

# 1) Production deploys of the public explainer.
if [[ $CMD == *vercel* && $CMD == *--prod* ]]; then need+=("explainer"); fi

# 2) Commits that stage visual surfaces.
if [[ $CMD == *"git commit"* ]]; then
  STAGED=$(git -C "${CLAUDE_PROJECT_DIR:-.}" diff --cached --name-only 2>/dev/null || true)
  [[ $STAGED == *"explainer/"* ]] && need+=("explainer")
  [[ $STAGED == *"console/"*   ]] && need+=("console")
  [[ $STAGED == *"README.md"*  ]] && need+=("readme")
fi

# 3) Opening a page for the user — presenting IS shipping.
if [[ $CMD =~ open[^\|\;]*https?:// ]]; then
  [[ $CMD == *"isovision.ai/ruvnet-brain"* || $CMD == *"ruvnet-brain.vercel.app"* ]] && need+=("explainer")
  [[ $CMD == *"localhost:7411"* || $CMD == *"127.0.0.1:7411"* ]] && need+=("console")
fi

[ ${#need[@]} -eq 0 ] && exit 0

for s in "${need[@]}"; do
  ST="$STAMPDIR/design-stamp-$s.json"
  ok=0
  if [ -f "$ST" ] && grep -Eq '"passing":[[:space:]]*true' "$ST" 2>/dev/null; then
    agemin=$(( ( $(date +%s) - $(stat -f %m "$ST" 2>/dev/null || echo 0) ) / 60 ))
    [ "$agemin" -le 45 ] && ok=1
  fi
  if [ "$ok" != "1" ]; then
    cat >&2 <<EOF
⛔ DESIGN WALL — no fresh passing grade for surface '$s'.
Nothing visual ships, commits, or opens for the user until it has been LOOKED AT as an end user
would and graded 95 or better. The ritual (minutes, enforced):
  1. Screenshot the REAL surface at TWO widths (1440 and ~1920).
  2. LOOK at both. Actively: does it look great? typography right? does every block earn its place?
     Write the deductions down.
  3. node scripts/design-grade.mjs --surface $s --grade <n> --shot <p1> --shot <p2> --deductions "…"
     Below 95 it records the grade and STAYS CLOSED — fix, re-shoot, re-grade until it opens.
Stamp: $ST (valid 45 min — pages change, grades expire).
Deliberate override (rare, say why out loud): RUVNET_SKIP_DESIGN_WALL=1
EOF
    exit 2
  fi
done
exit 0
