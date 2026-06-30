#!/usr/bin/env bash
# gate.sh — rebuild the concepts/capability layer (now incl. capability cards) and run the three
# pass/fail gates for the by-description routing fix. Run after kb/capability-cards.md exists and
# scripts/proof-questions.json is helix-free.
set -uo pipefail
cd /Users/stuartkerr/Code/ruvnet-brain
export KB_MODEL_CACHE=/Users/stuartkerr/Code/PowerPlatePulse/scripts/models-cache

echo "== rebuild concepts (L2 + primers + capability cards) =="
node scripts/build-concepts.mjs 2>&1 | tail -2
( cd kb && node forge-big.mjs both --dir . --name concepts 2>&1 | tail -2 )

echo
echo "== GATE 1 — described-need battery (newcomer, no repo names) · target >=85% =="
node scripts/prove.mjs --questions scripts/described-questions.json --k 2 --out DESCRIBED-PROOF 2>&1 | grep -E '^(PASS|FAIL|\[prove\] [0-9])'
echo
echo "== GATE 2 — named/specific battery · must HOLD (was 40/50, named 35/35) =="
node scripts/prove.mjs --questions scripts/proof-questions.json --k 3 --out PROOF 2>&1 | grep -E '^\[prove\] [0-9]'
echo
echo "== GATE 3 — Helix-context demo · target >=6/8 (was 2/8) =="
node scripts/prove.mjs --questions scripts/helix-scenario-questions.json --k 2 --out HELIX-DEMO-NOHELIX 2>&1 | grep -E '^(PASS|FAIL|\[prove\] [0-9])'
echo
echo "== GATES COMPLETE — read DESCRIBED-PROOF.md, PROOF.md, HELIX-DEMO-NOHELIX.md =="
