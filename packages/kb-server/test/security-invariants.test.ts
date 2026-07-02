import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { KnowledgeNode } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/errors.js';
import { resolveMaxArchiveImportBytes, resolveMaxUploadBytes } from '../src/limits.js';
import { IndexService } from '../src/services/index-service.js';
import { MountWritebackService } from '../src/services/mount-writeback-service.js';

describe('security invariants', () => {
  it('enforces configured upload size limits', () => {
    const previous = process.env.EVUKB_MAX_UPLOAD_BYTES;
    process.env.EVUKB_MAX_UPLOAD_BYTES = '16';
    try {
      expect(resolveMaxUploadBytes()).toBe(16);
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_MAX_UPLOAD_BYTES;
      } else {
        process.env.EVUKB_MAX_UPLOAD_BYTES = previous;
      }
    }
  });

  it('enforces configured archive import size limits', () => {
    const previous = process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES;
    process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES = '32';
    try {
      expect(resolveMaxArchiveImportBytes()).toBe(32);
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES;
      } else {
        process.env.EVUKB_MAX_ARCHIVE_IMPORT_BYTES = previous;
      }
    }
  });

  it('rejects non-markdown indexing with explicit failure metadata', async () => {
    const updateIndexStatus = vi.fn().mockResolvedValue(undefined);
    const service = new IndexService({
      blobStore: {} as never,
      chunks: {} as never,
      corpora: {
        getById: vi.fn().mockResolvedValue({ id: 'corpus-1', settings: {} }),
      } as never,
      links: {} as never,
      nodes: {
        getById: vi.fn().mockResolvedValue({
          id: 'node-1',
          nodeType: 'file',
          name: 'diagram.png',
          mimeType: 'image/png',
          metadata: {},
          storageRelPath: 'managed/diagram.png',
        }),
        updateIndexStatus,
      } as never,
      vectorStore: {} as never,
    });

    await expect(service.indexNode('ws-1', 'corpus-1', 'node-1')).rejects.toBeInstanceOf(ApiError);
    expect(updateIndexStatus).toHaveBeenCalledWith(
      'ws-1',
      'corpus-1',
      'node-1',
      expect.objectContaining({
        indexStatus: 'failed',
        metadata: expect.objectContaining({
          indexError: 'Only markdown files are indexed in v1.',
        }),
      }),
    );
  });

  function buildWritebackFixture(mountRoot: string) {
    const corpora = {
      getById: vi.fn().mockResolvedValue({
        id: 'corpus-1',
        settings: {
          importKind: 'mount',
          mountMode: 'import_writeback',
          mountPath: mountRoot,
        },
      }),
    } as never;
    return new MountWritebackService({
      corpora,
      mountAllowlist: [mountRoot],
      env: { EVUKB_ENABLE_IMPORT_WRITEBACK: 'true' },
    });
  }

  function managedNode(path: string, name: string): KnowledgeNode {
    return {
      path,
      name,
      nodeType: 'file',
      sourceType: 'managed',
    } as KnowledgeNode;
  }

  it('refuses mount writeback through symlinked directories that escape the mount', async () => {
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-wb-mount-'));
    const outside = mkdtempSync(join(tmpdir(), 'evukb-wb-outside-'));
    try {
      symlinkSync(outside, join(mountRoot, 'linked'), 'dir');
      const service = buildWritebackFixture(mountRoot);

      await service.maybeWritebackManagedFile(
        'ws-1',
        'corpus-1',
        managedNode('linked', 'escape.md'),
        Buffer.from('# escape'),
      );

      expect(existsSync(join(outside, 'escape.md'))).toBe(false);
    } finally {
      rmSync(mountRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('refuses mount writeback deletes through symlinked files', async () => {
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-wb-mount-'));
    const outside = mkdtempSync(join(tmpdir(), 'evukb-wb-outside-'));
    try {
      const secret = join(outside, 'secret.md');
      await import('node:fs/promises').then(({ writeFile }) => writeFile(secret, 'secret'));
      symlinkSync(secret, join(mountRoot, 'note.md'));
      const service = buildWritebackFixture(mountRoot);

      await service.maybeDeleteWritebackManagedFile('ws-1', 'corpus-1', managedNode('', 'note.md'));

      expect(existsSync(secret)).toBe(true);
      // The in-mount symlink itself must also survive; the operation is refused.
      expect(existsSync(join(mountRoot, 'note.md'))).toBe(true);
    } finally {
      rmSync(mountRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('still writes managed files to safe mount paths', async () => {
    const mountRoot = mkdtempSync(join(tmpdir(), 'evukb-wb-mount-'));
    try {
      const service = buildWritebackFixture(mountRoot);
      mkdirSync(join(mountRoot, 'docs'));

      await service.maybeWritebackManagedFile(
        'ws-1',
        'corpus-1',
        managedNode('docs', 'note.md'),
        Buffer.from('# ok'),
      );

      await expect(readFile(join(mountRoot, 'docs', 'note.md'), 'utf8')).resolves.toBe('# ok');
    } finally {
      rmSync(mountRoot, { recursive: true, force: true });
    }
  });
});
