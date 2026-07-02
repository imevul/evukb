/**
 * pgvector store tests require Postgres:
 *   EVUKB_DATABASE_URL=postgres://evukb:evukb@localhost:5432/evukb
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
import { describe, expect, it } from 'vitest';

import { PgVectorStore } from '../src/adapters/pgvector-store.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

const dimensions = 1536;

function unitVector(index: number): number[] {
  const vector = new Array(dimensions).fill(0);
  vector[index] = 1;
  return vector;
}

describeIfDb('PgVectorStore', () => {
  it('searches across multiple corpora and stays workspace-scoped', async () => {
    const handle = createDb({ connectionString: resolveDatabaseUrl() });
    try {
      await migrateLatest(handle);

      const workspaces = new WorkspaceRepository(handle);
      const corpora = new CorpusRepository(handle);
      const nodes = new NodeRepository(handle);
      const chunks = new ChunkRepository(handle);

      const workspace = await workspaces.create({
        slug: `pgv-${randomUUID()}`,
        name: 'PgVector Workspace',
      });
      const otherWorkspace = await workspaces.create({
        slug: `pgv-other-${randomUUID()}`,
        name: 'Other Workspace',
      });

      async function seedCorpus(
        workspaceId: string,
        name: string,
        filePath: string,
        embedding: number[],
      ) {
        const corpus = await corpora.create({ workspaceId, name });
        const node = await nodes.create({
          workspaceId,
          corpusId: corpus.id,
          path: '',
          name: filePath,
          nodeType: 'file',
        });
        const [chunk] = await chunks.replaceForNode(workspaceId, corpus.id, node.id, [
          {
            workspaceId,
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
        return { corpus, chunk };
      }

      const queryEmbedding = unitVector(0);
      const a = await seedCorpus(workspace.id, 'Corpus A', 'a.md', unitVector(0));
      const b = await seedCorpus(workspace.id, 'Corpus B', 'b.md', unitVector(0));
      // Same embedding in another workspace must never surface.
      const foreign = await seedCorpus(otherWorkspace.id, 'Foreign', 'foreign.md', unitVector(0));

      const store = new PgVectorStore({ chunks });

      const multiHits = await store.search({
        workspaceId: asWorkspaceId(workspace.id),
        corpusIds: [asCorpusId(a.corpus.id), asCorpusId(b.corpus.id)],
        queryEmbedding,
        limit: 10,
      });

      const hitIds = multiHits.map((hit) => hit.chunkId);
      expect(hitIds).toContain(a.chunk?.id);
      expect(hitIds).toContain(b.chunk?.id);
      expect(hitIds).not.toContain(foreign.chunk?.id);

      const singleHits = await store.search({
        workspaceId: asWorkspaceId(workspace.id),
        corpusIds: [asCorpusId(a.corpus.id)],
        queryEmbedding,
        limit: 10,
      });
      expect(singleHits.map((hit) => hit.chunkId)).toEqual([a.chunk?.id]);

      const emptyHits = await store.search({
        workspaceId: asWorkspaceId(workspace.id),
        corpusIds: [],
        queryEmbedding,
        limit: 10,
      });
      expect(emptyHits).toEqual([]);
    } finally {
      await handle.close();
    }
  });
});
