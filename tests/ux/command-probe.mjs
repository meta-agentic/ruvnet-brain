// command-probe.mjs — MEASURED command→explanation latency + the "it's live" completion signal.
//
// The owner's ask, verbatim intent: "How long after somebody asks [for the brain console] before they
// see something on the screen in Terminal explaining exactly what's going to happen — that should be
// relatively instant. A countdown or something that then eventually tells them, okay it's live, take a
// look at your page."
//
// So this probe times, on a REAL cold launch of the console server:
//   2  — command invoked → first non-blank explanatory line (should be near-instant)
//   3a — a completion signal ("it's live … take a look at your page") EXISTS at all
//   3b — command → that completion signal (reported, not gated — it varies with the cold scan)
//   3c — no dead-air: the largest silent gap between output lines
//
// It forces a COLD start with an isolated, empty HOME (CONFIG_DIR = $HOME/.claude/ruvnet-brain), so the
// scanning→"it's live" flow is actually exercised WITHOUT touching the user's real ~/.claude cache.
//
// MODEL-FREE: spawns a process and reads its stdout timestamps. No LLM, no API key, no account. We use
// Node's own child_process rather than expect(1) because the console server is a long-lived process we
// start and kill directly — a PTY adds nothing here and node-pty is deliberately NOT a dependency.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CONSOLE_MJS = path.join(REPO, 'scripts', 'onboarding-console.mjs');

// The completion signal, as emitted by announceWhenLive() in onboarding-console.mjs. Matching the
// real emitted text (not a paraphrase) is the point — if the launcher's wording changes, this probe
// must be updated in lockstep, which is the correct coupling for a signal-exists assertion.
const LIVE_SIGNAL = /it's live|take a look|refresh the tab/i;
const EXPLANATION = /Onboarding Console|read-only until you click|scanning your setup/i;

export function runCommandProbe({ timeoutMs = 60000 } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'uxqe-cold-'));
  const port = 7900 + (process.pid % 90);   // a distinct cold port; vary per run without Date/random
  const env = { ...process.env, HOME: home, CONSOLE_PORT: String(port) };
  const t0 = Date.now();
  const lines = [];   // { at: ms-since-start, text }
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CONSOLE_MJS, '--serve'], { env, stdio: ['ignore', 'pipe', 'pipe'], cwd: REPO });
    const onChunk = (buf) => {
      const at = Date.now() - t0;
      for (const raw of String(buf).split('\n')) {
        const text = raw.replace(/\x1b\[[0-9;]*m/g, '').trimEnd();
        if (text.trim() === '') continue;
        lines.push({ at, text });
      }
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);

    const finish = () => {
      try { child.kill('SIGINT'); } catch {}
      try { child.kill('SIGKILL'); } catch {}
      try { fs.rmSync(home, { recursive: true, force: true }); } catch {}

      const firstExplain = lines.find((l) => EXPLANATION.test(l.text));
      const liveLine = lines.find((l) => LIVE_SIGNAL.test(l.text));
      // dead-air: largest gap between consecutive emitted lines, from command start to the live signal
      const upto = liveLine ? lines.filter((l) => l.at <= liveLine.at) : lines;
      let maxGap = upto.length ? upto[0].at : 0;   // gap from t0 to first line counts too
      for (let i = 1; i < upto.length; i++) maxGap = Math.max(maxGap, upto[i].at - upto[i - 1].at);

      resolve({
        commandToExplanationMs: firstExplain ? firstExplain.at : null,
        completionSignalPresent: !!liveLine,
        commandToLiveMs: liveLine ? liveLine.at : null,
        maxDeadAirMs: maxGap,
        liveSignalText: liveLine ? liveLine.text.trim() : null,
        lineCount: lines.length,
        firstLines: lines.slice(0, 6).map((l) => `${l.at}ms  ${l.text.trim()}`),
      });
    };

    // Resolve as soon as we have the live signal (plus a beat), else on timeout.
    const poll = setInterval(() => {
      if (lines.some((l) => LIVE_SIGNAL.test(l.text))) { clearInterval(poll); setTimeout(finish, 100); }
    }, 200);
    setTimeout(() => { clearInterval(poll); finish(); }, timeoutMs);
    child.on('error', () => { clearInterval(poll); finish(); });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('command-probe.mjs')) {
  runCommandProbe().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.completionSignalPresent ? 0 : 1); });
}
