import { describe, expect, it } from 'vitest';
import {
  chooseRoles,
  deliberate,
  hardProblem,
  main,
  persistDeliberationReceipt,
} from '../../scripts/dual-host-deliberation.mjs';

const eligible = {
  claude: { host: 'claude-code', eligible: true, auth: 'claude.ai-subscription' },
  codex: { host: 'codex', eligible: true, auth: 'chatgpt-subscription' },
};

describe('hardProblem', () => {
  it.each([
    'Create an ADR for the storage migration',
    'Model the authentication bounded context and DDD aggregates',
    'Design a holistic Agentic-QE test suite for the user experience',
    'Review the security boundary before production migration',
  ])('detects consequential work: %s', (task) => {
    expect(hardProblem(task)).toBe(true);
  });

  it('does not turn an ordinary typo into a costly duel', () => {
    expect(hardProblem('fix the typo in the footer')).toBe(false);
  });
});

describe('chooseRoles', () => {
  it('is deterministic and gives both hosts the scribe role across tasks', () => {
    expect(chooseRoles('same task')).toEqual(chooseRoles('same task'));
    const scribes = new Set(Array.from({ length: 100 }, (_, i) => chooseRoles(`task-${i}`).scribe));
    expect(scribes).toEqual(new Set(['claude-code', 'codex']));
  });
});

describe('deliberate', () => {
  it('runs proposal, cross-critique, synthesis and verification through both hosts', async () => {
    const calls = [];
    const runHost = async (host, stage, payload) => {
      calls.push({ host, stage, payload });
      if (stage === 'proposal') return { ok: true, value: { host, plan: `${host}-plan` } };
      if (stage === 'critique') return { ok: true, value: { host, findings: [`review-${host}`] } };
      if (stage === 'synthesis') return { ok: true, value: { adr: {}, ddd: {}, qe: {}, unresolved: [] } };
      return { ok: true, value: { verdict: 'accept', corrections: [] } };
    };

    const out = await deliberate('Design the security architecture ADR', {
      cwd: '/tmp/project',
      probes: eligible,
      runHost,
      persist: async () => true,
    });

    expect(out.status).toBe('accepted');
    expect(out.dual).toBe(true);
    expect(out.learningPersisted).toBe(true);
    expect(calls.filter((c) => c.stage === 'proposal')).toHaveLength(2);
    expect(calls.filter((c) => c.stage === 'critique')).toHaveLength(2);
    expect(calls.filter((c) => c.stage === 'synthesis')).toHaveLength(1);
    expect(calls.filter((c) => c.stage === 'verify')).toHaveLength(1);
    expect(new Set(calls.map((c) => c.host))).toEqual(new Set(['claude-code', 'codex']));
  });

  it('returns an honestly labeled draft when one subscription is unavailable', async () => {
    const out = await deliberate('Create an ADR for the migration', {
      probes: {
        claude: { host: 'claude-code', eligible: false, auth: 'capacity-limited' },
        codex: eligible.codex,
      },
      runHost: async (host, stage) => ({
        ok: true,
        value: { host, stage, adr: {}, ddd: {}, qe: {} },
      }),
      persist: async () => false,
    });

    expect(out.status).toBe('degraded');
    expect(out.dual).toBe(false);
    expect(out.missing).toContain('claude-code');
    expect(out.learningPersisted).toBe(false);
    expect(out).not.toHaveProperty('verification');
  });

  it('never calls a model when neither subscription is eligible', async () => {
    let called = false;
    const out = await deliberate('Create an ADR', {
      probes: {
        claude: { host: 'claude-code', eligible: false, auth: 'unknown' },
        codex: { host: 'codex', eligible: false, auth: 'unknown' },
      },
      runHost: async () => { called = true; },
    });
    expect(called).toBe(false);
    expect(out.status).toBe('unavailable');
  });

  it('does not promote host completion into an accepted quality outcome', async () => {
    const runHost = async (host, stage) => {
      if (stage === 'verify') return { ok: true, value: { verdict: 'changes', corrections: ['missing oracle'] } };
      if (stage === 'revise') return { ok: true, value: { adr: {}, ddd: {}, qe: {} } };
      if (stage === 'reverify') return { ok: true, value: { verdict: 'block', corrections: ['still incomplete'] } };
      return { ok: true, value: { host, stage } };
    };
    const out = await deliberate('Build an Agentic-QE architecture', {
      probes: eligible,
      runHost,
    });
    expect(out.status).toBe('unresolved');
    expect(out.verifiedOutcome).toBe(false);
  });
});

describe('persistDeliberationReceipt', () => {
  it('stores only a sanitized append-only outcome receipt in project AgentDB', async () => {
    let invocation;
    const run = (binary, args, options) => {
      invocation = { binary, args, options };
      return { status: 0, stdout: 'stored', stderr: '' };
    };

    const stored = await persistDeliberationReceipt({
      protocol: 'dual-host-deliberation-v1',
      taskHash: 'abc123',
      hosts: ['claude-code', 'codex'],
      roles: { scribe: 'codex', verifier: 'claude-code' },
      accepted: true,
      rawPrompt: 'must not persist',
      transcript: 'must not persist',
      email: 'must-not-leak@example.com',
    }, {
      cwd: '/tmp/project',
      now: () => 1_785_240_000_000,
      run,
    });

    expect(stored).toBe(true);
    expect(invocation.binary).toBe('ruflo');
    expect(invocation.options.cwd).toBe('/tmp/project');
    expect(invocation.args.slice(0, 3)).toEqual(['memory', 'store', '-k']);
    expect(invocation.args[3]).toBe('dual-deliberation-1785240000000-abc123');
    expect(invocation.args).toContain('--no-upsert');
    expect(invocation.args).toContain('--scan-content');
    const value = JSON.parse(invocation.args[5]);
    expect(value).toEqual({
      protocol: 'dual-host-deliberation-v1',
      taskHash: 'abc123',
      hosts: ['claude-code', 'codex'],
      roles: { scribe: 'codex', verifier: 'claude-code' },
      accepted: true,
      verifiedOutcome: true,
      recordedAt: '2026-07-28T12:00:00.000Z',
    });
    expect(invocation.args.join(' ')).not.toContain('must not persist');
    expect(invocation.args.join(' ')).not.toContain('must-not-leak');
  });
});

describe('command entrypoint', () => {
  it('prints the deliberation result and returns a nonzero code unless both hosts accept', async () => {
    let output = '';
    const code = await main(['Create an ADR'], {
      deliberateFn: async () => ({ status: 'degraded', dual: false }),
      stdout: { write: (value) => { output += value; } },
      stderr: { write: () => {} },
    });
    expect(code).toBe(2);
    expect(JSON.parse(output)).toEqual({ status: 'degraded', dual: false });
  });

  it('refuses an empty task without invoking either host', async () => {
    let invoked = false;
    let error = '';
    const code = await main([], {
      deliberateFn: async () => { invoked = true; },
      stdout: { write: () => {} },
      stderr: { write: (value) => { error += value; } },
    });
    expect(code).toBe(64);
    expect(invoked).toBe(false);
    expect(error).toContain('Usage:');
  });
});
