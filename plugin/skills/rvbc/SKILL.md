---
name: rvbc
description: Open the RuvNet Brain Console in Codex when the user mentions "rvbc", asks for the Brain Console, or wants to configure or inspect RuvNet Brain. This is the native Codex alias for the Claude-only /rvbc command.
updated: 2026-07-29
---

# RuvNet Brain Console

Codex invokes this skill as `$ruvnet-brain:rvbc`; custom plugin slash commands are not part of the
Codex CLI slash-command surface.

1. Say one short sentence: "Opening it now; it scans live while you watch."
2. Locate `scripts/onboarding-console.mjs` from the current repository. If it is not present,
   check `~/Code/ruvnet-brain/scripts/onboarding-console.mjs`. Do not invent another path.
3. Run `node <resolved-script> --serve --open` in the background.
4. Give the URL immediately. Do not promise a duration; the page reports its own scan progress.

An already-running server is success. The Console is read-only until the user chooses an action;
every change must be explained and reversible. If the script cannot be located or the server fails,
report the exact failure plainly instead of claiming the Console opened.
