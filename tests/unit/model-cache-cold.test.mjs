// tests/unit/model-cache-cold.test.mjs — proves the capability battery tells a COLD model cache
// (embedder never downloaded, expected on a fresh machine) apart from a real retrieval OUTAGE.
//
// The bug (docs/4.0-READINESS.md §6 item 1): a cold cache made every battery question print the same
// "(no hit)" a genuine outage prints, so a healthy brain on a fresh machine looked broken. The fix is
// evidence-based — the embedder file is on disk or it is not — and the load-bearing property is the
// ASYMMETRY: cold requires no-hit AND model-absent, so an outage (model PRESENT, retrieval dead) can
// never be softened to "cold". These tests break that guard to confirm it fails on masked outages.
// (Repo names below are neutral placeholders — the classifier is name-agnostic.)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveModelCache, modelPresent, classifyBattery, EMBEDDER_REL } from '../../plugin/test/model-cache.mjs';

let tmp;
const savedEnv = {};
const ENV_KEYS = ['KB_MODEL_CACHE', 'RUVNET_BRAIN_HOME'];
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcc-test-'));
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
});

describe('resolveModelCache — mirrors the MCP server (server.mjs) cache resolution', () => {
  it('honors KB_MODEL_CACHE verbatim (explicit override wins)', () => {
    expect(resolveModelCache({ KB_MODEL_CACHE: '/explicit/models' })).toBe('/explicit/models');
  });
  it('falls back to <RUVNET_BRAIN_HOME>/models when no KB_MODEL_CACHE', () => {
    expect(resolveModelCache({ RUVNET_BRAIN_HOME: '/brain' })).toBe(path.join('/brain', 'models'));
  });
  it('falls back to ~/.cache/ruvnet-brain/models with neither env set (the MCP default)', () => {
    expect(resolveModelCache({})).toBe(path.join(os.homedir(), '.cache', 'ruvnet-brain', 'models'));
  });
});

describe('modelPresent — the one honest signal: is the embedder on disk?', () => {
  it('false when the embedder leaf dir is absent (cold cache)', () => {
    expect(modelPresent(tmp)).toBe(false);
  });
  it('true only when Xenova/all-MiniLM-L6-v2 actually exists (warm cache)', () => {
    fs.mkdirSync(path.join(tmp, EMBEDDER_REL), { recursive: true });
    expect(modelPresent(tmp)).toBe(true);
  });
  it('the reranker being present does NOT warm the query path (must still read cold)', () => {
    // A machine can hold the cross-encoder (Xenova/ms-marco-MiniLM-L-6-v2) yet lack the embedder —
    // exactly the state of ~/.cache/ruvnet-brain/models that produced this bug. It must read cold.
    fs.mkdirSync(path.join(tmp, 'Xenova', 'ms-marco-MiniLM-L-6-v2'), { recursive: true });
    expect(modelPresent(tmp)).toBe(false);
  });
});

describe('classifyBattery — cold vs outage vs pass', () => {
  it('PASS: a valid in-threshold hit from the expected repo', () => {
    expect(classifyBattery({ repo: 'repo-a', repoOk: true, relOk: true, haveModel: true })).toBe('pass');
    // a hit is real evidence of a working model even if the cache check somehow disagreed
    expect(classifyBattery({ repo: 'repo-a', repoOk: true, relOk: true, haveModel: false })).toBe('pass');
  });

  it('COLD: no parseable hit AND the embedder model is absent', () => {
    expect(classifyBattery({ repo: undefined, repoOk: true, relOk: true, haveModel: false })).toBe('cold');
  });

  it('OUTAGE stays FAIL: no hit while the model IS present is a genuine retrieval failure, never cold', () => {
    // THE load-bearing assertion. If this ever returned 'cold', a real outage would be masked as a
    // benign cold cache — the exact dishonesty this whole change exists to prevent.
    expect(classifyBattery({ repo: undefined, repoOk: true, relOk: true, haveModel: true })).toBe('fail');
  });

  it('FAIL: a hit parsed but below the relevance floor, model present (real but wrong answer)', () => {
    expect(classifyBattery({ repo: 'repo-b', repoOk: true, relOk: false, haveModel: true })).toBe('fail');
  });
  it('FAIL: a hit parsed from the wrong repo, model present', () => {
    expect(classifyBattery({ repo: 'wrong-repo', repoOk: false, relOk: true, haveModel: true })).toBe('fail');
  });

  it('the ONLY thing that flips a no-hit fail→cold is the model disappearing from disk', () => {
    const noHit = { repo: undefined, repoOk: true, relOk: true };
    expect(classifyBattery({ ...noHit, haveModel: true })).toBe('fail');   // outage
    expect(classifyBattery({ ...noHit, haveModel: false })).toBe('cold');  // cold cache
    // and with the model present there is NO no-hit input that yields 'cold' — proven by construction:
    for (const repoOk of [true, false]) for (const relOk of [true, false]) {
      expect(classifyBattery({ repo: undefined, repoOk, relOk, haveModel: true })).not.toBe('cold');
    }
  });
});
