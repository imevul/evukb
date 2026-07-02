import type { CorpusId, WorkspaceId } from '../ids.js';

export type BlobRef = {
  workspaceId: WorkspaceId;
  corpusId: CorpusId;
  relPath: string;
};

export type BlobStat = BlobRef & {
  sizeBytes: number;
  contentHash: string | null;
  updatedAt: string;
};

export type PutBlobInput = {
  ref: BlobRef;
  body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  contentHash?: string;
};

export interface BlobStore {
  put(input: PutBlobInput): Promise<BlobRef>;
  get(ref: BlobRef): Promise<ReadableStream<Uint8Array>>;
  stat(ref: BlobRef): Promise<BlobStat>;
  delete(ref: BlobRef): Promise<void>;
  list(prefix: BlobRef): AsyncIterable<BlobStat>;
}

export type VectorChunkInput = {
  chunkId: string;
  nodeId: string;
  embedding: number[];
  filePath?: string;
};

export type VectorUpsertInput = {
  workspaceId: WorkspaceId;
  corpusId: CorpusId;
  chunks: VectorChunkInput[];
};

export type VectorDeleteInput = {
  workspaceId: WorkspaceId;
  corpusId: CorpusId;
  chunkIds: string[];
};

export type VectorSearchInput = {
  workspaceId: WorkspaceId;
  corpusIds: CorpusId[];
  queryEmbedding: number[];
  limit: number;
  pathPrefix?: string;
};

export type VectorSearchHit = {
  chunkId: string;
  score: number;
};

export type VectorStoreHealth = {
  backend: 'pgvector' | 'qdrant';
  status: 'ok' | 'error';
  message?: string;
};

export interface VectorStore {
  upsertChunks(input: VectorUpsertInput): Promise<void>;
  deleteChunks(input: VectorDeleteInput): Promise<void>;
  search(input: VectorSearchInput): Promise<VectorSearchHit[]>;
  health(): Promise<VectorStoreHealth>;
}
