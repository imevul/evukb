import { describe, expect, it } from 'vitest';

import {
  isAgentNotesPath,
  resolveIncludeAgentNotesInRetrieval,
  shouldIncludePathInRetrieval,
  validateIncludeAgentNotesInRetrieval,
} from '../src/agent-retrieval/settings.js';

describe('agent retrieval settings', () => {
  it('detects agent-notes paths', () => {
    expect(isAgentNotesPath('agent-notes/session.md')).toBe(true);
    expect(isAgentNotesPath('agent-notes')).toBe(true);
    expect(isAgentNotesPath('notes/agent-notes.md')).toBe(false);
  });

  it('defaults to including agent notes', () => {
    expect(resolveIncludeAgentNotesInRetrieval({})).toBe(true);
    expect(resolveIncludeAgentNotesInRetrieval({}, {})).toBe(true);
  });

  it('lets corpus override workspace', () => {
    expect(
      resolveIncludeAgentNotesInRetrieval(
        { includeAgentNotesInRetrieval: true },
        { includeAgentNotesInRetrieval: false },
      ),
    ).toBe(false);
    expect(
      resolveIncludeAgentNotesInRetrieval(
        { includeAgentNotesInRetrieval: false },
        { includeAgentNotesInRetrieval: true },
      ),
    ).toBe(true);
  });

  it('excludes agent-notes paths when disabled', () => {
    expect(shouldIncludePathInRetrieval('agent-notes/a.md', false)).toBe(false);
    expect(shouldIncludePathInRetrieval('docs/a.md', false)).toBe(true);
    expect(shouldIncludePathInRetrieval('agent-notes/a.md', true)).toBe(true);
  });

  it('validates boolean settings', () => {
    expect(validateIncludeAgentNotesInRetrieval(true)).toBeNull();
    expect(validateIncludeAgentNotesInRetrieval('yes')).toMatch(/boolean/);
  });
});
