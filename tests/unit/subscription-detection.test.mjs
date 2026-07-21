/**
 * Paid-seat detection and the subscription-first rule.
 *
 * A user with BOTH a ChatGPT Max plan and a Claude Max plan showed up in the console as "auto",
 * because detection only ever read API keys from environment variables. Verified on a real machine
 * 2026-07-20: ~/.codex/auth.json carries `auth_mode: "chatgpt"`, `OPENAI_API_KEY: null` and live
 * OAuth tokens — a genuine paid subscription with no key anywhere. Claude's Max session is worse:
 * on macOS it lives in the login keychain, so there is no file to find at all.
 *
 * The rule these tests hold: a SUBSCRIPTION always outranks an API key. A subscription is already
 * paid at a flat rate; a key bills per token. Routing to a key while an authenticated seat sits
 * idle spends money the user has already spent.
 */
import { describe, it, expect } from 'vitest';
import { preferredSeat } from '../../scripts/onboarding-console.mjs';

const seat = (subscription, apiKey, how = 'test') => ({ subscription, apiKey, how });

describe('preferredSeat — subscription first, API key last', () => {
  it('prefers a subscription over an API key on the SAME provider', () => {
    const got = preferredSeat({ anthropic: seat(true, true) });
    expect(got.basis).toBe('subscription');
    expect(got.provider).toBe('anthropic');
  });

  it('prefers a subscription on one provider over an API key on another', () => {
    // The money case: never bill per-token against a key when a flat-rate seat is authenticated.
    const got = preferredSeat({
      anthropic: seat(false, true),
      openai: seat(true, false),
    });
    expect(got.basis).toBe('subscription');
    expect(got.provider).toBe('openai');
  });

  it('falls back to an API key only when NO subscription exists anywhere', () => {
    const got = preferredSeat({
      anthropic: seat(false, false),
      openai: seat(false, true),
    });
    expect(got.basis).toBe('api-key');
    expect(got.provider).toBe('openai');
  });

  it('reports "none" honestly when nothing is detected — never a guess', () => {
    const got = preferredSeat({ anthropic: seat(false, false), openai: seat(false, false) });
    expect(got.basis).toBe('none');
    expect(got.provider).toBeNull();
  });

  it('handles the reported case: ChatGPT Max + Claude Max, no keys, used to read as "auto"', () => {
    const got = preferredSeat({
      anthropic: seat(true, false, 'macOS login keychain'),
      openai: seat(true, false, '~/.codex/auth.json (ChatGPT plan)'),
      codex: seat(true, false, 'same seat as OpenAI'),
      google: seat(false, false),
      xai: seat(false, false),
    });
    expect(got.basis, 'two paid plans present must never resolve to none/auto').toBe('subscription');
    expect(got.detail).toMatch(/keychain/);
  });

  it('tolerates a provider key being absent from the map entirely', () => {
    expect(() => preferredSeat({})).not.toThrow();
    expect(preferredSeat({}).basis).toBe('none');
  });
});
