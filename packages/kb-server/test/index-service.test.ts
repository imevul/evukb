import type { KnowledgeNode } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import { IndexService } from '../src/services/index-service.js';

function createNode(id: string, indexStatus: KnowledgeNode['indexStatus']): KnowledgeNode {
  return {
    id,
    workspaceId: 'ws-1',
    corpusId: 'corpus-1',
    parentId: null,
    path: '',
    name: `${id}.md`,
    nodeType: 'file',
    storageRelPath: `managed/${id}`,
    sourceType: 'managed',
    sourceRef: null,
    contentHash: 'hash',
    mimeType: 'text/markdown',
    sizeBytes: 12,
    indexStatus,
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: null,
  };
}

describe('IndexService.reindexNeedingAttention', () => {
  it('indexes only pending, stale, and failed markdown files', async () => {
    const nodes = [
      createNode('indexed', 'indexed'),
      createNode('pending', 'pending'),
      createNode('stale', 'stale'),
      createNode('failed', 'failed'),
      createNode('indexing', 'indexing'),
    ];

    const service = new IndexService({
      blobStore: {} as never,
      chunks: {} as never,
      corpora: {} as never,
      links: {
        listByCorpus: vi.fn().mockResolvedValue([]),
      } as never,
      nodes: {
        listIndexableFilesByCorpus: vi.fn().mockResolvedValue(nodes),
        listByCorpus: vi.fn().mockResolvedValue(nodes),
      } as never,
    });

    const indexNodesSpy = vi.spyOn(service, 'indexNodes').mockResolvedValue([
      {
        nodeId: 'pending',
        chunkCount: 1,
        linkCount: 0,
        indexStatus: 'indexed',
        warnings: [],
      },
      {
        nodeId: 'stale',
        chunkCount: 1,
        linkCount: 0,
        indexStatus: 'indexed',
        warnings: [],
      },
      {
        nodeId: 'failed',
        chunkCount: 1,
        linkCount: 0,
        indexStatus: 'indexed',
        warnings: [],
      },
    ]);

    const results = await service.reindexNeedingAttention('ws-1', 'corpus-1');

    expect(indexNodesSpy).toHaveBeenCalledWith('ws-1', 'corpus-1', ['pending', 'stale', 'failed']);
    expect(results).toHaveLength(3);
  });

  it('returns an empty result when no files need attention', async () => {
    const service = new IndexService({
      blobStore: {} as never,
      chunks: {} as never,
      corpora: {} as never,
      links: {} as never,
      nodes: {
        listIndexableFilesByCorpus: vi.fn().mockResolvedValue([createNode('indexed', 'indexed')]),
      } as never,
    });

    const indexNodesSpy = vi.spyOn(service, 'indexNodes');

    const results = await service.reindexNeedingAttention('ws-1', 'corpus-1');

    expect(results).toEqual([]);
    expect(indexNodesSpy).not.toHaveBeenCalled();
  });
});
