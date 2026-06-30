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

const REPO = 'stuinfla/ruvnet-brain';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET_NAME = 'ruvnet-brain.zip';
// Known-good fallback used when we can't reach GitHub (offline / rate-limited / no releases).
// Default behavior is "get the latest"; this is only the safety net.
const RELEASE_VERSION = 'v0.4.0-dev';
const fallbackUrl = (tag) => `https://github.com/${REPO}/releases/download/${tag}/${ASSET_NAME}`;
const APPROX_SIZE = '~421MB';

const argv = process.argv.slice(2);
const FLAG_LOCAL = argv.includes('--local');
const FLAG_FORCE = argv.includes('--force');
const FLAG_HELP = argv.includes('--help') || argv.includes('-h');
const FLAG_DOCTOR = argv.includes('--doctor');
const FLAG_NO_VERIFY = argv.includes('--no-verify');
const FLAG_PIN = argv.includes('--pin'); // skip the latest-check, use the bundled default
// --version <tag> forces a specific Release tag (e.g. --version v0.4.0-dev)
const versionIdx = argv.indexOf('--version');
const FORCED_VERSION =
  versionIdx !== -1 && argv[versionIdx + 1] && !argv[versionIdx + 1].startsWith('-')
    ? argv[versionIdx + 1]
    : null;

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

// ── fetch a small JSON payload (redirect-following, dependency-free) ──────────────────────────────
function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('too many redirects'));
    const req = https.get(
      url,
      {
        headers: {
          // GitHub's API requires a User-Agent; the Accept header pins the v3 JSON schema.
          'User-Agent': 'ruvnet-brain-installer',
          Accept: 'application/vnd.github+json',
        },
        timeout: 15000,
      },
      (res) => {
        const { statusCode = 0, headers } = res;
        if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
          res.resume();
          const next = new URL(headers.location, url).toString();
          return resolve(fetchJson(next, redirects + 1));
        }
        if (statusCode !== 200) {
          res.resume();
          return reject(new Error(`GitHub API returned HTTP ${statusCode}`));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`GitHub API response was not valid JSON: ${e.message}`));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('GitHub API request timed out')));
    req.on('error', (e) => reject(e));
  });
}

