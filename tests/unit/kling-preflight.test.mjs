// tests/unit/kling-preflight.test.mjs — the gate that stops me paying for prompts that ignore the
// technique I just researched.
//
// WHY (2026-07-13). Stuart told me to become a Kling black belt BEFORE building. I researched the
// docs, wrote the operator guide — then generated six clips with my ORIGINAL prompts: no soundscape
// (Kling returned near-silent room-tone at -31dB), no film-language camera. He paid for footage that
// ignored everything I'd just learned. "You spent the time and the credits to learn how to do it,
// and then you never bothered to follow your own instructions?"
//
// The load-bearing test is the first one: it re-introduces the REAL prompt from that failure and
// requires the gate to kill it. A check that passes on the bug it was written for is worse than none.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GATE = path.resolve(import.meta.dirname, '../../plugin/scripts/kling-preflight.sh');
const hasBash = spawnSync('bash', ['-c', 'exit 0']).status === 0;

// The gate's verdict comes from a MODEL, not a keyword list (Stuart: "Regex is stupidly brittle…
// You need a qualitative pass on it." — proven within minutes when the word `rain` matched inside
// "b-RAIN orb" and declared a soundless prompt to have sound design).
//
// So the tests inject a STUB judge via CLAUDE_BIN. That keeps them hermetic, free, and fast — and it
// tests what the gate actually does: enforce a verdict. The judge's own quality is a separate
// concern, exercised live (see the `live` test at the bottom, skipped without a real claude binary).
function stubJudge(verdict) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kpf-j-')), 'claude');
  fs.writeFileSync(p, `#!/bin/bash\nprintf '%s\\n' ${JSON.stringify(verdict)}\n`);
  fs.chmodSync(p, 0o755);
  return p;
}

