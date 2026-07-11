# Contributors

Thank you to everyone who has helped make RuvNet Brain better!

## Project Creator
- **[stuinfla](https://github.com/stuinfla)** (Stuart Kerr) — Project creator and maintainer

## Code Contributors

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
