# Work register — the owner's standing asks, 2026-07-27

Not a status report. A durable list that survives a session ending, an agent dying, or a context
compaction. Every row: what he asked, where it is, what closes it. Updated in the commit that
changes a row — never separately.

| # | The ask (his words, compressed) | State | What closes it |
|---|---|---|---|
| 1 | **Fix open issues before publish** — open means unfinished, close professionally, no shortcuts | #44 core fix BUILT (recursive shell parser in hook-input.mjs, 648 insertions, `/tmp/wt-44`), plumbing unfinished; #46 partial (`/tmp/wt-46`) | Both merged with red-first proof, CI green both OSes, closed with evidence + personal thanks |
| 2 | **Fix the contributor PRs** | DONE — #45 + #47 cherry-picked with authorship intact, landed `30505a9`, both closed with credit + reproduction evidence | — |
| 3 | **Architectural issue-triage program** — every issue reviewed for larger architectural signal, both models | Fable delivered: 33 issues → 7 classes, C1 (regex-not-structure) OPEN across #12/#13/#41/#44, C7 (ceremony-not-substance) the generator class. **GPT side unread.** | Read GPT, converge, ship `scripts/issue-arch-review.mjs` + class registry + the #12-replay canary |
| 4 | **Grade the QE suite on experience, not pass counts** | DONE — 53/100, D8=40 the floor. One-line diagnosis: world-class at not lying about itself, weak at leaving the author's machine. **GPT side unread.** | Converge both graders; re-grade after the fixes land |
| 5 | **Per-feature QE gate** — new functionality auto-covered, run for completeness, subscription seats only, never metered | Designed (Fable Task C): coverage markers + bidirectional lint inside wired-check; `seat-exec` fence that strips metered keys and refuses without explicit consent | Built, with the fixture that proves an uncovered capability blocks the ship |
| 6 | **MetaHarness deep review, gradations not on/off** | Fable delivered + corrected me: Darwin is a devDep (never shipped); the entire FREE read layer runs on no schedule; **rUv already built subscription-seat TDR** (`tdd-repair.mjs`, headless `claude -p`) so the hero capability needs no metered inference. **GPT side unread.** | Converge, then wire the free security read layer first (B1) |
| 7 | **Proactive intake — never check GitHub again** | Gap PROVEN: `issue-watch.mjs:135` queries issues only; PRs get one ntfy ping at creation then silence forever — which is why #45/#47 sat. Duel launched; **GPT side unread.** | Intake architecture shipped: PRs watched, daily guarantee with positive confirmation, auto-acknowledge, escalate only when a human is genuinely needed |
| 8 | **Check GitHub + Vercel CLIs on every deploy — protocol, not habit** | DONE — gate D+ shipped `afe5a56`: non-ci workflow failures, dependabot advisories, production-deployment readiness | — |
| 9 | **QE improvement cycle — any grade <95 → gap analysis → clean elegant fix; next grade in the 90s** | Plan delivered and accepted in principle: Move 1 wire six existing-but-unwired instruments (advisory→blocking ladder), Move 2 the user-machine battery, Move 3 four targeted tests. Deficit is ~40% unwired instruments, not missing tests. | Moves executed; rubric made ~70% mechanically derivable so the grade cannot be argued upward |
| 10 | **Fix the two lying surfaces + the D8 post-install check** | Both specified; both builders died to the API throttling. Root cause found and it is worse than the symptom: the honesty gate grades against a coverage artifact that was 9 days stale and then vanished — it can emit a false PASS. | Freshness as a precondition (stale/absent ⇒ loud UNVERIFIABLE, never a number), regenerate-never-hand-type, and `--doctor --hooks` that exits non-zero on a stranger's broken machine |

## Discipline debt, named
**Six GPT-5.6 verdicts (9.7 MB) are on disk unread** — items 3, 4, 6, 7 and the fourth-wall design have
been reported from Fable's side alone. A duel consumed on one side is not a duel. Reading and
converging them is the next action, ahead of new builds.

## Standing rules these all inherit
Subscription seats, never metered API (verified: no metered key exists in the environment — the fence
is an absence, not a policy). Red-first proof or it did not happen. A test that cannot fail on broken
code is not a test. The product can never lie — including about itself.
