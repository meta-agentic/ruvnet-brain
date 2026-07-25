// hook-input.test.mjs — the ONE parser every PreToolUse gate uses (ADR-0021). The whole reason it
// exists is that a bash `"([^"]*)"` regex truncates any command containing a quote, so the known-bad
// fixture below IS the bug: a command whose interesting part sits AFTER an embedded quote. A real JSON
// parser returns the whole string; the old regex returned everything up to the first `"` and the gate
// failed open on it.
import { describe, it, expect } from 'vitest';
import { parseHookEvent, toolName, commandOf, field, shellSkeleton } from '../../plugin/scripts/hook-input.mjs';

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

describe('shellSkeleton — quote-masked command, for command-position matching (issue #41)', () => {
  it('empty string in, empty string out', () => {
    expect(shellSkeleton('')).toBe('');
  });

  it('no quotes at all: passes through byte-identical', () => {
    const cmd = 'ruflo memory search -q x';
    expect(shellSkeleton(cmd)).toBe(cmd);
  });

  it('THE BUG (issue #41): a separator char INSIDE a double-quoted grep pattern is masked, not exposed', () => {
    // `grep -E "foo|ruflo init" file.txt` — the `|` sits inside the pattern argument. The old raw-CMD
    // anchor read it as a real shell separator and misread `ruflo init` as command position. The
    // skeleton must remove that `|` from view while keeping the quote characters and everything
    // outside the quotes untouched.
    const skel = shellSkeleton('grep -E "foo|ruflo init" file.txt');
    expect(skel).not.toContain('|'); // the separator character is gone — it was inside quotes
    expect(skel).not.toContain('ruflo'); // so is the tool name that used to leak through
    expect(skel.startsWith('grep -E "')).toBe(true);
    expect(skel.endsWith('" file.txt')).toBe(true);
    expect(skel.length).toBe('grep -E "foo|ruflo init" file.txt'.length); // offsets preserved
  });

  it('quote characters themselves survive; only the CONTENT between them is masked', () => {
    const skel = shellSkeleton('echo "a|b" \'c;d\'');
    expect(skel).toBe('echo "___" \'___\'');
  });

  it('a real, unquoted separator still survives the mask (command position is still detectable)', () => {
    const skel = shellSkeleton('echo hi | ruflo memory search');
    expect(skel).toContain('| ruflo memory search'); // outside any quotes — byte-identical to input
  });

  it('backslash-escaped quote inside a double-quoted string does not prematurely close the quote', () => {
    // Mirrors the #13 fixture: an escaped `\"` is a literal `"` byte in the raw text but must not end
    // the quoted region. The escape (backslash + escaped char) masks as two bytes; the real closing
    // quote at the very end must still be recognized and preserved.
    const cmd = 'git commit -m "fix: \\"quoted\\" thing"';
    const skel = shellSkeleton(cmd);
    expect(skel.length).toBe(cmd.length); // offsets preserved through the escape handling
    expect(skel.startsWith('git commit -m "')).toBe(true);
    expect(skel.endsWith('"')).toBe(true);
    expect(skel).not.toContain('quoted'); // masked, including the text between the escaped quotes
  });

  it('single quotes take no escapes — a backslash inside them is ordinary masked content', () => {
    // "a\|b" is 4 literal characters (a, \, |, b) — the backslash has no escaping power inside single
    // quotes (real shell semantics), so it is masked like any other content byte, not consumed as an
    // escape the way it would be inside double quotes.
    const skel = shellSkeleton("echo 'a\\|b'");
    expect(skel).toBe("echo '____'");
  });

  it('an unterminated quote masks to the end of the string — never throws, never hangs', () => {
    expect(() => shellSkeleton('echo "never closes')).not.toThrow();
    const skel = shellSkeleton('echo "never closes');
    expect(skel).toBe('echo "____________');
    expect(skel.length).toBe('echo "never closes'.length);
  });
});
