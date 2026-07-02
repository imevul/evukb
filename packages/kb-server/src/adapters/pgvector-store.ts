import type {
  VectorDeleteInput,
  VectorSearchHit,
  VectorSearchInput,
  VectorStore,
  VectorStoreHealth,
  VectorUpsertInput,
} from '@evu/kb-core';
import type { ChunkRepository } from '@evu/kb-db';

export type PgVectorStoreDeps = {
  chunks: ChunkRepository;
};

export class PgVectorStore implements VectorStore {
  readonly #chunks: ChunkRepository;

  constructor(deps: PgVectorStoreDeps) {
    this.#chunks = deps.chunks;
  }

  async upsertChunks(_input: VectorUpsertInput): Promise<void> {
    // Embeddings are persisted via ChunkRepository.replaceForNode for pgvector.
  }

  async deleteChunks(_input: VectorDeleteInput): Promise<void> {
    // Chunk rows (and embeddings) are removed via ChunkRepository.replaceForNode.
  }

  async search(input: VectorSearchInput): Promise<VectorSearchHit[]> {
    if (input.corpusIds.length === 0) {
      return [];
    }

    const hits = await this.#chunks.searchSemantic(
      input.workspaceId,
      [...input.corpusIds],
      input.queryEmbedding,
      {
        ...(input.pathPrefix ? { pathPrefix: input.pathPrefix } : {}),
        limit: input.limit,
      },
    );

    return hits.map((hit) => ({
      chunkId: hit.id,
      score: hit.semanticScore,
    }));
  }

  async health(): Promise<VectorStoreHealth> {
    return { backend: 'pgvector', status: 'ok' };
  }
}
