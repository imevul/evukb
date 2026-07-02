import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  asCorpusId,
  asWorkspaceId,
  createBlobRef,
  describeKnowledgeScope,
  evuKbCorePackageName,
  LocalFilesystemBlobStore,
  normalizeRelativePath,
} from '../src/index.js';

describe('kb-core contracts', () => {
  it('describes workspace and corpus scope', () => {
    expect(evuKbCorePackageName).toBe('@evu/kb-core');
    expect(
      describeKnowledgeScope({
        workspaceId: asWorkspaceId('workspace-a'),
        corpusId: asCorpusId('corpus-b'),
      }),
    ).toBe('workspace-a/corpus-b');
  });

  it('rejects unsafe blob paths', () => {
    expect(() => normalizeRelativePath('../escape.txt')).toThrow(/Unsafe relative path/);
    expect(() => normalizeRelativePath('/absolute.txt')).toThrow(/Unsafe relative path/);
  });
});

describe('LocalFilesystemBlobStore', () => {
  it('stores and reads workspace-scoped blobs', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-blob-'));
    try {
      const store = new LocalFilesystemBlobStore({ rootDir: tempRoot });
      const ref = createBlobRef(
        asWorkspaceId('workspace-a'),
        asCorpusId('corpus-b'),
        'notes/readme.md',
      );

      await store.put({ ref, body: Buffer.from('# hello') });
      const stat = await store.stat(ref);
      expect(stat.sizeBytes).toBe(7);

      const stream = await store.get(ref);
      const reader = stream.getReader();
      const chunk = await reader.read();
      expect(Buffer.from(chunk.value ?? []).toString('utf8')).toBe('# hello');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('blocks path traversal via blob references', () => {
    expect(() =>
      createBlobRef(asWorkspaceId('workspace-a'), asCorpusId('corpus-b'), '../outside.txt'),
    ).toThrow(/Unsafe relative path/);
  });
});
