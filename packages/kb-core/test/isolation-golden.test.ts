import { describe, expect, it } from 'vitest';

import {
  asCorpusId,
  assertWorkspaceScope,
  asWorkspaceId,
  blobRefToStorageKey,
  createBlobRef,
} from '../src/index.js';
import {
  type IsolationSurface,
  isolationCasesForSurface,
  isolationGoldenCases,
} from './fixtures/isolation-golden.js';

describe('isolation golden fixtures', () => {
  it('defines at least one case per major surface', () => {
    const surfaces: IsolationSurface[] = [
      'http_file_read',
      'http_search',
      'mcp_search',
      'tools_kb_search',
      'blob_storage_key',
      'workspace_scope_assert',
    ];
    for (const surface of surfaces) {
      expect(isolationCasesForSurface(surface).length).toBeGreaterThan(0);
    }
  });

  for (const goldenCase of isolationGoldenCases) {
    it(`documents ${goldenCase.id}`, () => {
      expect(goldenCase.crossWorkspace).toBe(true);
      expect(goldenCase.description.length).toBeGreaterThan(0);
    });
  }

  it('keeps blob storage keys workspace-specific', () => {
    const workspaceA = asWorkspaceId('workspace-a');
    const workspaceB = asWorkspaceId('workspace-b');
    const corpusId = asCorpusId('corpus-1');
    const refA = createBlobRef(workspaceA, corpusId, 'files/note.md');
    const refB = createBlobRef(workspaceB, corpusId, 'files/note.md');
    const keyA = blobRefToStorageKey(refA);
    const keyB = blobRefToStorageKey(refB);
    expect(keyA).toContain('workspace-a');
    expect(keyB).toContain('workspace-b');
    expect(keyA).not.toBe(keyB);
  });

  it('rejects cross-workspace scope via assertWorkspaceScope', () => {
    expect(() =>
      assertWorkspaceScope(asWorkspaceId('workspace-a'), asWorkspaceId('workspace-b')),
    ).toThrow(/Cross-workspace access is not allowed/);
    expect(() =>
      assertWorkspaceScope(asWorkspaceId('workspace-a'), asWorkspaceId('workspace-a')),
    ).not.toThrow();
  });
});
