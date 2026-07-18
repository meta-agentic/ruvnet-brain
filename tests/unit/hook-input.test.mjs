// hook-input.test.mjs — the ONE parser every PreToolUse gate uses (ADR-0021). The whole reason it
// exists is that a bash `"([^"]*)"` regex truncates any command containing a quote, so the known-bad
// fixture below IS the bug: a command whose interesting part sits AFTER an embedded quote. A real JSON
// parser returns the whole string; the old regex returned everything up to the first `"` and the gate
// failed open on it.
import { describe, it, expect } from 'vitest';
import { parseHookEvent, toolName, commandOf, field } from '../../plugin/scripts/hook-input.mjs';

describe('hook-input — the shared PreToolUse payload parser (ADR-0021)', () => {
  it('KNOWN-BAD (the #13 fail-open): a command with embedded quotes is returned WHOLE, not truncated', () => {
    // The bash `"([^"]*)"` regex truncates this at the first `"` — so `vercel --prod` (the part a
    // gate must see) vanished and the wall failed open. The parser must round-trip the whole command,
    // backslash-escapes and all — it is the real command the user typed.
    const command = 'git commit -m "fix: \\"quoted\\" thing" && vercel --prod';
    const ev = parseHookEvent(JSON.stringify({ tool_name: 'Bash', tool_input: { command } }));
    const cmd = commandOf(ev);
    expect(cmd).toContain('vercel --prod'); // the old regex NEVER saw this — the whole point
    expect(cmd).toContain('"fix:');
    expect(cmd).toBe(command); // round-trips WHOLE, not truncated at the first quote
  });

  it('extracts tool_name', () => {
    expect(toolName(parseHookEvent('{"tool_name":"Bash","tool_input":{}}'))).toBe('Bash');
    expect(toolName(parseHookEvent('{"tool_input":{}}'))).toBe('');
  });

  it('reads tool_input.command (Claude Code shape) and the top-level .command fallback', () => {
    expect(commandOf(parseHookEvent('{"tool_input":{"command":"ls -la"}}'))).toBe('ls -la');
    expect(commandOf(parseHookEvent('{"command":"pwd"}'))).toBe('pwd'); // legacy/fallback
  });

  it('FAILS OPEN: bad JSON → null event → empty strings, never a throw', () => {
    expect(parseHookEvent('not json at all')).toBeNull();
    expect(parseHookEvent('')).toBeNull();
    expect(() => commandOf(null)).not.toThrow();
    expect(commandOf(null)).toBe('');
    expect(toolName(null)).toBe('');
  });

  it('missing / wrong-typed fields → "" (never undefined, never a crash)', () => {
    expect(commandOf(parseHookEvent('{"tool_input":{"command":42}}'))).toBe(''); // non-string command
    expect(commandOf(parseHookEvent('{"tool_input":{}}'))).toBe('');
    expect(field(parseHookEvent('{"tool_input":{"file_path":"/a/b.js"}}'), 'tool_input.file_path')).toBe('/a/b.js');
    expect(field(parseHookEvent('{}'), 'tool_input.file_path')).toBe('');
  });

  it('a command that merely MENTIONS a marker inside a quoted arg is still returned verbatim (parsing ≠ policy)', () => {
    // The parser does not judge; it just returns the true command. Command-position policy lives in
    // the gate. This proves the parser does not itself mangle quoted content.
    const ev = parseHookEvent(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo "run: ruflo memory search foo"' } }));
    expect(commandOf(ev)).toBe('echo "run: ruflo memory search foo"');
  });
});
