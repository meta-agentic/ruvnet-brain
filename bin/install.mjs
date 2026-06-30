#!/usr/bin/env node
// bin/install.mjs — the one-command installer for RuvNet Brain.
//
//   npx github:stuinfla/ruvnet-brain          # works today (fetches the brain from the Release)
//   npx ruvnet-brain                           # once published to npm
//   node bin/install.mjs --local               # from a repo clone that already has dist/ruvnet-brain.zip
//
// Goal: a newcomer runs ONE command and ends up with (a) the brain on disk and (b) the Claude Code
// plugin wired at user scope — narrating "what I'm doing and why" at every step (the product's ethos).
//
// Design rules: dependency-free (Node built-ins + shelling to unzip/npm/claude only), idempotent
// (safe to re-run), and never a silent half-state (every failure explains the next step).

import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const RELEASE_VERSION = 'v0.4.0-dev';
const RELEASE_URL = `https://github.com/stuinfla/ruvnet-brain/releases/download/${RELEASE_VERSION}/ruvnet-brain.zip`;
const APPROX_SIZE = '~421MB';

const argv = process.argv.slice(2);
const FLAG_LOCAL = argv.includes('--local');
const FLAG_FORCE = argv.includes('--force');
const FLAG_HELP = argv.includes('--help') || argv.includes('-h');

// ── tiny narrating logger — every step says WHAT and WHY ─────────────────────────────────────────
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};
let stepNo = 0;
function step(what, why) {
  stepNo += 1;
  console.log(`\n${c.cyan(`[${stepNo}]`)} ${c.bold(what)}`);
  if (why) console.log(`    ${c.dim('why: ' + why)}`);
}
const info = (s) => console.log(`    ${s}`);
const ok = (s) => console.log(`    ${c.green('✓')} ${s}`);
const warn = (s) => console.log(`    ${c.yellow('!')} ${s}`);

function die(msg, hint) {
  console.error(`\n${c.red('✗ install stopped:')} ${msg}`);
  if (hint) console.error(`\n${hint}`);
  console.error(
    `\nNothing is left half-installed — fix the above and re-run the same command (it's safe to re-run).`,
  );
  process.exit(1);
}

// ── shell helpers ────────────────────────────────────────────────────────────────────────────────
function have(cmd) {
  const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return !probe.error;
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`\`${cmd} ${args.join(' ')}\` exited with code ${r.status}`);
}
function tryRun(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  return !r.error && r.status === 0;
}

// ── download with redirect-following + progress ──────────────────────────────────────────────────
function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('too many redirects'));
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'ruvnet-brain-installer', Accept: 'application/octet-stream' } },
      (res) => {
        const { statusCode = 0, headers } = res;
        if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
          res.resume(); // drain so the socket frees up
          const next = new URL(headers.location, url).toString();
          return resolve(download(next, dest, redirects + 1));
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new Error(`server returned HTTP ${statusCode}`));
        }
        const total = Number(headers['content-length'] || 0);
        let received = 0;
        let lastShown = -1;
        const out = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          received += chunk.length;
          const mb = (received / 1e6).toFixed(0);
          if (total) {
            const pct = Math.floor((received / total) * 100);
            if (pct !== lastShown && pct % 5 === 0) {
              process.stdout.write(`\r    …${pct}% (${mb}MB / ${(total / 1e6).toFixed(0)}MB)`);
              lastShown = pct;
            }
          } else if (mb % 20 === 0 && Number(mb) !== lastShown) {
            process.stdout.write(`\r    …${mb}MB`);
            lastShown = Number(mb);
          }
        });
        res.pipe(out);
        out.on('finish', () => out.close(() => {
          process.stdout.write('\n');
          resolve();
        }));
        out.on('error', (e) => reject(e));
      },
    );
    req.on('error', (e) => reject(e));
  });
}

// ── step: resolve the cache dir ──────────────────────────────────────────────────────────────────
function resolveCacheDir() {
  const custom = process.env.RUVNET_BRAIN_KB;
  const cacheDir = custom || path.join(os.homedir(), '.cache', 'ruvnet-brain', 'kb');
  step(
    'Choosing where the brain will live',
    'the Claude Code plugin looks here by default, so put it where it expects',
  );
  info(`brain dir: ${c.bold(cacheDir)}`);
  if (custom) info(`(from your RUVNET_BRAIN_KB override)`);
  fs.mkdirSync(cacheDir, { recursive: true });
  return { cacheDir, isCustom: Boolean(custom) };
}

