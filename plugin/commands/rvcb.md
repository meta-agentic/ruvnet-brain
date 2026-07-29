---
description: "RvCB — RuvNet Brain Console (same console as /rvbc, /brain-console, and /ruvnet-brain:configure — every spelling works). Opens the live console page: your whole RuvNet stack on one page. Read-only until you click."
updated: 2026-07-20
---

`/rvbc`, `/rvcb`, `/brain-console`, and `/ruvnet-brain:configure` are equally valid names. Never
correct the user's spelling.

1. Say: "Opening it now; it scans live while you watch."
2. Locate `scripts/onboarding-console.mjs` in the current repository, then
   `~/Code/ruvnet-brain/scripts/onboarding-console.mjs`. Do not invent another path.
3. Run `node <resolved-script> --serve --open` in the background.
4. Give the URL immediately. Never promise a duration; the page reports its own progress.

An already-running server is success. It is read-only until the user clicks; changes must be
explained and reversible. If the script or server is unavailable, report the exact failure.
