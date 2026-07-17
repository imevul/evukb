import type {
  VectorChunkInput,
  VectorDeleteInput,
  VectorSearchHit,
  VectorSearchInput,
  VectorStore,
  VectorStoreHealth,
  VectorUpsertInput,
} from '@evu/kb-core';
import type { ChunkRepository } from '@evu/kb-db';
import { QdrantClient } from '@qdrant/js-client-rest';

export type QdrantVectorStoreDeps = {
  chunks: ChunkRepository;
  client: QdrantClient;
  collectionName: string;
  dimensions: number;
};

/** Documented defaults for new collections; see docs/VECTOR-TUNING.md. */
export const QDRANT_DEFAULT_HNSW_M = 16;
export const QDRANT_DEFAULT_HNSW_EF_CONSTRUCT = 100;

function slugifyModelName(model: string): string {
  return model.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function buildQdrantCollectionName(model: string, dimensions: number): string {
  return `evukb_${slugifyModelName(model)}_${dimensions}`;
}

export class QdrantVectorStore implements VectorStore {
  readonly #chunks: ChunkRepository;
  readonly #client: QdrantClient;
  readonly #collectionName: string;
  readonly #dimensions: number;
  #collectionReady = false;

  constructor(deps: QdrantVectorStoreDeps) {
    this.#chunks = deps.chunks;
    this.#client = deps.client;
    this.#collectionName = deps.collectionName;
    this.#dimensions = deps.dimensions;
  }

  async upsertChunks(input: VectorUpsertInput): Promise<void> {
    if (input.chunks.length === 0) {
      return;
    }

    await this.#ensureCollection();

    await this.#client.upsert(this.#collectionName, {
      wait: true,
      points: input.chunks.map((chunk) => ({
        id: chunk.chunkId,
        vector: chunk.embedding,
        payload: {
          workspaceId: input.workspaceId,
          corpusId: input.corpusId,
          chunkId: chunk.chunkId,
          nodeId: chunk.nodeId,
          ...(chunk.filePath ? { filePath: chunk.filePath } : {}),
        },
      })),
    });

    await this.#chunks.updateExternalVectorIds(
      input.workspaceId,
      input.corpusId,
      input.chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        externalVectorId: chunk.chunkId,
      })),
    );
  }

  async deleteChunks(input: VectorDeleteInput): Promise<void> {
    if (input.chunkIds.length === 0) {
      return;
    }

    await this.#ensureCollection();

    await this.#client.delete(this.#collectionName, {
      wait: true,
      points: input.chunkIds,
    });

    await this.#chunks.updateExternalVectorIds(
      input.workspaceId,
      input.corpusId,
      input.chunkIds.map((chunkId) => ({ chunkId, externalVectorId: null })),
    );
  }

  async search(input: VectorSearchInput): Promise<VectorSearchHit[]> {
    if (input.corpusIds.length === 0) {
      return [];
    }

    await this.#ensureCollection();

    const filter: {
      must: Array<Record<string, unknown>>;
    } = {
      must: [
        { key: 'workspaceId', match: { value: input.workspaceId } },
        {
          key: 'corpusId',
          match: { any: input.corpusIds },
        },
      ],
    };

    const response = await this.#client.search(this.#collectionName, {
      vector: input.queryEmbedding,
      limit: input.pathPrefix ? input.limit * 3 : input.limit,
      filter,
      with_payload: true,
    });

    const pathPrefix = input.pathPrefix?.trim();
    const hits: VectorSearchHit[] = [];

    for (const point of response) {
      const payload = point.payload as Record<string, unknown> | null | undefined;
      const chunkId = String(payload?.chunkId ?? point.id);
      const filePath = payload?.filePath ? String(payload.filePath) : undefined;
      if (pathPrefix && filePath && !filePath.startsWith(pathPrefix)) {
        continue;
      }
      hits.push({
        chunkId,
        score: point.score ?? 0,
      });
      if (hits.length >= input.limit) {
        break;
      }
    }

    return hits;
  }

  async health(): Promise<VectorStoreHealth> {
    try {
      await this.#client.getCollections();
      return { backend: 'qdrant', status: 'ok' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Qdrant health check failed.';
      return { backend: 'qdrant', status: 'error', message };
    }
  }

  async #ensureCollection(): Promise<void> {
    if (this.#collectionReady) {
      return;
    }

    const collections = await this.#client.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === this.#collectionName,
    );

    if (!exists) {
      await this.#client.createCollection(this.#collectionName, {
        vectors: {
          size: this.#dimensions,
          distance: 'Cosine',
        },
        hnsw_config: {
          m: QDRANT_DEFAULT_HNSW_M,
          ef_construct: QDRANT_DEFAULT_HNSW_EF_CONSTRUCT,
        },
      });
    }

    this.#collectionReady = true;
  }
}

export type CreateQdrantVectorStoreInput = {
  chunks: ChunkRepository;
  qdrantUrl: string;
  embeddingModel: string;
  dimensions: number;
};

export function createQdrantVectorStore(input: CreateQdrantVectorStoreInput): QdrantVectorStore {
  const client = new QdrantClient({ url: input.qdrantUrl });
  return new QdrantVectorStore({
    chunks: input.chunks,
    client,
    collectionName: buildQdrantCollectionName(input.embeddingModel, input.dimensions),
    dimensions: input.dimensions,
  });
}

export function toVectorChunkInputs(
  chunks: Array<{ id: string; nodeId: string; filePath: string }>,
  embeddings: Array<number[] | null>,
): VectorChunkInput[] {
  return chunks.flatMap((chunk, index) => {
    const embedding = embeddings[index];
    if (!embedding) {
      return [];
    }
    return [
      {
        chunkId: chunk.id,
        nodeId: chunk.nodeId,
        embedding,
        filePath: chunk.filePath,
      },
    ];
  });
}
