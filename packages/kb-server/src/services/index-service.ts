import {
  asCorpusId,
  asWorkspaceId,
  type BlobStore,
  buildFilePath,
  buildMarkdownPathToNodeIdMap,
  createBlobRef,
  type EmbeddingProvider,
  type IndexNodeResult,
  type IndexStatus,
  isMarkdownNode,
  mergeOkfNodeMetadata,
  needingAttentionIndexStatuses,
  type ParsedMarkdownDocument,
  parseAiProviderSettings,
  parseMarkdownDocument,
  prependFrontmatterSummaryChunk,
  resolveEmbeddingChunkingStrategyFromSettings,
  resolveIndexFrontmatterSummary,
  resolveMaxChunkTokensFromSettings,
  targetPathCandidates,
  type VectorStore,
  validateOkfMarkdown,
} from '@evu/kb-core';
import type {
  ChunkRepository,
  CorpusRepository,
  LinkRepository,
  NodeRepository,
  UsageRecordRepository,
  WorkspaceRepository,
} from '@evu/kb-db';
import { EmbeddingRequestError } from '../adapters/openai-embedding.js';
import { toVectorChunkInputs } from '../adapters/qdrant-vector-store.js';
import type { VectorBackend } from '../adapters/resolve-vector-store.js';
import { resolveEmbeddingProviderForWorkspace } from '../adapters/workspace-providers.js';

import { ApiError } from '../errors.js';
import type { CorpusIndexEventHub } from './corpus-index-event-hub.js';
import {
  reconcileCorpusLinkResolution,
  resolveParsedLinksForIndex,
} from './corpus-stats-service.js';

export type IndexServiceDeps = {
  blobStore: BlobStore;
  chunks: ChunkRepository;
  corpora: CorpusRepository;
  embeddingProvider?: EmbeddingProvider | null;
  indexEventHub?: CorpusIndexEventHub;
  links: LinkRepository;
  nodes: NodeRepository;
  vectorBackend?: VectorBackend;
  vectorStore: VectorStore;
  workspaces: WorkspaceRepository;
  usageRecords?: UsageRecordRepository;
};

function isIndexableMarkdown(name: string, mimeType: string | null): boolean {
  if (name.toLowerCase().endsWith('.md')) {
    return true;
  }
  return mimeType === 'text/markdown' || mimeType === 'text/x-markdown';
}

