import { describe, expect, it } from 'vitest';
import { main, recommendDualHost } from '../../scripts/dual-host-suggest.mjs';

const eligible = {
  claude: { host: 'claude-code', eligible: true, auth: 'claude.ai-subscription' },
  codex: { host: 'codex', eligible: true, auth: 'chatgpt-subscription' },
};

describe('recommendDualHost', () => {
  it('requires the two-seat process for hard work when both subscriptions are verified', () => {
    expect(recommendDualHost('Create the ADR, DDD, and Agentic-QE plan', { probes: eligible }))
      .toEqual({
        action: 'duel',
        hardProblem: true,
        hosts: ['claude-code', 'codex'],
        missing: [],
        billing: 'subscription-only',
        apiKeyFallback: false,
      });
  });

  it('asks for the missing subscription login without suggesting an API key', () => {
    expect(recommendDualHost('Design the production security architecture', {
      probes: {
        claude: eligible.claude,
        codex: { host: 'codex', eligible: false, auth: 'unknown' },
      },
    })).toEqual({
      action: 'login-required',
      hardProblem: true,
      hosts: ['claude-code'],
      missing: ['codex'],
      billing: 'subscription-only',
      apiKeyFallback: false,
    });
  });

  it('does not spend two seats on routine work', () => {
    expect(recommendDualHost('Fix the footer typo', { probes: eligible })).toEqual({
      action: 'single-host',
      hardProblem: false,
      hosts: [],
      missing: [],
      billing: 'subscription-only',
      apiKeyFallback: false,
    });
  });
});

describe('command entrypoint', () => {
  it('prints a machine-readable decision for host skills and hooks', () => {
    let output = '';
    const code = main(['Create', 'an', 'ADR'], {
      probes: eligible,
      stdout: { write: (value) => { output += value; } },
      stderr: { write: () => {} },
    });

    expect(code).toBe(0);
    expect(JSON.parse(output).action).toBe('duel');
  });
});
