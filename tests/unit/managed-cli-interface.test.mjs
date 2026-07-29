import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  MANAGED_EXECUTABLES,
  helpKey,
  stampKeysForHelp,
} from '../../plugin/mcp/managed-cli-interface.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');

describe('managed CLI structured interface policy', () => {
  it('exposes exactly the seven managed executables', () => {
    expect(MANAGED_EXECUTABLES).toEqual([
      'ruflo',
      'claude-flow',
      'agentic-flow',
      'agentic-qe',
      'ruvector',
      'agent-browser',
      'ruv-swarm',
    ]);
  });

  it('derives the same two-level help key from structured argv without parsing shell text', () => {
    expect(helpKey('ruflo', ['memory', 'search', '-q', 'x'])).toBe('ruflo.memory.search');
    expect(helpKey('ruflo', ['memory'])).toBe('ruflo.memory');
    expect(helpKey('ruflo', [])).toBe('ruflo');
  });

  it('rejects unknown executable names and unsafe help-path tokens', () => {
    expect(() => helpKey('not-ruflo', ['memory'])).toThrow(/unknown managed executable/i);
    expect(() => stampKeysForHelp('ruflo', ['memory', '; touch /tmp/pwned'])).toThrow(/invalid subcommand/i);
  });

  it('a successful nested help read stamps the exact key and its parent', () => {
    expect(stampKeysForHelp('ruflo', ['memory', 'search'])).toEqual([
      'ruflo.memory.search',
      'ruflo.memory',
    ]);
    expect(stampKeysForHelp('ruflo', [])).toEqual(['ruflo']);
  });

  it('keeps the blocking policy independent of raw-shell reconstruction', () => {
    const source = fs.readFileSync(path.join(REPO, 'plugin/mcp/managed-cli-interface.mjs'), 'utf8');
    expect(source).not.toMatch(/hook-input|commandNodes|findInvocations|commandOf/);
    expect(source).toMatch(/shell:\s*false/);
  });

  it('routes skills to native Ruflo MCP tools first and the gateway only for CLI-only gaps', () => {
    const skill = fs.readFileSync(path.join(REPO, 'plugin/skills/ruvnet-brain/SKILL.md'), 'utf8');
    expect(skill).toContain('ruvnet_cli_help');
    expect(skill).toContain('ruvnet_cli_run');
    expect(skill).toMatch(/Ruflo MCP tools first/i);
    expect(skill).toMatch(/CLI-only/i);
  });
});
