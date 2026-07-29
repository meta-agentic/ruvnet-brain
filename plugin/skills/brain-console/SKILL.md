---
name: brain-console
description: Open the RuvNet Brain Console for "/rvbc", "/rvcb", "/brain-console", or "/ruvnet-brain:configure". Use when the user asks to open, configure, inspect, or view the Brain Console. It opens the live local page in the background; the page is read-only until the user clicks a clearly explained, reversible action.
updated: 2026-07-28
---

# Brain Console

Treat `/rvbc`, `/rvcb`, `/brain-console`, and `/ruvnet-brain:configure` as equally valid names.
Never correct the user's spelling.

1. Say one short sentence: "Opening it now; it scans live while you watch."
2. Locate `scripts/onboarding-console.mjs` from the current repository. If it is not present,
   check `~/Code/ruvnet-brain/scripts/onboarding-console.mjs`. Do not invent another path.
3. Run `node <resolved-script> --serve --open` in the background.
4. Give the URL immediately. Do not promise a duration; the page reports its own scan progress.

An already-running server is success. The Console is read-only until the user chooses an action;
every change must be explained and reversible. If the script cannot be located or the server fails,
report the exact failure plainly instead of claiming the Console opened.