function parseEmbeddingTokenLimitMessage(message: string): number | null {
  const match = /input \((\d+) tokens?\) is too large/i.exec(message);
  if (!match?.[1]) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function buildEmbeddingIndexError(
  error: EmbeddingRequestError,
  context: {
    filePath: string;
    parsed: ParsedMarkdownDocument;
    chunkingStrategy: string;
    maxChunkTokens: number;
  },
): string {
  const { filePath, parsed, chunkingStrategy, maxChunkTokens } = context;
  const largest = parsed.chunks.reduce(
    (current, chunk) => (chunk.tokenCount > current.tokenCount ? chunk : current),
    parsed.chunks[0] ?? { tokenCount: 0, body: '' },
  );
  const parsedLimit = parseEmbeddingTokenLimitMessage(error.message);
  const lines = [
    error.message,
    `File: ${filePath}`,
    `Chunks: ${parsed.chunks.length}, largest ~${largest.tokenCount} tokens (${largest.body.length} chars)`,
    `Chunking: ${chunkingStrategy}${
      chunkingStrategy === 'headings_subsplit_capped' ? `, max ${maxChunkTokens}` : ''
    }`,
  ];
  if (parsedLimit !== null) {
    lines.push(`Provider rejected input of ${parsedLimit} tokens.`);
  }
  if (chunkingStrategy !== 'headings_subsplit_capped') {
    lines.push(
      'Hint: enable "Headings + natural splits (size limit)" and set max below your embedding server -ub batch size, then reindex.',
    );
  } else {
    lines.push(
      'Hint: lower max chunk size below your embedding server -ub batch size, then reindex.',
    );
  }
  return lines.join(' ');
}

export class IndexService {
  readonly #blobStore: BlobStore;
  readonly #chunks: ChunkRepository;
  readonly #corpora: CorpusRepository;
  readonly #defaultEmbeddingProvider: EmbeddingProvider | null;
  readonly #indexEventHub: CorpusIndexEventHub | undefined;
  readonly #links: LinkRepository;
  readonly #nodes: NodeRepository;
  readonly #vectorBackend: VectorBackend;
  readonly #vectorStore: VectorStore;
  readonly #workspaces: WorkspaceRepository;
  readonly #usageRecords: UsageRecordRepository | undefined;

  constructor(deps: IndexServiceDeps) {
    this.#blobStore = deps.blobStore;
    this.#chunks = deps.chunks;
    this.#corpora = deps.corpora;
    this.#defaultEmbeddingProvider = deps.embeddingProvider ?? null;
    this.#indexEventHub = deps.indexEventHub;
    this.#links = deps.links;
    this.#nodes = deps.nodes;
    this.#vectorBackend = deps.vectorBackend ?? 'pgvector';
    this.#vectorStore = deps.vectorStore;
    this.#workspaces = deps.workspaces;
    this.#usageRecords = deps.usageRecords;
  }

  async #resolveEmbeddingProvider(workspaceId: string): Promise<EmbeddingProvider | null> {
    const workspace = await this.#workspaces.getById(workspaceId);
    const settings = workspace?.settings ?? {};
    return resolveEmbeddingProviderForWorkspace(settings, this.#defaultEmbeddingProvider);
  }

  #publishNodeStatus(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    indexStatus: IndexStatus,
    previousIndexStatus?: IndexStatus,
  ): void {
    this.#indexEventHub?.publish(workspaceId, corpusId, {
      nodeId,
      indexStatus,
      ...(previousIndexStatus !== undefined ? { previousIndexStatus } : {}),
    });
  }

  async indexNode(workspaceId: string, corpusId: string, nodeId: string): Promise<IndexNodeResult> {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }

    const node = await this.#nodes.getById(workspaceId, corpusId, nodeId);
    if (!node) {
      throw ApiError.nodeNotFound(nodeId);
    }

    if (node.nodeType !== 'file') {
      throw ApiError.validation('Only file nodes can be indexed.');
    }

    if (!isIndexableMarkdown(node.name, node.mimeType)) {
      const previousIndexStatus = node.indexStatus as IndexStatus;
      await this.#nodes.updateIndexStatus(workspaceId, corpusId, nodeId, {
        indexStatus: 'failed',
        metadata: {
          ...node.metadata,
          indexError: 'Only markdown files are indexed in v1.',
        },
      });
      this.#publishNodeStatus(workspaceId, corpusId, nodeId, 'failed', previousIndexStatus);
      throw ApiError.validation('Only markdown files are indexed in v1.');
    }

    if (!node.storageRelPath) {
      throw ApiError.validation('Managed file storage path is missing.');
    }

    const previousIndexStatus = node.indexStatus as IndexStatus;
    await this.#nodes.updateIndexStatus(workspaceId, corpusId, nodeId, {
      indexStatus: 'indexing',
      metadata: node.metadata,
    });
    this.#publishNodeStatus(workspaceId, corpusId, nodeId, 'indexing', previousIndexStatus);

    const filePath = buildFilePath(node.path, node.name);
    const workspace = await this.#workspaces.getById(workspaceId);
    const settings = workspace?.settings ?? {};
    const chunkingStrategy = resolveEmbeddingChunkingStrategyFromSettings(settings, process.env);
    const maxChunkTokens = resolveMaxChunkTokensFromSettings(settings, process.env);

    try {
      const blobRef = createBlobRef(
        asWorkspaceId(workspaceId),
        asCorpusId(corpusId),
        node.storageRelPath,
      );
      const stream = await this.#blobStore.get(blobRef);
      const content = await streamToBuffer(stream);
      const source = content.toString('utf8');
      const parsed = parseMarkdownDocument(source, {
        chunking: {
          strategy: chunkingStrategy.value,
          maxChunkTokens: maxChunkTokens.value,
        },
      });
      const indexChunks = resolveIndexFrontmatterSummary(process.env)
        ? prependFrontmatterSummaryChunk(parsed.chunks, parsed.frontmatter.parsed)
        : parsed.chunks;
      const folderPath = node.path;
      const warnings = parsed.frontmatter.errors.map((error) => error.message);
      const okfMetadata = validateOkfMarkdown(corpus.settings, node.name, parsed.frontmatter);
      const indexMetadata = mergeOkfNodeMetadata(node.metadata, okfMetadata, warnings);

      let embeddings: Array<number[] | null> = [];
      const embeddingProvider = await this.#resolveEmbeddingProvider(workspaceId);
      let embedLatencyMs = 0;
      if (embeddingProvider) {
        const embedStartedAt = Date.now();
        try {
          embeddings = await embeddingProvider.embed(indexChunks.map((chunk) => chunk.body));
        } catch (embedError) {
          if (embedError instanceof EmbeddingRequestError) {
            throw new Error(
              buildEmbeddingIndexError(embedError, {
                filePath,
                parsed,
                chunkingStrategy: chunkingStrategy.value,
                maxChunkTokens: maxChunkTokens.value,
              }),
            );
          }
          throw embedError;
        }
        embedLatencyMs = Date.now() - embedStartedAt;
      } else {
        embeddings = indexChunks.map(() => null);
      }

      if (embeddingProvider && this.#usageRecords) {
        const providerOverride = parseAiProviderSettings(settings).embedding;
        await this.#usageRecords.create({
          workspaceId,
          corpusId,
          nodeId,
          operationType: 'embed',
          provider: process.env.EVUKB_EMBEDDING_PROVIDER?.trim() || 'openai-compatible',
          model: providerOverride?.model ?? embeddingProvider.model,
          inputTokens: indexChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
          characterCount: indexChunks.reduce((sum, chunk) => sum + chunk.body.length, 0),
          chunkCount: indexChunks.length,
          requestCount: 1,
          latencyMs: embedLatencyMs,
        });
      }

      const previousChunkIds = await this.#chunks.listIdsByNode(workspaceId, corpusId, nodeId);
      const storeEmbeddingsInPostgres = this.#vectorBackend === 'pgvector';

      const storedChunks = await this.#chunks.replaceForNode(
        workspaceId,
        corpusId,
        nodeId,
        indexChunks.map((chunk, index) => ({
          workspaceId,
          corpusId,
          nodeId,
          ordinal: chunk.ordinal,
          filePath,
          folderPath,
          headingPath: chunk.headingPath,
          body: chunk.body,
          bodyPreview: chunk.bodyPreview,
          tokenCount: chunk.tokenCount,
          embedding: storeEmbeddingsInPostgres ? (embeddings[index] ?? null) : null,
          metadata: {
            parserVersion: parsed.parserVersion,
            chunkerVersion: parsed.chunkerVersion,
          },
        })),
      );

      if (previousChunkIds.length > 0) {
        await this.#vectorStore.deleteChunks({
          workspaceId: asWorkspaceId(workspaceId),
          corpusId: asCorpusId(corpusId),
          chunkIds: previousChunkIds,
        });
      }

      if (this.#vectorBackend === 'qdrant') {
        const vectorChunks = toVectorChunkInputs(storedChunks, embeddings);
        if (vectorChunks.length > 0) {
          await this.#vectorStore.upsertChunks({
            workspaceId: asWorkspaceId(workspaceId),
            corpusId: asCorpusId(corpusId),
            chunks: vectorChunks,
          });
        }
      }

      const storedLinks = await this.#links.replaceForNode(
        workspaceId,
        corpusId,
        nodeId,
        resolveParsedLinksForIndex(
          parsed.links,
          buildMarkdownPathToNodeIdMap(
            (await this.#nodes.listByCorpus(workspaceId, corpusId)).filter(isMarkdownNode),
          ),
          workspaceId,
          corpusId,
          nodeId,
        ),
      );

      await this.#links.resolveIncomingTargets(
        workspaceId,
        corpusId,
        targetPathCandidates(filePath),
        nodeId,
      );

      await this.#nodes.updateIndexStatus(workspaceId, corpusId, nodeId, {
        indexStatus: 'indexed',
        indexedAt: new Date().toISOString(),
        metadata: {
          ...indexMetadata,
          parserVersion: parsed.parserVersion,
          chunkerVersion: parsed.chunkerVersion,
          frontmatter: parsed.frontmatter.parsed,
        },
      });
      this.#publishNodeStatus(workspaceId, corpusId, nodeId, 'indexed', 'indexing');

      await this.#refreshCorpusStats(workspaceId, corpusId);

      const allWarnings = (indexMetadata.indexWarnings as string[] | undefined) ?? warnings;

      return {
        nodeId,
        chunkCount: storedChunks.length,
        linkCount: storedLinks.length,
        indexStatus: 'indexed',
        warnings: allWarnings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Indexing failed.';
      await this.#nodes.updateIndexStatus(workspaceId, corpusId, nodeId, {
        indexStatus: 'failed',
        metadata: {
          ...node.metadata,
          indexError: message,
        },
      });
      this.#publishNodeStatus(workspaceId, corpusId, nodeId, 'failed', 'indexing');
      throw error;
    }
  }

  async indexNodes(
    workspaceId: string,
    corpusId: string,
    nodeIds: string[],
  ): Promise<IndexNodeResult[]> {
    const results: IndexNodeResult[] = [];
    for (const nodeId of nodeIds) {
      results.push(await this.indexNode(workspaceId, corpusId, nodeId));
    }
    return results;
  }

  async reindexCorpus(workspaceId: string, corpusId: string): Promise<IndexNodeResult[]> {
    const nodes = await this.#nodes.listIndexableFilesByCorpus(workspaceId, corpusId);
    const results = await this.indexNodes(
      workspaceId,
      corpusId,
      nodes.map((node) => node.id),
    );
    await reconcileCorpusLinkResolution(this.#links, this.#nodes, workspaceId, corpusId);
    return results;
  }

  async reindexNeedingAttention(workspaceId: string, corpusId: string): Promise<IndexNodeResult[]> {
    const nodes = await this.#nodes.listIndexableFilesByCorpus(workspaceId, corpusId);
    const nodeIds = nodes
      .filter((node) =>
        needingAttentionIndexStatuses.includes(
          node.indexStatus as (typeof needingAttentionIndexStatuses)[number],
        ),
      )
      .map((node) => node.id);

    if (nodeIds.length === 0) {
      return [];
    }

    const results = await this.indexNodes(workspaceId, corpusId, nodeIds);
    await reconcileCorpusLinkResolution(this.#links, this.#nodes, workspaceId, corpusId);
    return results;
  }

  async #refreshCorpusStats(workspaceId: string, corpusId: string): Promise<void> {
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const fileCount = nodes.filter((node) => node.nodeType === 'file').length;
    const totalBytes = nodes
      .filter((node) => node.nodeType === 'file')
      .reduce((sum, node) => sum + node.sizeBytes, 0);
    const chunkCount = await this.#chunks.countByCorpus(workspaceId, corpusId);
    await this.#corpora.refreshStats(workspaceId, corpusId, {
      fileCount,
      chunkCount,
      totalBytes,
    });
  }
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
