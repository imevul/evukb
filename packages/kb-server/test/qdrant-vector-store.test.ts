import { asCorpusId, asWorkspaceId } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import {
  buildQdrantCollectionName,
  QdrantVectorStore,
} from '../src/adapters/qdrant-vector-store.js';

describe('QdrantVectorStore', () => {
  it('builds stable collection names from model and dimensions', () => {
    expect(buildQdrantCollectionName('text-embedding-3-small', 1536)).toBe(
      'evukb_text_embedding_3_small_1536',
    );
  });

  it('scopes search filters to workspace and corpus', async () => {
    const search = vi.fn().mockResolvedValue([]);
    const client = {
      getCollections: vi.fn().mockResolvedValue({ collections: [{ name: 'evukb_test_1536' }] }),
      createCollection: vi.fn(),
      search,
      upsert: vi.fn(),
      delete: vi.fn(),
    };

    const chunks = {
      updateExternalVectorIds: vi.fn(),
    };

    const store = new QdrantVectorStore({
      chunks: chunks as never,
      client: client as never,
      collectionName: 'evukb_test_1536',
      dimensions: 1536,
    });

    await store.search({
      workspaceId: asWorkspaceId('workspace-1'),
      corpusIds: [asCorpusId('corpus-1')],
      queryEmbedding: [0.1, 0.2],
      limit: 5,
    });

    expect(search).toHaveBeenCalledWith(
      'evukb_test_1536',
      expect.objectContaining({
        filter: {
          must: [
            { key: 'workspaceId', match: { value: 'workspace-1' } },
            { key: 'corpusId', match: { any: ['corpus-1'] } },
          ],
        },
      }),
    );
  });

  it('maps upserted points to search hits', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const search = vi.fn().mockResolvedValue([
      { id: 'chunk-2', score: 0.91, payload: { chunkId: 'chunk-2', filePath: 'docs/b.md' } },
      { id: 'chunk-1', score: 0.82, payload: { chunkId: 'chunk-1', filePath: 'docs/a.md' } },
    ]);
    const client = {
      getCollections: vi.fn().mockResolvedValue({ collections: [{ name: 'evukb_test_1536' }] }),
      createCollection: vi.fn(),
      search,
      upsert,
      delete: vi.fn(),
    };
    const chunks = {
      updateExternalVectorIds: vi.fn(),
    };

    const store = new QdrantVectorStore({
      chunks: chunks as never,
      client: client as never,
      collectionName: 'evukb_test_1536',
      dimensions: 1536,
    });

    await store.upsertChunks({
      workspaceId: asWorkspaceId('workspace-1'),
      corpusId: asCorpusId('corpus-1'),
      chunks: [
        {
          chunkId: 'chunk-1',
          nodeId: 'node-1',
          embedding: new Array(1536).fill(0.1),
          filePath: 'docs/a.md',
        },
      ],
    });
    expect(upsert).toHaveBeenCalled();

    const hits = await store.search({
      workspaceId: asWorkspaceId('workspace-1'),
      corpusIds: [asCorpusId('corpus-1')],
      queryEmbedding: new Array(1536).fill(0.1),
      limit: 2,
    });
    expect(hits).toEqual([
      { chunkId: 'chunk-2', score: 0.91 },
      { chunkId: 'chunk-1', score: 0.82 },
    ]);
  });

  it('deletes chunks by id', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const client = {
      getCollections: vi.fn().mockResolvedValue({ collections: [{ name: 'evukb_test_1536' }] }),
      createCollection: vi.fn(),
      search: vi.fn(),
      upsert: vi.fn(),
      delete: del,
    };
    const chunks = {
      updateExternalVectorIds: vi.fn(),
    };

    const store = new QdrantVectorStore({
      chunks: chunks as never,
      client: client as never,
      collectionName: 'evukb_test_1536',
      dimensions: 1536,
    });

    await store.deleteChunks({
      workspaceId: asWorkspaceId('workspace-1'),
      corpusId: asCorpusId('corpus-1'),
      chunkIds: ['chunk-1', 'chunk-2'],
    });

    expect(del).toHaveBeenCalledWith('evukb_test_1536', {
      wait: true,
      points: ['chunk-1', 'chunk-2'],
    });
    expect(chunks.updateExternalVectorIds).toHaveBeenCalledWith('workspace-1', 'corpus-1', [
      { chunkId: 'chunk-1', externalVectorId: null },
      { chunkId: 'chunk-2', externalVectorId: null },
    ]);
  });
});
