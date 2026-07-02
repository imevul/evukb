import { randomUUID } from 'node:crypto';

import type { KnowledgeNode } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../src/errors.js';
import { ArchiveImportService } from '../src/services/archive-import-service.js';
import { sha256Hex } from '../src/services/import-shared.js';

const workspaceId = randomUUID();
const corpusId = randomUUID();

type NodeSeed = {
  id: string;
  path: string;
  name: string;
  nodeType: 'file' | 'folder';
  contentHash?: string | null;
};

function fakeNode(seed: NodeSeed): KnowledgeNode {
  return {
    id: seed.id,
    workspaceId,
    corpusId,
    parentId: null,
    path: seed.path,
    name: seed.name,
    nodeType: seed.nodeType,
    sourceType: 'managed',
    sourceRef: null,
    mimeType: seed.nodeType === 'file' ? 'text/markdown' : null,
    contentHash: seed.contentHash ?? null,
    sizeBytes: 0,
    storageRelPath: null,
    metadata: {},
    indexStatus: 'pending',
    indexError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as KnowledgeNode;
}

function buildService(seedNodes: NodeSeed[] = []) {
  const existing = new Map<string, KnowledgeNode>();
  for (const seed of seedNodes) {
    existing.set(`${seed.path}\u0000${seed.name}`, fakeNode(seed));
  }

  const created: Array<Record<string, unknown>> = [];
  const updatedContent: Array<Record<string, unknown>> = [];
  const blobPuts: Array<Record<string, unknown>> = [];
  const enqueued: Array<{ nodeId: string }> = [];

  const nodes = {
    ensureSyncedFolder: vi.fn(async () =>
      fakeNode({
        id: randomUUID(),
        path: '',
        name: 'folder',
        nodeType: 'folder',
      }),
    ),
    getByPathAndName: vi.fn(async (_ws: string, _corpus: string, path: string, name: string) => {
      return existing.get(`${path}\u0000${name}`) ?? null;
    }),
    create: vi.fn(async (input: Record<string, unknown>) => {
      created.push(input);
      return fakeNode({
        id: randomUUID(),
        path: input.path as string,
        name: input.name as string,
        nodeType: 'file',
      });
    }),
    updateContent: vi.fn(async (_ws: string, _corpus: string, nodeId: string, patch: unknown) => {
      updatedContent.push({ nodeId, patch });
    }),
    listByCorpus: vi.fn(async () => [...existing.values()]),
  };

  const corpora = {
    getById: vi.fn(async () => ({ id: corpusId, chunkCount: 0 })),
    refreshStats: vi.fn(async () => undefined),
  };

  const blobStore = {
    put: vi.fn(async (input: Record<string, unknown>) => {
      blobPuts.push(input);
    }),
  };

  const jobQueue = {
    enqueueIndexMany: vi.fn(async (jobs: Array<{ nodeId: string }>) => {
      enqueued.push(...jobs);
      return jobs.length;
    }),
  };

  const service = new ArchiveImportService({
    // biome-ignore lint/suspicious/noExplicitAny: minimal fakes for unit test
    blobStore: blobStore as any,
    // biome-ignore lint/suspicious/noExplicitAny: minimal fakes for unit test
    corpora: corpora as any,
    // biome-ignore lint/suspicious/noExplicitAny: minimal fakes for unit test
    jobQueue: jobQueue as any,
    // biome-ignore lint/suspicious/noExplicitAny: minimal fakes for unit test
    nodes: nodes as any,
  });

  return {
    service,
    nodes,
    corpora,
    blobStore,
    jobQueue,
    created,
    updatedContent,
    blobPuts,
    enqueued,
  };
}

describe('ArchiveImportService', () => {
  it('rejects imports into unknown corpora', async () => {
    const { service, corpora } = buildService();
    corpora.getById.mockResolvedValueOnce(null as never);

    await expect(
      service.importGenericZip(workspaceId, corpusId, new Map([['a.md', new Uint8Array([1])]])),
    ).rejects.toMatchObject({ code: 'corpus_not_found' });
  });

  it('rejects empty archives', async () => {
    const { service } = buildService();

    await expect(service.importGenericZip(workspaceId, corpusId, new Map())).rejects.toThrow(
      ApiError,
    );
    await expect(service.importGenericZip(workspaceId, corpusId, new Map())).rejects.toMatchObject({
      code: 'validation_error',
    });
  });

  it('imports new files, stores blobs, and queues markdown for indexing', async () => {
    const { service, created, blobPuts, updatedContent, enqueued, corpora } = buildService();
    const entries = new Map<string, Uint8Array>([
      ['notes/hello.md', new TextEncoder().encode('# hi')],
      ['assets/logo.png', new Uint8Array([0x89, 0x50])],
    ]);

    const result = await service.importGenericZip(workspaceId, corpusId, entries);

    expect(result.imported).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(created).toHaveLength(2);
    expect(blobPuts).toHaveLength(2);
    expect(updatedContent).toHaveLength(2);
    // Only the markdown file is queued for indexing.
    expect(result.indexed).toBe(1);
    expect(enqueued).toHaveLength(1);
    expect(corpora.refreshStats).toHaveBeenCalledOnce();
  });

  it('skips unchanged files and updates changed ones', async () => {
    const unchangedBytes = new TextEncoder().encode('same');
    const { service, created, updatedContent } = buildService([
      {
        id: randomUUID(),
        path: '',
        name: 'same.md',
        nodeType: 'file',
        contentHash: sha256Hex(unchangedBytes),
      },
      {
        id: randomUUID(),
        path: '',
        name: 'changed.md',
        nodeType: 'file',
        contentHash: sha256Hex(new TextEncoder().encode('old content')),
      },
    ]);

    const result = await service.importGenericZip(
      workspaceId,
      corpusId,
      new Map<string, Uint8Array>([
        ['same.md', unchangedBytes],
        ['changed.md', new TextEncoder().encode('new content')],
      ]),
    );

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(0);
    expect(created).toHaveLength(0);
    // Only the changed file gets new content written.
    expect(updatedContent).toHaveLength(1);
  });

  it('reports folder conflicts as per-entry errors without aborting the import', async () => {
    const { service } = buildService([
      { id: randomUUID(), path: '', name: 'docs', nodeType: 'folder' },
    ]);

    const result = await service.importGenericZip(
      workspaceId,
      corpusId,
      new Map<string, Uint8Array>([
        ['docs', new TextEncoder().encode('collides with folder')],
        ['ok.md', new TextEncoder().encode('fine')],
      ]),
    );

    expect(result.errors).toEqual(['docs: path conflicts with an existing folder.']);
    expect(result.imported).toBe(1);
  });

  it('collects unexpected per-entry failures and continues', async () => {
    const { service, nodes } = buildService();
    nodes.create.mockRejectedValueOnce(new Error('db exploded'));

    const result = await service.importGenericZip(
      workspaceId,
      corpusId,
      new Map<string, Uint8Array>([
        ['boom.md', new TextEncoder().encode('a')],
        ['ok.md', new TextEncoder().encode('b')],
      ]),
    );

    expect(result.errors).toEqual(['boom.md: db exploded']);
    expect(result.imported).toBe(1);
  });
});
