import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { LocalFilesystemBlobStore } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { MountSyncService } from '../src/services/mount-sync-service.js';
import { SyncImportService } from '../src/services/sync-import-service.js';

function createNodeRepository(nodes: Array<Record<string, unknown>>) {
  return {
    listByCorpus: vi.fn(async () => nodes),
    getBySourceRef: vi.fn(
      async (_w, _c, _t, sourceRef) => nodes.find((node) => node.sourceRef === sourceRef) ?? null,
    ),
    getByPathAndName: vi.fn(
      async (_w, _c, nodePath, name) =>
        nodes.find((node) => node.path === nodePath && node.name === name) ?? null,
    ),
    ensureSyncedFolder: vi.fn(async (input) => {
      const existing = nodes.find(
        (node) =>
          node.path === input.path && node.name === input.name && node.nodeType === 'folder',
      );
      if (existing) {
        return existing;
      }
      const folder = {
        id: `folder-${nodes.length + 1}`,
        ...input,
        nodeType: 'folder',
        storageRelPath: null,
        contentHash: null,
        mimeType: null,
        sizeBytes: 0,
        indexStatus: 'indexed',
        metadata: {},
      };
      nodes.push(folder);
      return folder;
    }),
    create: vi.fn(async (input) => {
      const node = {
        id: `node-${nodes.length + 1}`,
        ...input,
        storageRelPath: null,
        metadata: {},
      };
      nodes.push(node);
      return node;
    }),
    upsertSyncedFile: vi.fn(async (input) => {
      const existing = nodes.find((node) => node.sourceRef === input.sourceRef);
      if (existing) {
        Object.assign(existing, input, { id: existing.id });
        return existing;
      }
      const node = { id: `node-${nodes.length + 1}`, ...input, metadata: {} };
      nodes.push(node);
      return node;
    }),
    deleteSyncedNodesNotInRefs: vi.fn(async () => []),
    deleteManagedFilesNotInPaths: vi.fn(
      async (_workspaceId, _corpusId, keepRelativePaths: Set<string>) => {
        const toDelete = nodes.filter((node) => {
          if (node.nodeType !== 'file' || node.sourceType !== 'managed') {
            return false;
          }
          const nodePath = typeof node.path === 'string' ? node.path : '';
          const nodeName = typeof node.name === 'string' ? node.name : '';
          const relativePath = nodePath ? `${nodePath}/${nodeName}` : nodeName;
          return !keepRelativePaths.has(relativePath);
        });
        for (const node of toDelete) {
          const index = nodes.indexOf(node);
          if (index >= 0) {
            nodes.splice(index, 1);
          }
        }
        return toDelete;
      },
    ),
  };
}

describe('MountSyncService', () => {
  it('imports files from an allowed mount path', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-mount-'));
    const blobRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-blob-'));
    await writeFile(path.join(mountRoot, 'alpha.md'), '# Alpha\n', 'utf8');

    const workspaceId = '00000000-0000-4000-8000-000000000001';
    const corpusId = '00000000-0000-4000-8000-000000000002';
    const corpus = {
      id: corpusId,
      workspaceId,
      settings: { importKind: 'mount', mountPath: mountRoot, mountMode: 'import' },
      chunkCount: 0,
    };

    const nodes: Array<Record<string, unknown>> = [];
    const nodeRepository = createNodeRepository(nodes);

    const corpora = {
      getById: vi.fn(async () => corpus),
      update: vi.fn(async (_w, _c, input) => ({ ...corpus, ...input })),
      refreshStats: vi.fn(async () => corpus),
    };

    const jobQueue = {
      enqueueIndexMany: vi.fn(async () => 1),
    };

    const syncImport = new SyncImportService({
      blobStore: new LocalFilesystemBlobStore({ rootDir: blobRoot }),
      corpora: corpora as never,
      jobQueue: jobQueue as never,
      nodes: nodeRepository as never,
    });

    const mountSync = new MountSyncService({
      corpora: corpora as never,
      jobQueue: jobQueue as never,
      syncImport,
      mountAllowlist: mountRoot,
    });

    const result = await mountSync.runSync({ workspaceId, corpusId });
    expect(result.added).toBe(1);
    expect(jobQueue.enqueueIndexMany).toHaveBeenCalled();

    await rm(mountRoot, { recursive: true, force: true });
    await rm(blobRoot, { recursive: true, force: true });
  });

  it('deletes managed orphans not on mount in mount_authoritative mode', async () => {
    const mountRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-mount-'));
    const blobRoot = await mkdtemp(path.join(os.tmpdir(), 'evukb-blob-'));
    await writeFile(path.join(mountRoot, 'alpha.md'), '# Alpha\n', 'utf8');

    const workspaceId = '00000000-0000-4000-8000-000000000001';
    const corpusId = '00000000-0000-4000-8000-000000000002';
    const corpus = {
      id: corpusId,
      workspaceId,
      settings: {
        importKind: 'mount',
        mountPath: mountRoot,
        mountMode: 'mount_authoritative',
      },
      chunkCount: 0,
    };

    const nodes: Array<Record<string, unknown>> = [
      {
        id: 'managed-orphan',
        workspaceId,
        corpusId,
        path: '',
        name: 'orphan.md',
        nodeType: 'file',
        sourceType: 'managed',
        sourceRef: null,
        storageRelPath: 'orphan.md',
        metadata: {},
      },
    ];
    const nodeRepository = createNodeRepository(nodes);

    const corpora = {
      getById: vi.fn(async () => corpus),
      update: vi.fn(async (_w, _c, input) => ({ ...corpus, ...input })),
      refreshStats: vi.fn(async () => corpus),
    };

    const jobQueue = {
      enqueueIndexMany: vi.fn(async () => 1),
    };

    const syncImport = new SyncImportService({
      blobStore: new LocalFilesystemBlobStore({ rootDir: blobRoot }),
      corpora: corpora as never,
      jobQueue: jobQueue as never,
      nodes: nodeRepository as never,
    });

    const mountSync = new MountSyncService({
      corpora: corpora as never,
      jobQueue: jobQueue as never,
      syncImport,
      mountAllowlist: mountRoot,
    });

    const result = await mountSync.runSync({ workspaceId, corpusId });
    expect(result.added).toBe(1);
    expect(result.removed).toBeGreaterThanOrEqual(1);
    expect(nodeRepository.deleteManagedFilesNotInPaths).toHaveBeenCalled();
    expect(nodes.some((node) => node.id === 'managed-orphan')).toBe(false);

    await rm(mountRoot, { recursive: true, force: true });
    await rm(blobRoot, { recursive: true, force: true });
  });
});
