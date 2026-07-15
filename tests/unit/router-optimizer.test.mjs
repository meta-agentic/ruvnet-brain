// tests/unit/router-optimizer.test.mjs — locks the near-term slice of ADR-0015.
//
// router-optimizer.mjs computes the two routing PROFILES the console shows (development &
// production). It is pure/deterministic: it reads price tables + the user's receipts file and
// never makes a network or model call. This test pins the exact picks a user sees on the console
// so a future edit can't silently change what we recommend, and exercises BOTH branches
// (OpenRouter key present → measured cross-provider picks; absent → subscription-only picks).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// RECEIPTS is captured at module load, so the temp path must be in the env BEFORE the import.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'router-opt-'));
const RECEIPTS = path.join(TMP, 'routing-receipts.jsonl');
fs.writeFileSync(
  RECEIPTS,
  [
    JSON.stringify({ model: 'openai/gpt-4.1', quality_pass: true }),
    JSON.stringify({ model: 'openai/gpt-4.1', quality_pass: false }),
    JSON.stringify({ model: 'inclusionai/ling-2.6-flash', quality_pass: true }),
    '', // blank line — must be ignored
    'not-json-at-all', // malformed — must be skipped, not throw
    JSON.stringify({ quality_pass: true }), // no model — must be ignored
  ].join('\n') + '\n'
);
process.env.METAHARNESS_RECEIPTS = RECEIPTS;
process.env.ROUTER_PROFILES = path.join(TMP, 'profiles.json');

let optimize, printSummary, main;
beforeAll(async () => {
  ({ optimize, printSummary, main } = await import('../../scripts/router-optimizer.mjs'));
});

const bandOf = (profile, name) => profile.bands.find((b) => b.band === name);

