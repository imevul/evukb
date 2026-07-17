/**
 * Opt-in vector search latency benchmark (F-5).
 *
 * Seeds a disposable workspace/corpus, times keyword / semantic / hybrid
 * queries at increasing chunk counts, then deletes the workspace.
 *
 * Requires EVUKB_DATABASE_URL. Optional Qdrant when EVUKB_VECTOR_BACKEND=qdrant
 * and EVUKB_QDRANT_URL are set. See docs/VECTOR-TUNING.md.
 */
import { randomUUID } from 'node:crypto';

import { asCorpusId, asWorkspaceId } from '../packages/kb-core/dist/index.js';
import {
  ChunkRepository,
  CorpusRepository,
  createDb,
  migrateLatest,
  NodeRepository,
  resolveDatabaseUrl,
  WorkspaceRepository,
} from '../packages/kb-db/dist/index.js';
import {
  buildQdrantCollectionName,
  createQdrantVectorStore,
  QDRANT_DEFAULT_HNSW_EF_CONSTRUCT,
  QDRANT_DEFAULT_HNSW_M,
  type QdrantVectorStore,
} from '../packages/kb-server/dist/adapters/qdrant-vector-store.js';

type TimingStats = {
  p50Ms: number;
  p95Ms: number;
  hits: number;
};

function parseSizes(): number[] {
  if (process.env.EVUKB_BENCHMARK_QUICK === 'true') {
    return [200, 1000, 2000];
  }
  const raw = process.env.EVUKB_BENCHMARK_SIZES?.trim();
  if (!raw) {
    return [1000, 5000, 20_000];
  }
  const sizes = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (sizes.length === 0) {
    throw new Error('EVUKB_BENCHMARK_SIZES must list positive integers.');
  }
  return sizes;
}

/** pgvector column is vector(1536); other widths only work for the Qdrant path. */
const PGVECTOR_DIMENSIONS = 1536;

function parseDimensions(useQdrant: boolean): number {
  const raw = process.env.EVUKB_BENCHMARK_DIMENSIONS;
  if (!raw) {
    return PGVECTOR_DIMENSIONS;
  }
  const dims = Number.parseInt(raw, 10);
  if (!Number.isFinite(dims) || dims < 2) {
    throw new Error('EVUKB_BENCHMARK_DIMENSIONS must be an integer >= 2.');
  }
  if (!useQdrant && dims !== PGVECTOR_DIMENSIONS) {
    throw new Error(
      `pgvector knowledge_chunks.embedding is vector(${PGVECTOR_DIMENSIONS}); ` +
        `set EVUKB_BENCHMARK_DIMENSIONS=${PGVECTOR_DIMENSIONS} or use EVUKB_VECTOR_BACKEND=qdrant.`,
    );
  }
  return dims;
}

function parseIters(): number {
  const raw = process.env.EVUKB_BENCHMARK_ITERS;
  if (!raw) {
    return 7;
  }
  const iters = Number.parseInt(raw, 10);
  if (!Number.isFinite(iters) || iters < 1) {
    throw new Error('EVUKB_BENCHMARK_ITERS must be a positive integer.');
  }
  return iters;
}

function unitVector(dimensions: number, hotIndex: number): number[] {
  const vector = new Array(dimensions).fill(0);
  vector[hotIndex % dimensions] = 1;
  return vector;
}

function percentile(sortedMs: number[], fraction: number): number {
  if (sortedMs.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedMs.length - 1,
    Math.max(0, Math.ceil(fraction * sortedMs.length) - 1),
  );
  return sortedMs[index] ?? 0;
}