function run(command, { optedIn = true, judge = 'CAMERA=YES\nAUDIO=YES', noJudge = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kpf-'));
  if (optedIn) {
    fs.mkdirSync(path.join(home, '.claude/model-router'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude/model-router/profile.json'), '{}');
  }
  const env = { ...process.env, HOME: home };
  env.CLAUDE_BIN = noJudge ? '/nonexistent/claude' : stubJudge(judge);
  const r = spawnSync('bash', [GATE], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env, encoding: 'utf8',
  });
  return { status: r.status, stderr: r.stderr || '' };
}

// The actual prompt that produced the near-silent, weakly-directed footage.
const THE_REAL_MISS =
  'kling image_to_video --model kling-video-v3_0_turbo --image shot4.png --duration 5 ' +
  '"The luminous brain orb descends smoothly toward the desk, glowing tendrils connecting into the ' +
  'terminal, the room igniting with cyan and amber light, dust motes swirling. Magical and warm."';

// The same shot, written the way the guide demands.
const THE_BLACK_BELT =
  'kling image_to_video --model kling-video-v3_0_turbo --image shot4.png --duration 5 ' +
  '"Slow dolly-in as the luminous brain-orb descends toward the desk, rack focus to its glowing ' +
  'tendrils meeting the terminal; a low synth swell rises and a warm chime rings as it connects, ' +
  'distant keyboard clicks beneath."';

describe.skipIf(!hasBash || process.platform === 'win32')('kling-preflight.sh — no paid generation without the technique', () => {
  it('BLOCKS the exact 2026-07-13 miss when the judge says the prompt lacks both', () => {
    const r = run(THE_REAL_MISS, { judge: 'CAMERA=NO\nAUDIO=NO' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/AUDIO/);
    expect(r.stderr).toMatch(/CAMERA/);
    expect(r.stderr).toMatch(/KLING-OPERATOR-GUIDE/); // teaches the fix, not just the refusal
    expect(r.stderr).toMatch(/brain orb/);            // quotes the offending prompt back
  });

  it('ALLOWS the guide-compliant shot on the FAST PATH — no judge call needed', () => {
    // Unmistakable direction (dolly-in + synth swell) short-circuits before the model runs, so the
    // gate costs nothing on well-written prompts. Proven by pointing CLAUDE_BIN at nothing.
    expect(run(THE_BLACK_BELT, { noJudge: true }).status).toBe(0);
  });

  it('names ONLY the missing dimension — camera present, audio absent', () => {
    const r = run('kling text_to_video --model kling-video-v3_0_turbo "slow dolly-in across a quiet room"',
      { judge: 'CAMERA=YES\nAUDIO=NO' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/missing: AUDIO/);
    expect(r.stderr).not.toMatch(/missing:.*CAMERA/);
  });

  it('THE REGEX LESSON: "b-RAIN orb" is not rain sounds — a judge sees that, a word list cannot', () => {
    // v1 of this gate had `rain` in its audio word-list; it matched inside "brain orb" and waved a
    // soundless prompt straight through. This test pins the fix: the verdict is semantic.
    const r = run('kling image_to_video --model kling-video-v3_0_turbo --image a.png "The luminous brain orb descends toward the desk, tendrils of light connecting."',
      { judge: 'CAMERA=NO\nAUDIO=NO' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/AUDIO/);
  });

  it('catches DIRECTION WITHOUT KEYWORDS — "the camera slowly moves closer" is a dolly', () => {
    // A word list would block this (no listed term); a judge allows it. This is the whole reason the
    // gate judges instead of matching.
    const r = run('kling text_to_video --model kling-video-v3_0_turbo "The camera slowly moves closer as a soft hush of wind rises beneath the scene."',
      { judge: 'CAMERA=YES\nAUDIO=YES' });
    expect(r.status).toBe(0);
  });

  it('stands down for silent-by-design models — v2_5 has NO audio track and costs half', () => {
    // Choosing a silent model is a legitimate, cheaper choice; demanding a soundscape there would be
    // a nag, and a gate that nags gets switched off.
    const r = run('kling image_to_video --model kling-video-v2_5 --image a.png "slow dolly-in across the room"',
      { judge: 'CAMERA=YES\nAUDIO=NO' });   // judge says no audio — irrelevant for a silent model
    expect(r.status).toBe(0);
  });

  it('FAILS OPEN when the judge is unavailable or its answer is unparseable', () => {
    expect(run(THE_REAL_MISS, { noJudge: true }).status).toBe(0);
    expect(run(THE_REAL_MISS, { judge: 'I think maybe the vibes are off?' }).status).toBe(0);
  });

  it('does NOT tax free or non-billable work — stills, queries, uploads, help, ordinary shell', () => {
    for (const cmd of [
      'kling who_am_i',
      'kling query_tasks abc123 --poll 60',
      'kling account --costs',
      'kling file_upload ./a.png',
      'kling text_to_image --model kling-image-v3_0 "a cozy desk at night"', // stills are cheap; gate video only
      'kling image_to_video --help',
      'git status',
      'ffmpeg -i a.mp4 out.mp4',
    ]) {
      expect(run(cmd).status, `${cmd} must pass untouched`).toBe(0);
    }
  });

  it('never touches a user who did not opt in, and FAILS OPEN on garbage', () => {
    expect(run(THE_REAL_MISS, { optedIn: false }).status).toBe(0);
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kpf-g-'));
    fs.mkdirSync(path.join(home, '.claude/model-router'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude/model-router/profile.json'), '{}');
    const r = spawnSync('bash', [GATE], { input: 'not json', env: { ...process.env, HOME: home }, encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('uses BASH BUILTINS ONLY — a blocking hook must depend on nothing fragile', () => {
    const src = fs.readFileSync(GATE, 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    for (const bin of ['python3', 'jq', '$(cat', '| grep', '| sed']) {
      expect(src, `must not depend on ${bin}`).not.toContain(bin);
    }
    expect(src).toMatch(/BASH_REMATCH/);
  });
});
