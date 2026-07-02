/**
 * Vector backend parity tests require Postgres and Qdrant:
 *   EVUKB_DATABASE_URL=... EVUKB_QDRANT_URL=http://localhost:6333
 */
import { randomUUID } from 'node:crypto';

import { asCorpusId, asWorkspaceId } from '@evu/kb-core';
import {
  ChunkRepository,
  CorpusRepository,
  createDb,
  migrateLatest,
  NodeRepository,
  resolveDatabaseUrl,
  WorkspaceRepository,
} from '@evu/kb-db';
import { QdrantClient } from '@qdrant/js-client-rest';
import { describe, expect, it } from 'vitest';

import { PgVectorStore } from '../src/adapters/pgvector-store.js';
import {
  buildQdrantCollectionName,
  QdrantVectorStore,
} from '../src/adapters/qdrant-vector-store.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const qdrantUrl = process.env.EVUKB_QDRANT_URL;
const describeIfParity = databaseUrl && qdrantUrl ? describe : describe.skip;

const dimensions = 1536;
const embeddingModel = 'parity-test-model';

function unitVector(index: number): number[] {
  const vector = new Array(dimensions).fill(0);
  vector[index] = 1;
  return vector;
}

describeIfParity('vector backend parity', () => {
  it('returns matching semantic hits from pgvector and Qdrant', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    const collectionName = `${buildQdrantCollectionName(embeddingModel, dimensions)}_${randomUUID().slice(0, 8)}`;
    const client = new QdrantClient({ url: qdrantUrl });

    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
      const chunks = new ChunkRepository(handle);

      const workspace = await workspaces.create({
        slug: `parity-${randomUUID()}`,
        name: 'Parity Workspace',
      });
      const corpus = await corpora.create({
        workspaceId: workspace.id,
        name: 'Parity Corpus',
      });
      const node = await nodes.create({
        workspaceId: workspace.id,
        corpusId: corpus.id,
        path: '',
        name: 'parity.md',
        nodeType: 'file',
      });

      const embeddingA = unitVector(0);
      const embeddingB = unitVector(1);
      const queryEmbedding = unitVector(1);

      const stored = await chunks.replaceForNode(workspace.id, corpus.id, node.id, [
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          nodeId: node.id,
          ordinal: 0,
          filePath: 'parity-a.md',
          folderPath: '',
          headingPath: [],
          body: 'chunk a',
          bodyPreview: 'chunk a',
          tokenCount: 2,
          embedding: embeddingA,
        },
        {
          workspaceId: workspace.id,
          corpusId: corpus.id,
          nodeId: node.id,
          ordinal: 1,
          filePath: 'parity-b.md',
          folderPath: '',
          headingPath: [],
          body: 'chunk b',
          bodyPreview: 'chunk b',
          tokenCount: 2,
          embedding: embeddingB,
        },
      ]);

      await client.createCollection(collectionName, {
        vectors: { size: dimensions, distance: 'Cosine' },
      });

      const qdrantStore = new QdrantVectorStore({
        chunks,
        client,
        collectionName,
        dimensions,
      });

      await qdrantStore.upsertChunks({
        workspaceId: asWorkspaceId(workspace.id),
        corpusId: asCorpusId(corpus.id),
        chunks: stored.map((chunk, index) => ({
          chunkId: chunk.id,
          nodeId: chunk.nodeId,
          embedding: index === 0 ? embeddingA : embeddingB,
          filePath: chunk.filePath,
        })),
      });

      const pgStore = new PgVectorStore({ chunks });
      const pgHits = await pgStore.search({
        workspaceId: asWorkspaceId(workspace.id),
        corpusIds: [asCorpusId(corpus.id)],
        queryEmbedding,
        limit: 2,
      });
      const qdrantHits = await qdrantStore.search({
        workspaceId: asWorkspaceId(workspace.id),
        corpusIds: [asCorpusId(corpus.id)],
        queryEmbedding,
        limit: 2,
      });

      expect(pgHits.map((hit) => hit.chunkId)).toEqual(qdrantHits.map((hit) => hit.chunkId));
      expect(pgHits[0]?.chunkId).toBe(stored[1]?.id);
      for (let index = 0; index < pgHits.length; index += 1) {
        expect(pgHits[index]?.score).toBeCloseTo(qdrantHits[index]?.score ?? 0, 5);
      }
    } finally {
      await client.deleteCollection(collectionName).catch(() => undefined);
      await handle.close();
    }
  });

  it('returns matching semantic hits across multiple corpora', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    const collectionName = `${buildQdrantCollectionName(embeddingModel, dimensions)}_${randomUUID().slice(0, 8)}`;
    const client = new QdrantClient({ url: qdrantUrl });

    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
      const chunks = new ChunkRepository(handle);

      const workspace = await workspaces.create({
        slug: `parity-multi-${randomUUID()}`,
        name: 'Parity Multi Workspace',
      });

      await client.createCollection(collectionName, {
        vectors: { size: dimensions, distance: 'Cosine' },
      });
      const qdrantStore = new QdrantVectorStore({
        chunks,
        client,
        collectionName,
        dimensions,
      });

      async function seedCorpus(name: string, filePath: string, embedding: number[]) {
        const corpus = await corpora.create({ workspaceId: workspace.id, name });
        const node = await nodes.create({
          workspaceId: workspace.id,
          corpusId: corpus.id,
          path: '',
          name: filePath,
          nodeType: 'file',
        });
        const [chunk] = await chunks.replaceForNode(workspace.id, corpus.id, node.id, [
          {
            workspaceId: workspace.id,
            corpusId: corpus.id,
            nodeId: node.id,
            ordinal: 0,
            filePath,
            folderPath: '',
            headingPath: [],
            body: `${name} body`,
            bodyPreview: `${name} body`,
            tokenCount: 2,
            embedding,
          },
        ]);
        if (!chunk) {
          throw new Error('Failed to seed chunk');
        }
        await qdrantStore.upsertChunks({
          workspaceId: asWorkspaceId(workspace.id),
          corpusId: asCorpusId(corpus.id),
          chunks: [
            {
              chunkId: chunk.id,
              nodeId: chunk.nodeId,
              embedding,
              filePath: chunk.filePath,
            },
          ],
        });
        return { corpus, chunk };
      }

      const corpusA = await seedCorpus('Corpus A', 'multi-a.md', unitVector(0));
      const corpusB = await seedCorpus('Corpus B', 'multi-b.md', unitVector(1));
      const queryEmbedding = unitVector(1);

      const pgStore = new PgVectorStore({ chunks });
      const searchInput = {
        workspaceId: asWorkspaceId(workspace.id),
        corpusIds: [asCorpusId(corpusA.corpus.id), asCorpusId(corpusB.corpus.id)],
        queryEmbedding,
        limit: 2,
      };
      const pgHits = await pgStore.search(searchInput);
      const qdrantHits = await qdrantStore.search(searchInput);

      expect(pgHits.map((hit) => hit.chunkId)).toEqual(qdrantHits.map((hit) => hit.chunkId));
      expect(pgHits[0]?.chunkId).toBe(corpusB.chunk.id);
      expect(pgHits.map((hit) => hit.chunkId)).toContain(corpusA.chunk.id);
    } finally {
      await client.deleteCollection(collectionName).catch(() => undefined);
      await handle.close();
    }
  });
});
