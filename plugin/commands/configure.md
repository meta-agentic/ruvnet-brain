---
description: Open the RuvNet Brain Onboarding Console — a local web page that mirrors YOUR machine's RuvNet setup, explains it in plain English, and lets you safely configure and fix it. Read-only until you click; every machine change is explained first and is reversible.
---

Launch the **RuvNet Brain Onboarding Console** for the user — a locally-served web page that reads
their actual machine and lets them configure and (with consent) fix it.

Do this:

1. **Find the repo.** Prefer `~/Code/ruvnet-brain`. If `$CLAUDE_PLUGIN_ROOT` is set, the repo may be
   its parent directory. Use whichever path contains `scripts/onboarding-console.mjs`.

2. **Start the server in the BACKGROUND** (it is a long-running process) so this turn keeps going, and
   open the browser:

   ```
   node <repo>/scripts/onboarding-console.mjs --serve --open
   ```

   Run it with `run_in_background: true`. It binds `127.0.0.1` only and prints a line like
   `http://127.0.0.1:7411/`.

3. **Give the user the link** as a clickable `http://127.0.0.1:<port>/`, with one warm sentence:
   the page is **read-only until you click**, everything it can change to your computer is **explained
   in plain English and confirmed first**, and **Settings save at your user level**
   (`~/.claude/ruvnet-brain/config.json`) without touching how anything else on your machine runs.

4. If the server errors (e.g. `sqlite3` not found, or a bad node version), report it plainly and offer
   to fix it — don't leave them staring at a dead tab.

Do **not** narrate the machine yourself — the page is the mirror. Your job is just to get it open.
