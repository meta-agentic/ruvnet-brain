---
description: "RvBC — RuvNet Brain Console. Opens the live console page: your whole RuvNet stack on one page — what's installed, what your AI learned, one-click reversible fixes. Read-only until you click. (Also: /rvcb, /brain-console — all the same thing.)"
---

Launch the **RuvNet Brain Console** for the user. Same console as `/ruvnet-brain:configure`,
`/rvcb`, and `/brain-console` — every spelling lands here, so never tell the user they typed it wrong.

## 1. SPEAK FIRST — before you run anything

The console scans their machine before the page can render. That takes **~20 seconds normally, and
up to a minute the first time** while it does one-time work. Twenty seconds of a blank screen with
no explanation feels broken, and the user has no way to know whether to wait or interrupt.

So your FIRST output — before any tool call — is one short, warm heads-up in your own words. Cover:

- you're going to look over their setup (what's installed, what the AI has learned)
- then it opens in their **browser** as a visual page they can work with
- **about 20 seconds**, and **up to a minute on a first run** while it does one-time setup
- ask them to hang tight

Say it like a person, not a status bar. Something in the spirit of:

> "Let me take a look at your setup — I'll scan what's installed and what your brain has learned,
> then open it as a page in your browser so you can see it all at once. Takes about 20 seconds;
> the very first run can take up to a minute while it does some one-time work. Hang tight."

## 2. Find the repo

Prefer `~/Code/ruvnet-brain`. If `$CLAUDE_PLUGIN_ROOT` is set, the repo may be its parent
directory. Use whichever path actually contains `scripts/onboarding-console.mjs`.

## 3. Start it in the BACKGROUND and open the browser

```
node <repo>/scripts/onboarding-console.mjs --serve --open
```

Run with `run_in_background: true` — it is a long-running server, so this keeps the turn alive.
It binds `127.0.0.1` only and prints a line like `http://127.0.0.1:7411/`.

**If it reports it is already running**, that is a success, not an error — the page is still served
at that URL. Open it yourself with `open "http://127.0.0.1:<port>/"` rather than reporting a problem.

## 4. Confirm it actually opened

Give them the URL as a clickable line, and one warm sentence: the page is **read-only until you
click**, every machine change is **explained first and reversible**, and Settings save at the user
level only.

If the browser did not open (they'll tell you), run `open "http://127.0.0.1:<port>/"` directly.

## 5. If it errors

Report it plainly — the real error, not a guess — and offer to fix it. Never leave them staring at
a dead tab wondering whether it is still loading.

---

Do **not** narrate the machine yourself afterwards; the page is the mirror. Your job is to set
expectations, get it open, and get out of the way.
