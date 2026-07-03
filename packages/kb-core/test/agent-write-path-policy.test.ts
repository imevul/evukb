import { describe, expect, it } from 'vitest';

import {
  assertAgentNotesPath,
  assertAgentWritePath,
  joinAgentWritePath,
  normalizeAgentWritePath,
  resolveAgentWritePathPrefixes,
  splitAgentWritePath,
} from '../src/agent-write/path-policy.js';

describe('agent write path policy', () => {
  it('requires paths under agent-notes/ by default', () => {
    expect(assertAgentNotesPath('agent-notes/session.md')).toBe('agent-notes/session.md');
    expect(assertAgentNotesPath('agent-notes/sub/note.md')).toBe('agent-notes/sub/note.md');
    expect(() => assertAgentNotesPath('guides/note.md')).toThrow(/agent-notes/);
    expect(() => assertAgentNotesPath('../agent-notes/note.md')).toThrow();
  });

  it('allows configured workspace prefixes', () => {
    const prefixes = ['agent-notes', 'drafts'];
    expect(assertAgentWritePath('drafts/plan.md', prefixes)).toBe('drafts/plan.md');
    expect(() => assertAgentWritePath('secrets/key.md', prefixes)).toThrow();
  });

  it('intersects corpus and token prefixes within workspace', () => {
    const resolved = resolveAgentWritePathPrefixes({
      workspacePrefixes: ['agent-notes', 'drafts'],
      corpusPrefixes: ['agent-notes/sub'],
      tokenPrefixes: ['agent-notes/sub'],
    });
    expect(resolved).toEqual(['agent-notes/sub']);
    expect(assertAgentWritePath('agent-notes/sub/note.md', resolved)).toBe(
      'agent-notes/sub/note.md',
    );
    expect(() => assertAgentWritePath('drafts/note.md', resolved)).toThrow();
  });

  it('normalizes unsafe paths', () => {
    expect(normalizeAgentWritePath('agent-notes/foo.md')).toBe('agent-notes/foo.md');
    expect(() => normalizeAgentWritePath('../secrets.txt')).toThrow();
  });

  it('splits and joins agent write paths', () => {
    const prefixes = ['agent-notes'];
    expect(splitAgentWritePath('agent-notes/sub/note.md', prefixes)).toEqual({
      folderPath: 'agent-notes/sub',
      name: 'note.md',
    });
    expect(joinAgentWritePath('agent-notes/sub', 'note.md', prefixes)).toBe(
      'agent-notes/sub/note.md',
    );
    expect(() => joinAgentWritePath('agent-notes', 'sub/note.md', prefixes)).toThrow();
  });
});