// ── step: obtain the bundle (local or download) ──────────────────────────────────────────────────
async function obtainBundle() {
  const localZip = path.join(REPO_ROOT, 'dist', 'ruvnet-brain.zip');
  const haveLocal = fs.existsSync(localZip);

  if (FLAG_LOCAL && !haveLocal) {
    die(
      `--local was passed but ${localZip} does not exist.`,
      `Build it first with:  ${c.bold('node scripts/build-bundle.mjs')}  (then re-run with --local),\nor drop --local to download the published brain instead.`,
    );
  }

  if (haveLocal || FLAG_LOCAL) {
    step('Using the local brain bundle', 'you are running from the repo, so no download is needed');
    info(`source: ${localZip}`);
    return { zipPath: localZip, downloaded: false };
  }

  step(
    `Downloading the brain (${APPROX_SIZE})`,
    'the brain is the embedded source of ~18 RuvNet repos — too big for git, so it ships as a Release',
  );
  info(`from: ${RELEASE_URL}`);
  const tmp = path.join(os.tmpdir(), `ruvnet-brain-${process.pid}.zip`);
  try {
    console.log(`    downloading the brain (${APPROX_SIZE})…`);
    await download(RELEASE_URL, tmp);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
    die(
      `couldn't download the brain (${e.message}).`,
      `Check your connection, then re-run. Or, if you have a repo clone, build the bundle locally\n(${c.bold('node scripts/build-bundle.mjs')}) and run ${c.bold('node bin/install.mjs --local')}.`,
    );
  }
  ok(`downloaded to ${tmp}`);
  return { zipPath: tmp, downloaded: true };
}

// ── step: unzip into the cache dir (flattening the top-level ruvnet-brain/ folder) ───────────────
function unzipInto(zipPath, cacheDir) {
  step(
    'Unpacking the brain into place',
    'so the plugin finds forge-mcp-all.mjs and the vector stores right where it looks',
  );
  if (!have('unzip')) {
    die(
      `the \`unzip\` command isn't available on this machine.`,
      `Install it and re-run:\n  • macOS:  already built in (this is unusual — check your PATH)\n  • Debian/Ubuntu:  ${c.bold('sudo apt-get install -y unzip')}\n  • Fedora/RHEL:  ${c.bold('sudo dnf install -y unzip')}`,
    );
  }

  // The zip extracts to a top-level `ruvnet-brain/` folder. Extract into the cache dir, then lift
  // its CONTENTS up one level so that cacheDir/forge-mcp-all.mjs exists (idempotent: -o overwrites).
  try {
    run('unzip', ['-q', '-o', zipPath, '-d', cacheDir]);
  } catch (e) {
    die(`unzip failed (${e.message}).`, `The archive may be incomplete — re-run to download a fresh copy.`);
  }

  const nested = path.join(cacheDir, 'ruvnet-brain');
  if (fs.existsSync(path.join(nested, 'forge-mcp-all.mjs'))) {
    for (const entry of fs.readdirSync(nested)) {
      const from = path.join(nested, entry);
      const to = path.join(cacheDir, entry);
      fs.rmSync(to, { recursive: true, force: true }); // idempotent overwrite
      fs.renameSync(from, to); // same filesystem → cheap rename
    }
    fs.rmdirSync(nested);
  }

  if (!fs.existsSync(path.join(cacheDir, 'forge-mcp-all.mjs'))) {
    die(
      `the brain unpacked but forge-mcp-all.mjs is missing from ${cacheDir}.`,
      `The archive layout may have changed. Re-run, or report this at https://github.com/stuinfla/ruvnet-brain/issues`,
    );
  }
  ok(`brain unpacked to ${cacheDir}`);
}

// ── step: install the reader deps ────────────────────────────────────────────────────────────────
function installReader(cacheDir) {
  step(
    'Installing the local reader',
    'the brain reads its vectors with @ruvector/rvf and reranks with a local model — no cloud calls',
  );
  if (!have('npm')) {
    die(`\`npm\` isn't available, but the brain needs it for its reader.`, `Install Node.js (which includes npm) and re-run.`);
  }
  info('installing the local reader…');
  try {
    run('npm', ['i', '--no-audit', '--no-fund'], { cwd: cacheDir });
  } catch (e) {
    die(`the reader install failed (${e.message}).`, `Re-run after checking your network / npm setup.`);
  }
  ok('reader installed');
}

