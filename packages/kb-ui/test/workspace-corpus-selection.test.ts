/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  readStoredWorkspaceCorpusIds,
  removeStoredWorkspaceCorpusId,
  resolveWorkspaceCorpusSelection,
  writeStoredWorkspaceCorpusIds,
} from '../src/search/workspace-corpus-selection.js';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('workspace corpus selection storage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredWorkspaceCorpusIds('workspace-a')).toBeNull();
  });

  it('persists and reads corpus ids per workspace', () => {
    writeStoredWorkspaceCorpusIds('workspace-a', ['corpus-1', 'corpus-2']);
    expect(readStoredWorkspaceCorpusIds('workspace-a')).toEqual(['corpus-1', 'corpus-2']);
    expect(readStoredWorkspaceCorpusIds('workspace-b')).toBeNull();
  });

  it('removes a corpus id from stored selection', () => {
    writeStoredWorkspaceCorpusIds('workspace-a', ['corpus-1', 'corpus-2']);
    removeStoredWorkspaceCorpusId('workspace-a', 'corpus-1');
    expect(readStoredWorkspaceCorpusIds('workspace-a')).toEqual(['corpus-2']);
  });

  it('restores valid stored ids and drops stale ones', () => {
    expect(resolveWorkspaceCorpusSelection(['a', 'b', 'c'], ['b', 'missing', 'a'])).toEqual([
      'b',
      'a',
    ]);
  });

  it('falls back to the first available corpus when storage is empty', () => {
    expect(resolveWorkspaceCorpusSelection(['a', 'b'], null)).toEqual(['a']);
  });

  it('falls back to the first available corpus when stored ids are all stale', () => {
    expect(resolveWorkspaceCorpusSelection(['a', 'b'], ['missing'])).toEqual(['a']);
  });
});
