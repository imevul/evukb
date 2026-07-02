import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { asCorpusId, asNodeId, asWorkspaceId, type KnowledgeNode } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { MountWritebackService } from '../src/services/mount-writeback-service.js';

function managedNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: asNodeId('node-1'),
    workspaceId: asWorkspaceId('workspace-1'),
    corpusId: asCorpusId('corpus-1'),
    parentId: null,
    path: 'docs',
    name: 'note.md',
    nodeType: 'file',
    storageRelPath: 'managed/node-1',
    sourceType: 'managed',
    sourceRef: null,
    contentHash: 'abc',
    mimeType: 'text/markdown',
    sizeBytes: 12,
    indexStatus: 'indexed',
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MountWritebackService', () => {
  it('writes managed content to the mount when import_writeback is enabled', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-writeback-'));
    try {
      const corpora = {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        }),
      };
      const service = new MountWritebackService({
        corpora: corpora as never,
        mountAllowlist: [mountRoot],
        env: { EVUKB_ENABLE_IMPORT_WRITEBACK: 'true' },
      });

      await service.maybeWritebackManagedFile(
        'workspace-1',
        'corpus-1',
        managedNode(),
        Buffer.from('# updated\n', 'utf8'),
      );

      const written = await readFile(path.join(mountRoot, 'docs/note.md'), 'utf8');
      expect(written).toBe('# updated\n');
    } finally {
      await rm(mountRoot, { recursive: true, force: true });
    }
  });

  it('skips writeback when env flag is disabled', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-writeback-off-'));
    try {
      const corpora = {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        }),
      };
      const service = new MountWritebackService({
        corpora: corpora as never,
        mountAllowlist: [mountRoot],
        env: {},
      });

      await service.maybeWritebackManagedFile(
        'workspace-1',
        'corpus-1',
        managedNode(),
        Buffer.from('# updated\n', 'utf8'),
      );

      expect(corpora.getById).not.toHaveBeenCalled();
    } finally {
      await rm(mountRoot, { recursive: true, force: true });
    }
  });

  it('skips writeback when mount path is outside allowlist', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-writeback-deny-'));
    try {
      const corpora = {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        }),
      };
      const service = new MountWritebackService({
        corpora: corpora as never,
        mountAllowlist: ['/other/root'],
        env: { EVUKB_ENABLE_IMPORT_WRITEBACK: 'true' },
      });

      await expect(
        service.maybeWritebackManagedFile(
          'workspace-1',
          'corpus-1',
          managedNode(),
          Buffer.from('# updated\n', 'utf8'),
        ),
      ).resolves.toBeUndefined();
    } finally {
      await rm(mountRoot, { recursive: true, force: true });
    }
  });

  it('deletes managed mount file when import_writeback is enabled', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-writeback-delete-'));
    const targetPath = path.join(mountRoot, 'docs/note.md');
    try {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, '# stale\n', 'utf8');
      const corpora = {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        }),
      };
      const service = new MountWritebackService({
        corpora: corpora as never,
        mountAllowlist: [mountRoot],
        env: { EVUKB_ENABLE_IMPORT_WRITEBACK: 'true' },
      });

      await service.maybeDeleteWritebackManagedFile('workspace-1', 'corpus-1', managedNode());

      await expect(readFile(targetPath, 'utf8')).rejects.toThrow();
    } finally {
      await rm(mountRoot, { recursive: true, force: true });
    }
  });

  it('skips delete writeback when env flag is disabled', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-writeback-delete-off-'));
    const targetPath = path.join(mountRoot, 'docs/note.md');
    try {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, '# keep\n', 'utf8');
      const corpora = {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        }),
      };
      const service = new MountWritebackService({
        corpora: corpora as never,
        mountAllowlist: [mountRoot],
        env: {},
      });

      await service.maybeDeleteWritebackManagedFile('workspace-1', 'corpus-1', managedNode());

      expect(await readFile(targetPath, 'utf8')).toBe('# keep\n');
      expect(corpora.getById).not.toHaveBeenCalled();
    } finally {
      await rm(mountRoot, { recursive: true, force: true });
    }
  });

  it('ignores missing mount file on delete', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-writeback-delete-missing-'));
    try {
      const corpora = {
        getById: vi.fn().mockResolvedValue({
          id: 'corpus-1',
          settings: {
            importKind: 'mount',
            mountPath: mountRoot,
            mountMode: 'import_writeback',
          },
        }),
      };
      const service = new MountWritebackService({
        corpora: corpora as never,
        mountAllowlist: [mountRoot],
        env: { EVUKB_ENABLE_IMPORT_WRITEBACK: 'true' },
      });

      await expect(
        service.maybeDeleteWritebackManagedFile('workspace-1', 'corpus-1', managedNode()),
      ).resolves.toBeUndefined();
    } finally {
      await rm(mountRoot, { recursive: true, force: true });
    }
  });
});