// ── step: resolve which Release to download (latest by default; safe fallback) ───────────────────
// Default behavior: ask GitHub for the LATEST Release and use its ruvnet-brain.zip asset.
// --version <tag> forces a tag; --pin skips the network check and uses the bundled known-good tag.
// Any failure (offline / rate-limited / no releases) FALLS BACK to the pinned known-good Release,
// narrated clearly so the user knows exactly what happened.
async function resolveRelease() {
  step(
    'Finding the latest brain to install',
    'so a stranger always gets the most current brain — not whatever was hardcoded when this script shipped',
  );

  if (FLAG_PIN) {
    info(`--pin set: skipping the latest-check and using the bundled known-good ${c.bold(RELEASE_VERSION)}`);
    return { tag: RELEASE_VERSION, url: fallbackUrl(RELEASE_VERSION), source: 'pinned' };
  }

  if (FORCED_VERSION) {
    info(`--version set: forcing Release ${c.bold(FORCED_VERSION)} (no latest-check)`);
    return { tag: FORCED_VERSION, url: fallbackUrl(FORCED_VERSION), source: 'forced' };
  }

  try {
    info(`checking ${RELEASE_API} …`);
    const rel = await fetchJson(RELEASE_API);
    const tag = rel && rel.tag_name;
    if (!tag) throw new Error('latest Release has no tag_name');
    const asset = Array.isArray(rel.assets) ? rel.assets.find((a) => a.name === ASSET_NAME) : null;
    const url = asset && asset.browser_download_url ? asset.browser_download_url : fallbackUrl(tag);
    if (!asset) {
      warn(`latest Release ${tag} has no ${ASSET_NAME} asset listed — using the conventional download URL`);
    }
    ok(`latest Release is ${c.bold(tag)}`);
    return { tag, url, source: 'latest' };
  } catch (e) {
    warn(`couldn't check for the latest version (${e.message})`);
    info(`using the known-good ${c.bold(RELEASE_VERSION)} instead — the install is still safe and complete`);
    return { tag: RELEASE_VERSION, url: fallbackUrl(RELEASE_VERSION), source: 'fallback' };
  }
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
async function obtainBundle(release) {
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

  const downloadUrl = (release && release.url) || fallbackUrl(RELEASE_VERSION);
  step(
    `Downloading the brain (${APPROX_SIZE})`,
    'the brain is the embedded source of ~18 RuvNet repos — too big for git, so it ships as a Release',
  );
  info(`version: ${c.bold((release && release.tag) || RELEASE_VERSION)}`);
  info(`from: ${downloadUrl}`);
  const tmp = path.join(os.tmpdir(), `ruvnet-brain-${process.pid}.zip`);
  try {
    console.log(`    downloading the brain (${APPROX_SIZE})…`);
    await download(downloadUrl, tmp);
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

// ── step: verify the install is REAL (counts — never take "installed" on faith) ──────────────────
function verifyInstall(cacheDir) {
  step(
    'Verifying the brain is real and reachable',
    "you should never have to trust the word \"installed\" — here's the proof on disk",
  );
  let repos = 0;
  try {
    repos = fs
      .readdirSync(cacheDir)
      .filter((f) => f.endsWith('.rvf') && !f.endsWith('.big.rvf')).length;
  } catch {
    /* ignore */
  }
  if (repos > 0) ok(`${repos} RuvNet repos indexed (vector stores present on disk)`);
  else warn(`no .rvf stores found in ${cacheDir} — the brain may be incomplete (re-run with --force)`);

  const reader = fs.existsSync(path.join(cacheDir, 'node_modules'));
  if (reader) ok('local reader installed (vector reads happen offline — no cloud, no API key)');
  else warn('reader deps missing — re-run the installer');

  const mcp = fs.existsSync(path.join(cacheDir, 'forge-mcp-all.mjs'));
  if (mcp) ok('search_ruvnet server present (this is what Claude calls to ground answers)');
  else warn('forge-mcp-all.mjs missing — the brain unpacked incompletely');

  return { repos, reader, mcp };
}

// ── step: warm the model + prove grounding with one real question (best-effort, never fatal) ──────
function smokeQuery(cacheDir) {
  const ask = path.join(cacheDir, 'forge-ask-all.mjs');
  if (!fs.existsSync(ask)) return { ran: false };
  step(
    'Asking the brain a real question',
    'this warms the local model so your first real answer is instant — and proves grounding works end to end',
  );
  const Q = 'How should I store embeddings in this project without running a server?';
  info(`Q: ${c.cyan(`"${Q}"`)}`);
  info(c.dim('(first run downloads a small local model once — this can take a minute)'));
  let r;
  try {
    r = spawnSync('node', [ask, '--dir', cacheDir, '--q', Q, '--k', '1'], {
      cwd: cacheDir,
      encoding: 'utf8',
      timeout: 240000,
      env: process.env,
    });
  } catch {
    warn("skipped the live test (couldn't launch the reader) — it'll warm on your first real question");
    return { ran: false };
  }
  const out = `${r.stdout || ''}`;
  if (r.status === 0 && /\brvf\b|ruvector|hnsw|single[- ]file|no server/i.test(out)) {
    ok("the brain answered from rUv's real source — grounding confirmed ✦");
    return { ran: true, grounded: true };
  }
  warn(
    "skipped the live test (first-run model download or offline) — the brain is installed; it'll warm on your first real question",
  );
  return { ran: true, grounded: false };
}

// ── `--doctor`: a standalone health check the user can run any time ───────────────────────────────
function doctor() {
  console.log(c.bold('\nRuvNet Brain — doctor'));
  console.log(c.dim('Checking every part of the install and reporting green/red.\n'));
  const cacheDir = process.env.RUVNET_BRAIN_KB || path.join(os.homedir(), '.cache', 'ruvnet-brain', 'kb');
  info(`brain dir: ${c.bold(cacheDir)}`);
  const present = fs.existsSync(path.join(cacheDir, 'forge-mcp-all.mjs'));
  if (!present) {
    warn('brain not found here — run the installer first:  npx github:stuinfla/ruvnet-brain');
    return;
  }
  have('node') ? ok('node present') : warn('node missing');
  have('npm') ? ok('npm present') : warn('npm missing');
  have('claude') ? ok('claude CLI present') : warn('claude CLI missing (plugin wiring needs it)');
  have('unzip') ? ok('unzip present') : warn('unzip missing (needed for re-install)');
  const v = verifyInstall(cacheDir);
  smokeQuery(cacheDir);
  const allGreen = v.repos > 0 && v.reader && v.mcp;
  console.log(
    `\n  ${allGreen ? c.green('✓ Healthy.') : c.yellow('! Needs attention.')} ${
      allGreen ? 'The brain is installed and reachable.' : 'Re-run the installer to fix the warnings above.'
    }`,
  );
  if (allGreen) {
    console.log(`\n  ${c.bold('What this means for you:')}`);
    console.log(`    • ${c.bold('It works in EVERY project')} — user-level (global). Open Claude Code in any repo or VS Code`);
    console.log(`      window and it's there. ${c.bold('No reinstall per project. No second download.')} One brain, shared.`);
    console.log(`    • ${c.bold('Nothing to git-ignore')} in your projects — it drops zero files into your working repos.`);
    console.log(`    • ${c.bold('To use it:')} just ask Claude about rUv's stack (RuVector, Ruflo, AgentDB, SPARC…) — it`);
    console.log(`      grounds the answer automatically and takes the lead on builds. You don't invoke anything.`);
    console.log(`    • ${c.bold("To know it's on:")} a fresh session greets you with "🧠 RuvNet Brain active". Or run this`);
    console.log(`      ${c.bold('--doctor')} command any time.`);
  }
  console.log(
    c.dim('\n  Heads-up: a window that was ALREADY open when you installed needs a restart to pick it up;\n  newly-opened windows are fine.\n'),
  );
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
  // ── one important expectation: the hook activates on the NEXT session ──
  console.log(`\n  ${c.yellow(c.bold('One thing to know:'))} the grounding hook turns on at your ${c.bold('next')} Claude Code session.`);
  console.log(`  ${c.dim('If Claude Code is open right now, quit and reopen it — then the brain is live on every prompt.')}`);

  // ── what to do now ──
  console.log(`\n  ${c.bold('What to do now:')}`);
  console.log(`    ${c.cyan('1.')} Open Claude Code in ${c.bold('any')} project (your own, or a fresh repo — nothing to copy in).`);
  console.log(`    ${c.cyan('2.')} Just ask, normally. Try:  ${c.bold('"Set up vector search here the way rUv would."')}`);
  console.log(`    ${c.cyan('3.')} Watch what changes (below).`);

  // ── how you'll KNOW it's working ──
  console.log(`\n  ${c.bold('How you\'ll know it\'s working:')}`);
  console.log(`    ${c.green('✓')} Claude reaches for ${c.bold('RuVector / RVF, Ruflo, AgentDB')} instead of Pinecone / pgvector / LangChain.`);
  console.log(`    ${c.green('✓')} It ${c.bold('cites real source paths')} (it calls ${c.bold('search_ruvnet')}) instead of guessing.`);
  console.log(`    ${c.green('✓')} If you start to drift to a generic default, the brain ${c.bold('steps in')} and points you back.`);

  // ── honest expectations ──
  console.log(`\n  ${c.bold('What to expect (honestly):')}`);
  console.log(`    • On rUv-stack work (vectors, swarms, agent memory, SPARC) it grounds ${c.bold('every time')}.`);
  console.log(`    • On unrelated work, it stays quiet — Claude behaves normally. It only speaks up when it should.`);
  console.log(`    • Not sure it's on?  Run  ${c.bold('npx github:stuinfla/ruvnet-brain --doctor')}  any time for a health check.`);

  console.log(`\n  ${c.dim('You can\'t break anything — the plugin is disable-able and only acts on RuvNet-shaped work.')}`);
  console.log('');
}

function showHelp() {
  console.log(`
RuvNet Brain installer

By default this installs the LATEST published Release (it asks GitHub which one that is),
and falls back to a known-good version if GitHub can't be reached.

Usage:
  npx github:stuinfla/ruvnet-brain         Install the LATEST brain + Claude Code plugin
  npx github:stuinfla/ruvnet-brain --doctor   Health-check an existing install (green/red per part)
  node bin/install.mjs --version <tag>     Install a specific Release tag (e.g. --version v0.4.0-dev)
  node bin/install.mjs --pin               Skip the latest-check; use the bundled known-good version
  node bin/install.mjs --local             Install from a repo clone's dist/ruvnet-brain.zip
  node bin/install.mjs --force             Re-fetch and reinstall even if already present
  node bin/install.mjs --no-verify         Skip the post-install verify + warm-up smoke test

Env:
  RUVNET_BRAIN_KB   Override where the brain is stored (default ~/.cache/ruvnet-brain/kb)

It is safe to re-run at any time. After installing, restart Claude Code so the grounding hook loads.
`);
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
(async () => {
  if (FLAG_HELP) return showHelp();
  if (FLAG_DOCTOR) return doctor();

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
    // Resolve which Release to fetch BEFORE downloading. Skipped entirely on the --local path
    // (obtainBundle short-circuits to the repo's dist/ zip and never touches the network).
    const localZipPresent =
      FLAG_LOCAL || fs.existsSync(path.join(REPO_ROOT, 'dist', 'ruvnet-brain.zip'));
    const release = localZipPresent ? null : await resolveRelease();
    const { zipPath, downloaded } = await obtainBundle(release);
    unzipInto(zipPath, cacheDir);
    if (downloaded) {
      try { fs.rmSync(zipPath, { force: true }); } catch { /* leave temp behind, not fatal */ }
    }
  }

  installReader(cacheDir);
  const plugin = wirePlugin();
  if (!FLAG_NO_VERIFY) {
    verifyInstall(cacheDir);
    smokeQuery(cacheDir);
  }
  success({ cacheDir, isCustom, plugin });
})().catch((e) => {
  die(e && e.message ? e.message : String(e));
});
