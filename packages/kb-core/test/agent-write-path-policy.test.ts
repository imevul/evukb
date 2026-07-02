import { describe, expect, it } from 'vitest';

import {
  assertAgentNotesPath,
  joinAgentWritePath,
  normalizeAgentWritePath,
  splitAgentWritePath,
} from '../src/agent-write/path-policy.js';

describe('agent write path policy', () => {
  it('requires paths under agent-notes/', () => {
    expect(assertAgentNotesPath('agent-notes/session.md')).toBe('agent-notes/session.md');
    expect(assertAgentNotesPath('agent-notes/sub/note.md')).toBe('agent-notes/sub/note.md');
    expect(() => assertAgentNotesPath('guides/note.md')).toThrow(/agent-notes/);
    expect(() => assertAgentNotesPath('../agent-notes/note.md')).toThrow();
  });

  it('normalizes unsafe paths', () => {
    expect(normalizeAgentWritePath('agent-notes/foo.md')).toBe('agent-notes/foo.md');
    expect(() => normalizeAgentWritePath('../secrets.txt')).toThrow();
  });

  it('splits and joins agent write paths', () => {
    expect(splitAgentWritePath('agent-notes/sub/note.md')).toEqual({
      folderPath: 'agent-notes/sub',
      name: 'note.md',
    });
    expect(joinAgentWritePath('agent-notes/sub', 'note.md')).toBe('agent-notes/sub/note.md');
    expect(() => joinAgentWritePath('agent-notes', 'sub/note.md')).toThrow();
  });
});