async function timeCalls(iters: number, run: () => Promise<number>): Promise<TimingStats> {
  const samples: number[] = [];
  let lastHits = 0;
  lastHits = await run();
  for (let i = 0; i < iters; i += 1) {
    const started = performance.now();
    lastHits = await run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return {
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    hits: lastHits,
  };
}

function formatStats(label: string, stats: TimingStats): string {
  return `${label.padEnd(12)} p50=${stats.p50Ms.toFixed(1)}ms  p95=${stats.p95Ms.toFixed(1)}ms  hits=${stats.hits}`;
}

async function seedChunks(input: {
  chunks: ChunkRepository;
  nodes: NodeRepository;
  qdrantStore?: QdrantVectorStore;
  workspaceId: string;
  corpusId: string;
  count: number;
  dimensions: number;
  startOrdinal: number;
}): Promise<void> {
  const batchSize = 100;
  let remaining = input.count;
  let batchIndex = 0;

  while (remaining > 0) {
    const size = Math.min(batchSize, remaining);
    const node = await input.nodes.create({
      workspaceId: input.workspaceId,
      corpusId: input.corpusId,
      path: 'bench',
      name: `batch-${input.startOrdinal + batchIndex}.md`,
      nodeType: 'file',
    });

    const batch = Array.from({ length: size }, (_, ordinal) => {
      const globalOrdinal = input.startOrdinal + batchIndex * batchSize + ordinal;
      const body = `benchmark chunk ${globalOrdinal} topic-${globalOrdinal % 50}`;
      return {
        workspaceId: input.workspaceId,
        corpusId: input.corpusId,
        nodeId: node.id,
        ordinal,
        filePath: `bench/batch-${input.startOrdinal + batchIndex}.md`,
        folderPath: 'bench',
        headingPath: [] as string[],
        body,
        bodyPreview: body.slice(0, 80),
        tokenCount: 8,
        embedding: unitVector(input.dimensions, globalOrdinal),
      };
    });

    const stored = await input.chunks.replaceForNode(
      input.workspaceId,
      input.corpusId,
      node.id,
      batch,
    );

    if (input.qdrantStore) {
      await input.qdrantStore.upsertChunks({
        workspaceId: asWorkspaceId(input.workspaceId),
        corpusId: asCorpusId(input.corpusId),
        chunks: stored.map((chunk, index) => ({
          chunkId: chunk.id,
          nodeId: chunk.nodeId,
          embedding: batch[index]?.embedding ?? unitVector(input.dimensions, index),
          filePath: chunk.filePath,
        })),
      });
    }

    remaining -= size;
    batchIndex += 1;
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.EVUKB_DATABASE_URL;
  if (!databaseUrl) {
    console.error('benchmark-vector-search requires EVUKB_DATABASE_URL.');
    console.error('See docs/VECTOR-TUNING.md');
    process.exit(1);
  }

  const sizes = parseSizes();
  const iters = parseIters();
  const useQdrant =
    process.env.EVUKB_VECTOR_BACKEND === 'qdrant' && Boolean(process.env.EVUKB_QDRANT_URL);
  const qdrantUrl = process.env.EVUKB_QDRANT_URL;
  const dimensions = parseDimensions(useQdrant);

  console.info('EvuKB vector search benchmark');
  console.info(
    `sizes=${sizes.join(',')} dimensions=${dimensions} iters=${iters} backend=${useQdrant ? 'qdrant' : 'pgvector'}`,
  );

  const handle = createDb({ connectionString: resolveDatabaseUrl() });
  await migrateLatest(handle);

  const workspaces = new WorkspaceRepository(handle);
  const corpora = new CorpusRepository(handle);
  const nodes = new NodeRepository(handle);
  const chunks = new ChunkRepository(handle);

  const suffix = randomUUID().slice(0, 8);
  const workspace = await workspaces.create({
    slug: `bench-vector-${suffix}`,
    name: `Vector Bench ${suffix}`,
  });
  const corpus = await corpora.create({
    workspaceId: workspace.id,
    name: `Vector Bench Corpus ${suffix}`,
  });

  let qdrantStore: QdrantVectorStore | undefined;
  let collectionName: string | undefined;

  if (useQdrant && qdrantUrl) {
    const embeddingModel = `benchmark_${suffix}`;
    collectionName = buildQdrantCollectionName(embeddingModel, dimensions);
    qdrantStore = createQdrantVectorStore({
      chunks,
      qdrantUrl,
      embeddingModel,
      dimensions,
    });
    console.info(
      `Qdrant collection ${collectionName} (m=${QDRANT_DEFAULT_HNSW_M}, ef_construct=${QDRANT_DEFAULT_HNSW_EF_CONSTRUCT})`,
    );
  }

  try {
    let seeded = 0;
    for (const target of sizes) {
      const toAdd = target - seeded;
      if (toAdd > 0) {
        const seedStarted = performance.now();
        await seedChunks({
          chunks,
          nodes,
          ...(qdrantStore ? { qdrantStore } : {}),
          workspaceId: workspace.id,
          corpusId: corpus.id,
          count: toAdd,
          dimensions,
          startOrdinal: seeded,
        });
        console.info(
          `seeded to ${target} chunks in ${(performance.now() - seedStarted).toFixed(0)}ms`,
        );
        seeded = target;
      }

      const queryText = 'topic-7 benchmark chunk';
      const queryEmbedding = unitVector(dimensions, 7);

      const keyword = await timeCalls(iters, async () => {
        const hits = await chunks.searchKeyword(workspace.id, corpus.id, queryText, {
          limit: 20,
        });
        return hits.length;
      });

      const semantic = await timeCalls(iters, async () => {
        if (qdrantStore) {
          const hits = await qdrantStore.search({
            workspaceId: asWorkspaceId(workspace.id),
            corpusIds: [asCorpusId(corpus.id)],
            queryEmbedding,
            limit: 20,
          });
          return hits.length;
        }
        const hits = await chunks.searchSemantic(workspace.id, corpus.id, queryEmbedding, {
          limit: 20,
        });
        return hits.length;
      });

      const hybrid = await timeCalls(iters, async () => {
        const keywordHits = await chunks.searchKeyword(workspace.id, corpus.id, queryText, {
          limit: 20,
        });
        if (qdrantStore) {
          const semanticHits = await qdrantStore.search({
            workspaceId: asWorkspaceId(workspace.id),
            corpusIds: [asCorpusId(corpus.id)],
            queryEmbedding,
            limit: 20,
          });
          return new Set([
            ...keywordHits.map((hit) => hit.id),
            ...semanticHits.map((hit) => hit.chunkId),
          ]).size;
        }
        const semanticHits = await chunks.searchSemantic(workspace.id, corpus.id, queryEmbedding, {
          limit: 20,
        });
        return new Set([...keywordHits.map((hit) => hit.id), ...semanticHits.map((hit) => hit.id)])
          .size;
      });

      console.info(`--- N=${target} ---`);
      console.info(formatStats('keyword', keyword));
      console.info(formatStats('semantic', semantic));
      console.info(formatStats('hybrid', hybrid));
    }
  } finally {
    await workspaces.delete(workspace.id);
    if (useQdrant && qdrantUrl && collectionName) {
      await fetch(`${qdrantUrl.replace(/\/$/, '')}/collections/${collectionName}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }
    await handle.pool.end();
  }

  console.info('benchmark-vector-search: done (workspace cleaned up)');
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.cause instanceof Error) {
      console.error(error.cause.message);
    }
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