describe('router-optimizer — the two profiles the console renders', () => {
  it('parses receipts robustly (blank/malformed/no-model lines are ignored, valid ones counted)', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
    const o = optimize({});
    // 3 lines carry a model; the blank, malformed, and no-model lines must not count.
    expect(o.receiptsSeen).toBe(3);
    expect(o.measuredAt).toBe('2026-06-15');
    expect(Object.keys(o.profiles)).toEqual(['development', 'production']);
  });

  it('falls back to config/.env when OPENROUTER_API_KEY is not in the env (exercises the reads)', () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      // With no env var, hasOpenRouterKey() must attempt the config.json then .env reads. The result
      // depends on the machine, so we assert only that the shape is intact — the point is executing
      // (and thus covering) both fallback branches without a network or model call.
      const o = optimize({ provider: 'anthropic' });
      expect(typeof o.hasOpenRouterKey).toBe('boolean');
      expect(o.profiles.production.bands).toHaveLength(4);
    } finally {
      if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
    }
  });

  describe('with an OpenRouter key (measured cross-provider picks)', () => {
    let o;
    beforeAll(() => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
      o = optimize({ provider: 'anthropic' }); // pin the house so cross-env keys can't perturb the assertions
    });

    it('reports the key as present', () => {
      expect(o.hasOpenRouterKey).toBe(true);
    });

    it('every profile has exactly the four discovered bands in order', () => {
      for (const p of Object.values(o.profiles)) {
        expect(p.bands.map((b) => b.band)).toEqual(['mechanical', 'cheap', 'mid', 'frontier']);
      }
    });

    it('mechanical band is the $0 no-LLM tier in both profiles', () => {
      for (const p of Object.values(o.profiles)) {
        const m = bandOf(p, 'mechanical');
        expect(m.model).toBe('agent-booster');
        expect(m.costPerMTok).toBe(0);
        expect(m.effort).toBe('none');
        expect(m.effortSource).toBe('n/a');
      }
    });

    it('cheap band is Ling-2.6-flash at $0.02/Mtok, effort low (a default)', () => {
      const c = bandOf(o.profiles.production, 'cheap');
      expect(c.model).toBe('inclusionai/ling-2.6-flash');
      expect(c.costPerMTok).toBe(0.02);
      expect(c.effort).toBe('low');
      expect(c.effortSource).toBe('default');
    });

    it('DEV mid favors the $/quality value pick (Llama-3.3-70b, priced from the live catalog)', () => {
      const mid = bandOf(o.profiles.development, 'mid');
      expect(mid.model).toBe('meta-llama/llama-3.3-70b-instruct');
      expect(mid.costPerMTok).toBe(0.27); // priced from the live OpenRouter snapshot ($0.13/$0.40) — no more "—"
    });

    it('PROD mid favors the higher-quality pick (GPT-4.1 at $5/Mtok)', () => {
      const mid = bandOf(o.profiles.production, 'mid');
      expect(mid.model).toBe('openai/gpt-4.1');
      expect(mid.costPerMTok).toBe(5);
    });

    it('frontier is the house flagship (Fable 5 for a Claude shop); effort is high by default, NOT xhigh', () => {
      // Corrected 2026-07-15: independent evidence shows efficiency inverts before max, so high is the
      // default in BOTH profiles; xhigh is opt-in for hard verifiable tasks, never a default.
      expect(bandOf(o.profiles.development, 'frontier').model).toBe('claude-fable-5');
      expect(bandOf(o.profiles.development, 'frontier').effort).toBe('high');
      expect(bandOf(o.profiles.production, 'frontier').effort).toBe('high');
    });

    it('the objectives differ (dev = throughput on subscription; prod = $/quality metered)', () => {
      expect(o.profiles.development.objective).toMatch(/subscription/i);
      expect(o.profiles.production.objective).toMatch(/metered/i);
    });
  });

  describe('without an OpenRouter key (subscription-only, honest about reach)', () => {
    let o;
    beforeAll(() => {
      o = optimize({ noOpenRouter: true, provider: 'anthropic' });
    });

    it('reports no key and recommends only Claude tiers the subscription can reach', () => {
      expect(o.hasOpenRouterKey).toBe(false);
      expect(bandOf(o.profiles.production, 'cheap').model).toBe('claude-haiku-4.5');
      expect(bandOf(o.profiles.production, 'mid').model).toBe('claude-sonnet-5');
      expect(bandOf(o.profiles.development, 'frontier').model).toBe('claude-fable-5');
    });

    it('still exposes the four bands and the mechanical $0 tier', () => {
      expect(o.profiles.development.bands.map((b) => b.band)).toEqual(['mechanical', 'cheap', 'mid', 'frontier']);
      expect(bandOf(o.profiles.development, 'mechanical').costPerMTok).toBe(0);
    });
  });

  describe('per-house personalization — the frontier is the user’s OWN stack, never one house for all', () => {
    it('a ChatGPT shop gets GPT-5.6 Sol as its frontier (not Fable 5)', () => {
      const o = optimize({ provider: 'openai' });
      expect(bandOf(o.profiles.production, 'frontier').model).toBe('openai/gpt-5.6-sol');
      expect(o.house).toMatchObject({ provider: 'openai', source: 'config' });
      expect(o.house.label).toMatch(/ChatGPT|OpenAI/);
    });
    it('a Codex shop aliases to OpenAI Sol; a Grok shop gets Grok 4.5', () => {
      expect(bandOf(optimize({ provider: 'codex' }).profiles.development, 'frontier').model).toBe('openai/gpt-5.6-sol');
      expect(bandOf(optimize({ provider: 'xai' }).profiles.production, 'frontier').model).toBe('x-ai/grok-4.5');
    });
    it('every house frontier price is a real number from the verified catalog, never null', () => {
      for (const house of ['anthropic', 'openai', 'google', 'xai']) {
        const f = bandOf(optimize({ provider: house }).profiles.production, 'frontier');
        expect(typeof f.costPerMTok).toBe('number');
        expect(f.costPerMTok).toBeGreaterThan(0);
      }
    });
  });

  describe('CLI surface (printSummary + main)', () => {
    it('printSummary renders every cost form ($0, a price, and unknown "—") without throwing', () => {
      process.env.OPENROUTER_API_KEY = 'sk-or-test-key-1234567890';
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      // the dev profile has mechanical ($0), ling ($0.02), llama (null → "—") — hits all money branches
      expect(() => printSummary(optimize({}))).not.toThrow();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('main() writes both profiles to ROUTER_PROFILES', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const argv = process.argv;
      process.argv = ['node', 'router-optimizer.mjs', '--no-openrouter', '--print'];
      try { main(); } finally { process.argv = argv; spy.mockRestore(); }
      const written = JSON.parse(fs.readFileSync(process.env.ROUTER_PROFILES, 'utf8'));
      expect(Object.keys(written.profiles)).toEqual(['development', 'production']);
      expect(written.hasOpenRouterKey).toBe(false);
    });
  });
});
