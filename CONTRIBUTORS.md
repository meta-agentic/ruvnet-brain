# Contributors

Updated: 2026-07-19
Created: 2026-07-10

Thank you to everyone who has helped make RuvNet Brain better!

## Project Creator
- **[stuinfla](https://github.com/stuinfla)** (Stuart Kerr) — Project creator and maintainer

## Code Contributors

- **[lafinak](https://github.com/lafinak)** (Jan Lafko) — Two hand-verified reader investigations,
  done with the project's own re-derive-don't-assert discipline (#27, #29):
  - Traced the second-query deadlock on a corrupted model cache to 27/28 threads parked in
    `futex_wait_queue` (via `/proc`), designed the corrupted-cache self-heal, and verified his own fix
    by deliberately re-truncating the files — then wrote the minimal regression repro now wired into
    the suite (`tests/regression/reader-deadlock-pr0p.mjs` + `tests/integration/reader-deadlock-regression.test.mjs`),
    flagging the subtlety that only an **OS-level** timeout can catch a deadlock that freezes the event
    loop (an in-process `setTimeout`/vitest timeout never fires) (#29)
  - Chased the onnxruntime `blob:`-Worker rejection upstream far enough to find the supposed fix never
    covered onnxruntime-node's automatic native→wasm fallback path (#29)
  - Surfaced, from an ordinary dev session, the `search_ruvnet` staleness-caveat gap and an exact-name
    ranking miss (an exact package-name query not ranking that package first) (#29)

- **[evaplusai](https://github.com/evaplusai)** (Eva Draganova) — Field-tested the brain through a real
  3-day production build and turned what she learned into fixes (PR #8)
  - Relevance-gated the TAKE-THE-WHEEL hook with a two-signal gate (build verb **and**
    project-scale object) — the old verb-only trigger over-fired on small edits,
    costing ~55k injected tokens per session; her fix silenced it without losing a single
    real build prompt, verified against her own session transcript
  - Hand-wrote the 7-rule standing prompt that forced the brain into disciplined,
    self-grading autonomous builds — the field pattern that was productized as the
    `/brain-build` and `/brain-prompt` skills (credited in both SKILL.md files)

- **[marioja](https://github.com/marioja)** (Mario Jauvin) — Made the installer actually work on
  Windows, and fixed a RuVector auto-install bug that bit every platform (PR #1, #2, #3)
  - Windows unzip/npm fallback: PowerShell `Expand-Archive` when `unzip` is missing, and
    `shell: true` for `.cmd` shims that `spawnSync` can't launch directly (PR #1)
  - RuVector auto-install: added `--scope user` (it was silently installing to whatever
    directory the installer ran from) and fixed detection to read the file
    `claude mcp add` actually writes (PR #2)
  - Windows PowerShell 5.1 detection: probe with a command both `powershell.exe` and `pwsh`
    understand, plus `-ExecutionPolicy Bypass` for locked-down sandboxes (PR #3)

## Field Reporters

- **[sparkling](https://github.com/sparkling)** — the project's most prolific field reporter:
  eight surgical issues plus a coverage PR (#5), every single one legitimate, several
  shipping-critical. Highlights:
  - Caught the v3.1.0 console crash (#15) — a missing export that broke `/rvbc` on every
    fresh install; report named the exact symbol *and* the process.exit-inside-a-server
    hazard behind it. Fixed same day it was triaged (v3.2.8)
  - Found two real defects in the interface-verification gate (#12, #13) — a quote-truncating
    payload parser and an override that could never work as documented — including actually
    testing the documented override before reporting it. Both fixed with pinned tests (v3.2.9)
  - Caught the upstream metaharness rename (#10) before our own tooling did, a stale npm
    dist-tag (#11), missing directories in the shipped bundle (#6), and the gap between the
    advertised nightly freshness and what end users actually received (#4)

  Five reports in five days drove the v3.2.8–v3.2.9 releases. This is what "field reports are
  where the best fixes come from" looks like in practice.

## Special Thanks
To everyone who has installed the brain, reported what broke, and told us what they built with it.
Field reports like the ones above are where the best fixes come from.

---

## How to Contribute

We welcome contributions from everyone! If you'd like to contribute:

1. Check the [open issues](https://github.com/stuinfla/ruvnet-brain/issues) or start a
   [Discussion](https://github.com/stuinfla/ruvnet-brain/discussions)
2. Fork the repository
3. Create a feature branch
4. Make your changes (see [CONTRIBUTING.md](CONTRIBUTING.md) for the build/test map)
5. Submit a pull request

When your contribution is merged, you'll be added to this list!

## Updating This File

When merging significant contributions, please update this file to recognize the contributor. Include:
- GitHub username with link
- Brief description of contributions
- Related issue/PR numbers
