#!/bin/bash
# install-npx-witness.sh — install the npx witness as a launchd WatchPaths job. Idempotent.
#
# The job fires the instant ~/.npm/_npx changes (any creation/deletion, by anything), runs
# scripts/npx-witness.sh, and is wrapped in job-heartbeat.sh so it PROVES it ran (standing order:
# launchd reports exit 0 for a job that never ran — silence is not health).
#
# Zero sudo. Zero interference: the job only appends to ~/.claude/logs/npx-witness.log.
# Uninstall: launchctl bootout gui/$(id -u)/com.ruvnet.npx-witness && rm the plist.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.ruvnet.npx-witness"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HB="$REPO/scripts/job-heartbeat.sh"
WITNESS="$REPO/scripts/npx-witness.sh"

[ -f "$HB" ] || { echo "FAIL: $HB missing"; exit 1; }
[ -f "$WITNESS" ] || { echo "FAIL: $WITNESS missing"; exit 1; }
chmod +x "$WITNESS"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string>
    <string>$HB</string>
    <string>$LABEL</string>
    <string>--</string>
    <string>/bin/bash</string>
    <string>$WITNESS</string>
  </array>
  <key>WatchPaths</key><array><string>$HOME/.npm/_npx</string></array>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/npx-witness.out</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/npx-witness.err</string>
</dict></plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "installed: $PLIST"
echo "loaded:    $(launchctl list | grep -c "$LABEL") (1 = live)"
echo "log:       ~/.claude/logs/npx-witness.log"
echo "heartbeat: ~/.cache/ruvnet-brain/heartbeats/$LABEL.json"