// ── step: wire the Claude Code plugin ────────────────────────────────────────────────────────────
function wirePlugin() {
  step(
    'Wiring the Claude Code plugin',
    'this registers search_ruvnet + the grounding hook so Claude uses the brain automatically',
  );
  const manualMarketplace = 'claude plugin marketplace add stuinfla/ruvnet-brain';
  const manualInstall = 'claude plugin install ruvnet-brain@ruvnet-brain --scope user';

  if (!have('claude')) {
    warn(`the \`claude\` CLI isn't installed — skipping plugin wiring (the brain itself is fully installed).`);
    info(`When you have Claude Code, finish wiring with these two commands:`);
    info(`  ${c.bold(manualMarketplace)}`);
    info(`  ${c.bold(manualInstall)}`);
    return { wired: false, manualMarketplace, manualInstall };
  }

  const addedMarket = tryRun('claude', ['plugin', 'marketplace', 'add', 'stuinfla/ruvnet-brain']);
  if (!addedMarket) warn(`couldn't add the marketplace automatically (it may already be added — that's fine).`);

  const installed = tryRun('claude', ['plugin', 'install', 'ruvnet-brain@ruvnet-brain', '--scope', 'user']);
  if (installed) {
    ok('plugin installed at user scope (global, alongside Ruflo / RuVector)');
    return { wired: true, manualMarketplace, manualInstall };
  }

  warn(`couldn't install the plugin automatically. Run these two commands yourself:`);
  info(`  ${c.bold(manualMarketplace)}`);
  info(`  ${c.bold(manualInstall)}`);
  return { wired: false, manualMarketplace, manualInstall };
}

// ── final success block ──────────────────────────────────────────────────────────────────────────
function success({ cacheDir, isCustom, plugin }) {
  const line = '─'.repeat(64);
  console.log(`\n${c.green(line)}`);
  console.log(`${c.green(c.bold('  RuvNet Brain is installed.'))}`);
  console.log(`${c.green(line)}`);
  console.log(`\n  What you now have:`);
  console.log(`    • the brain (embedded source of ~18 RuvNet repos) at:`);
  console.log(`        ${c.bold(cacheDir)}`);
  console.log(
    `    • the Claude Code plugin ${plugin.wired ? c.green('wired at user scope') : c.yellow('(finish the 2 commands above)')} — search_ruvnet + grounding hook`,
  );
  if (isCustom) {
    console.log(`\n  ${c.yellow('Heads up:')} you installed to a custom dir, so make this export permanent`);
    console.log(`  (add it to your shell profile) so the plugin can find the brain:`);
    console.log(`    ${c.bold(`export RUVNET_BRAIN_KB="${cacheDir}"`)}`);
  }
  console.log(`\n  Try it — open Claude Code in any project and ask:`);
  console.log(`    ${c.cyan('Ask Claude: "How should I store embeddings in this project?"')}`);
  console.log(`\n  ${c.dim('First answer downloads a small local model once, then it\'s fast and offline.')}`);
  console.log('');
}

function showHelp() {
  console.log(`
RuvNet Brain installer

Usage:
  npx github:stuinfla/ruvnet-brain      Install the brain + Claude Code plugin (downloads the brain)
  node bin/install.mjs --local          Install from a repo clone's dist/ruvnet-brain.zip
  node bin/install.mjs --force          Re-fetch and reinstall even if already present

Env:
  RUVNET_BRAIN_KB   Override where the brain is stored (default ~/.cache/ruvnet-brain/kb)

It is safe to re-run at any time.
`);
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
(async () => {
  if (FLAG_HELP) return showHelp();

  console.log(c.bold('\nRuvNet Brain — installer'));
  console.log(c.dim("I'll set up the brain and the Claude Code plugin, explaining each step as I go.\n"));

  const { cacheDir, isCustom } = resolveCacheDir();

  const alreadyInstalled = fs.existsSync(path.join(cacheDir, 'forge-mcp-all.mjs'));
  if (alreadyInstalled && !FLAG_FORCE) {
    step(
      'Brain already present — skipping the download',
      "it's already unpacked here; I'll just make sure the reader and plugin are wired (use --force to refetch)",
    );
    ok(`found an existing brain at ${cacheDir}`);
  } else {
    const { zipPath, downloaded } = await obtainBundle();
    unzipInto(zipPath, cacheDir);
    if (downloaded) {
      try { fs.rmSync(zipPath, { force: true }); } catch { /* leave temp behind, not fatal */ }
    }
  }

  installReader(cacheDir);
  const plugin = wirePlugin();
  success({ cacheDir, isCustom, plugin });
})().catch((e) => {
  die(e && e.message ? e.message : String(e));
});
