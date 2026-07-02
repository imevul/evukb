import { defaultEmbeddingDimensions, type EmbeddingProvider, type VectorStore } from '@evu/kb-core';
import type { ChunkRepository } from '@evu/kb-db';
import { PgVectorStore } from './pgvector-store.js';
import { createQdrantVectorStore } from './qdrant-vector-store.js';

export type VectorBackend = 'pgvector' | 'qdrant';

export type ResolvedVectorStore = {
  backend: VectorBackend;
  store: VectorStore;
};

export type ResolveVectorStoreDeps = {
  chunks: ChunkRepository;
  embeddingProvider?: EmbeddingProvider | null;
  env?: NodeJS.ProcessEnv;
};

export function resolveVectorBackend(env: NodeJS.ProcessEnv = process.env): VectorBackend {
  const raw = env.EVUKB_VECTOR_BACKEND?.trim().toLowerCase();
  if (raw === 'qdrant') {
    return 'qdrant';
  }
  return 'pgvector';
}

export function resolveVectorStore(deps: ResolveVectorStoreDeps): ResolvedVectorStore {
  const env = deps.env ?? process.env;
  const backend = resolveVectorBackend(env);

  if (backend === 'qdrant') {
    const qdrantUrl = env.EVUKB_QDRANT_URL?.trim();
    if (!qdrantUrl) {
      throw new Error('EVUKB_QDRANT_URL is required when EVUKB_VECTOR_BACKEND=qdrant.');
    }

    const embeddingProvider = deps.embeddingProvider ?? null;
    const model = embeddingProvider?.model ?? env.EVUKB_EMBEDDING_MODEL ?? 'text-embedding-3-small';
    const dimensions = embeddingProvider?.dimensions ?? defaultEmbeddingDimensions;

    return {
      backend: 'qdrant',
      store: createQdrantVectorStore({
        chunks: deps.chunks,
        qdrantUrl,
        embeddingModel: model,
        dimensions,
      }),
    };
  }

  return {
    backend: 'pgvector',
    store: new PgVectorStore({ chunks: deps.chunks }),
  };
}
