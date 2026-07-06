import {
  allowsMetadataOnlySearch,
  asChunkId,
  asCorpusId,
  asNodeId,
  asWorkspaceId,
  type ChatCompletionUsage,
  type ChatProvider,
  defaultLlmRerankCandidateLimit,
  defaultRankingStrategyId,
  defaultRankingStrategyRegistry,
  type EmbeddingProvider,
  filtersNeedSqlJoin,
  formatFrontmatterPreview,
  hasKnowledgeFilters,
  isOkfCitationChunkContent,
  matchesDocumentPathPrefix,
  maxMultiCorpora,
  nodeMatchesKnowledgeFilters,
  nodeRelativeFilePath,
  normalizeSearchQuery,
  type OperationUsage,
  parseAiProviderSettings,
  type RankingStrategy,
  type RankingStrategyRegistry,
  rerankerLlmStrategyId,
  resolveEffectiveRankingSettings,
  resolveIncludeAgentNotesInRetrieval,
  resolveNodeTitleFromMetadata,
  resolveRankingStrategyIdSetting,
  type SearchRequest,
  type SearchResult,
  semanticOnlyStrategyId,
  shouldIncludePathInRetrieval,
  type VectorStore,
} from '@evu/kb-core';
import type {
  ChunkRepository,
  CorpusRepository,
  NodeRepository,
  UsageRecordRepository,
  WorkspaceRepository,
} from '@evu/kb-db';

import { resolveChatProviderForWorkspace } from '../adapters/workspace-providers.js';
import { ApiError } from '../errors.js';
import {
  defaultPostRankHandlerRegistry,
  type PostRankHandlerRegistry,
} from '../search/post-rank-registry.js';

export type SearchServiceDeps = {
  chunks: ChunkRepository;
  corpora: CorpusRepository;
  nodes: NodeRepository;
  workspaces: WorkspaceRepository;
  embeddingProvider?: EmbeddingProvider | null;
  chatProvider?: ChatProvider | null;
  usageRecords?: UsageRecordRepository;
  vectorStore: VectorStore;
  rankingRegistry?: RankingStrategyRegistry;
  postRankHandlers?: PostRankHandlerRegistry;
};

type ChunkSearchHit = {
  id: string;
  nodeId: string;
  filePath: string;
  headingPath: string[];
  body: string;
  indexedAt: string;
  keywordRank?: number;
  keywordScore?: number;
  semanticRank?: number;
  semanticScore?: number;
};

export class SearchService {
  readonly #chunks: ChunkRepository;
  readonly #corpora: CorpusRepository;
  readonly #nodes: NodeRepository;
  readonly #workspaces: WorkspaceRepository;
  readonly #embeddingProvider: EmbeddingProvider | null;
  readonly #defaultChatProvider: ChatProvider | null;
  readonly #usageRecords: UsageRecordRepository | undefined;
  readonly #vectorStore: VectorStore;
  readonly #rankingRegistry: RankingStrategyRegistry;
  readonly #postRankHandlers: PostRankHandlerRegistry;

  constructor(deps: SearchServiceDeps) {
    this.#chunks = deps.chunks;
    this.#corpora = deps.corpora;
    this.#nodes = deps.nodes;
    this.#workspaces = deps.workspaces;
    this.#embeddingProvider = deps.embeddingProvider ?? null;
    this.#defaultChatProvider = deps.chatProvider ?? null;
    this.#usageRecords = deps.usageRecords;
    this.#vectorStore = deps.vectorStore;
    this.#rankingRegistry = deps.rankingRegistry ?? defaultRankingStrategyRegistry;
    this.#postRankHandlers = deps.postRankHandlers ?? defaultPostRankHandlerRegistry;
  }

  async #resolveChatProvider(workspaceId: string): Promise<ChatProvider | null> {
    const workspace = await this.#workspaces.getById(workspaceId);
    const settings = workspace?.settings ?? {};
    return (
      resolveChatProviderForWorkspace(settings, this.#defaultChatProvider) ??
      this.#defaultChatProvider
    );
  }

  async #recordRerankUsage(
    workspaceId: string,
    corpusId: string,
    chatProvider: ChatProvider,
    usage?: ChatCompletionUsage,
  ): Promise<OperationUsage | undefined> {
    if (!usage) {
      return undefined;
    }

    const workspace = await this.#workspaces.getById(workspaceId);
    const providerOverride = parseAiProviderSettings(workspace?.settings ?? {}).chat;
    const operationUsage: OperationUsage = {
      provider: process.env.EVUKB_CHAT_PROVIDER?.trim() || 'openai-compatible',
      model: providerOverride?.model ?? chatProvider.model,
      operationType: 'rerank',
      requestCount: 1,
      latencyMs: usage.latencyMs ?? 0,
      ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
      ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    };

    if (this.#usageRecords) {
      await this.#usageRecords.create({
        workspaceId,
        corpusId,
        ...operationUsage,
      });
    }

    return operationUsage;
  }

  async search(
    workspaceId: string,
    corpusId: string,
    request: SearchRequest,
  ): Promise<SearchResult[]> {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }

    const workspace = await this.#workspaces.getById(workspaceId);
    const rankingWeights = resolveEffectiveRankingSettings({
      workspaceSettings: workspace?.settings ?? {},
      corpusSettings: corpus.settings,
      ...(request.rankingSettings !== undefined
        ? { requestOverride: request.rankingSettings }
        : {}),
    });

    const { value: strategyId } = resolveRankingStrategyIdSetting(
      {
        requestStrategyId: request.rankingStrategyId,
        corpusStrategyId: corpus.rankingStrategyId,
        workspaceSettings: workspace?.settings ?? {},
        envStrategyId: process.env.EVUKB_RANKING_STRATEGY,
      },
      defaultRankingStrategyId,
    );
    let rankingStrategy: RankingStrategy;
    try {
      rankingStrategy = this.#rankingRegistry.resolve(strategyId);
    } catch {
      throw ApiError.validation(`Unknown ranking strategy: ${strategyId}`);
    }

    if (rankingStrategy.retrieval.semantic && !this.#embeddingProvider) {
      if (strategyId === semanticOnlyStrategyId) {
        throw ApiError.validation('semantic_only requires a configured embedding provider.');
      }
    }

    if (rankingStrategy.postRank) {
      const chatProvider = await this.#resolveChatProvider(workspaceId);
      if (rankingStrategy.postRank === 'llm' && !chatProvider) {
        throw ApiError.validation(`${rerankerLlmStrategyId} requires a configured chat provider.`);
      }
    }

    const limit = request.limit ?? 20;
    const includeAgentNotesInRetrieval = resolveIncludeAgentNotesInRetrieval(
      workspace?.settings ?? {},
      corpus.settings,
    );
    const query = normalizeSearchQuery(request.query);
    if (!query && !allowsMetadataOnlySearch(request)) {
      throw ApiError.validation(
        'Search query is required unless filters or pathPrefix scope the request.',
      );
    }

    if (!query && allowsMetadataOnlySearch(request)) {
      return this.#searchMetadataOnly(
        workspaceId,
        corpusId,
        request,
        limit,
        includeAgentNotesInRetrieval,
      );
    }

    const pathPrefix = request.pathPrefix;
    const filters = request.filters;
    const filterMultiplier =
      hasKnowledgeFilters(filters) && filtersNeedSqlJoin(filters) && filters?.fileTypes?.length
        ? 3
        : hasKnowledgeFilters(filters)
          ? 2
          : 1;
    const candidateLimit = Math.min(limit * filterMultiplier, 100);

    let keywordHits: Awaited<ReturnType<ChunkRepository['searchKeyword']>> = [];
    if (rankingStrategy.retrieval.keyword) {
      keywordHits = await this.#chunks.searchKeyword(workspaceId, corpusId, query, {
        ...(pathPrefix ? { pathPrefix } : {}),
        ...(filters !== undefined ? { filters } : {}),
        limit: candidateLimit,
      });
    }

    let semanticHits: ChunkSearchHit[] = [];
    if (rankingStrategy.retrieval.semantic && this.#embeddingProvider) {
      const [embedding] = await this.#embeddingProvider.embed([query]);
      if (embedding && embedding.length > 0) {
        const vectorHits = await this.#vectorStore.search({
          workspaceId: asWorkspaceId(workspaceId),
          corpusIds: [asCorpusId(corpusId)],
          queryEmbedding: embedding,
          limit: candidateLimit,
          ...(pathPrefix ? { pathPrefix } : {}),
        });

        if (vectorHits.length > 0) {
          const chunkRecords = await this.#chunks.listByIds(
            workspaceId,
            corpusId,
            vectorHits.map((hit) => hit.chunkId),
          );
          const chunkById = new Map(chunkRecords.map((chunk) => [chunk.id, chunk]));
          semanticHits = vectorHits.flatMap((hit, index) => {
            const chunk = chunkById.get(asChunkId(hit.chunkId));
            if (!chunk) {
              return [];
            }
            return [
              {
                id: chunk.id,
                nodeId: chunk.nodeId,
                filePath: chunk.filePath,
                headingPath: chunk.headingPath,
                body: chunk.body,
                indexedAt: chunk.indexedAt,
                semanticRank: index + 1,
                semanticScore: hit.score,
              } satisfies ChunkSearchHit,
            ];
          });
        }
      }
    }

    const mergedHits = this.#mergeChunkHits(keywordHits, semanticHits);
    const nodeIds = [...new Set(mergedHits.map((hit) => hit.nodeId))];
    const nodes = await this.#nodes.listByIds(workspaceId, corpusId, nodeIds);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const filteredHits = mergedHits.filter((hit) => {
      const node = nodeById.get(asNodeId(hit.nodeId));
      if (!node) {
        return false;
      }
      if (!shouldIncludePathInRetrieval(hit.filePath, includeAgentNotesInRetrieval)) {
        return false;
      }
      return nodeMatchesKnowledgeFilters(node, filters, hit.filePath);
    });

    const candidates = filteredHits.map((hit) => {
      const node = nodeById.get(asNodeId(hit.nodeId));
      const nodeTitle = node ? resolveNodeTitleFromMetadata(node.metadata) : null;
      return {
        chunkId: hit.id,
        filePath: hit.filePath,
        headingPath: hit.headingPath,
        indexedAt: hit.indexedAt,
        ...(nodeTitle ? { nodeTitle } : {}),
        isOkfCitationSection: isOkfCitationChunkContent(hit.headingPath, hit.body),
        query,
        ...(hit.keywordRank !== undefined ? { keywordRank: hit.keywordRank } : {}),
        ...(hit.keywordScore !== undefined ? { keywordScore: hit.keywordScore } : {}),
        ...(hit.semanticRank !== undefined ? { semanticRank: hit.semanticRank } : {}),
        ...(hit.semanticScore !== undefined ? { semanticScore: hit.semanticScore } : {}),
      };
    });

    const hybridRanked = rankingStrategy.rank(candidates, {
      keywordWeight: rankingWeights.keywordWeight,
      semanticWeight: rankingWeights.semanticWeight,
      ...(rankingWeights.pathBoosts ? { pathBoosts: rankingWeights.pathBoosts } : {}),
      ...(rankingWeights.recencyBoost !== undefined
        ? { recencyBoost: rankingWeights.recencyBoost }
        : {}),
      ...(rankingWeights.okfCitationBoost !== undefined
        ? { okfCitationBoost: rankingWeights.okfCitationBoost }
        : {}),
      ...(rankingWeights.exactTitleBoost !== undefined
        ? { exactTitleBoost: rankingWeights.exactTitleBoost }
        : {}),
    });

    let ranked = hybridRanked;
    let rerankOperationUsage: OperationUsage | undefined;
    if (rankingStrategy.postRank) {
      const chatProvider = await this.#resolveChatProvider(workspaceId);
      const previewByChunkId = new Map(filteredHits.map((hit) => [hit.id, hit.body.slice(0, 400)]));
      const filePathByChunkId = new Map(filteredHits.map((hit) => [hit.id, hit.filePath]));
      try {
        const handler = this.#postRankHandlers.resolve(rankingStrategy.postRank);
        const postRankResult = await handler({
          workspaceId,
          corpusId,
          query,
          hits: hybridRanked.slice(0, defaultLlmRerankCandidateLimit),
          previews: previewByChunkId,
          filePaths: filePathByChunkId,
          chatProvider,
        });
        ranked = postRankResult.hits;
        if (postRankResult.usage && chatProvider) {
          rerankOperationUsage = await this.#recordRerankUsage(
            workspaceId,
            corpusId,
            chatProvider,
            postRankResult.usage,
          );
        }
      } catch (error) {
        throw ApiError.validation(
          error instanceof Error ? error.message : 'Post-rank handler failed.',
        );
      }
    }

    ranked = ranked.slice(0, limit);
    if (ranked.length === 0) {
      return [];
    }

    const chunkRecords = await this.#chunks.listByIds(
      workspaceId,
      corpusId,
      ranked.map((hit) => hit.chunkId),
    );
    const chunkById = new Map(chunkRecords.map((chunk) => [chunk.id, chunk]));

    return ranked.flatMap((hit) => {
      const chunk = chunkById.get(asChunkId(hit.chunkId));
      if (!chunk) {
        return [];
      }
      return [
        {
          chunkId: chunk.id,
          nodeId: chunk.nodeId,
          corpusId: asCorpusId(corpusId),
          workspaceId: asWorkspaceId(workspaceId),
          filePath: chunk.filePath,
          headingPath: chunk.headingPath,
          bodyPreview: chunk.bodyPreview,
          score: hit.score,
          matchKind: hit.matchKind,
          citation: {
            citationId: chunk.id,
            corpusId: asCorpusId(corpusId),
            nodeId: asNodeId(chunk.nodeId),
            chunkId: asChunkId(chunk.id),
            filePath: chunk.filePath,
            headingPath: chunk.headingPath,
            sourceType: 'chunk',
          },
          ranking: {
            strategyId: rankingStrategy.id,
            strategyVersion: rankingStrategy.version,
            componentScores: hit.componentScores,
            ...(rerankOperationUsage ? { operationUsage: rerankOperationUsage } : {}),
          },
        } satisfies SearchResult,
      ];
    });
  }

  async searchAcrossCorpora(
    workspaceId: string,
    corpusIds: string[],
    request: SearchRequest,
  ): Promise<SearchResult[]> {
    const uniqueCorpusIds = [...new Set(corpusIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueCorpusIds.length === 0) {
      throw ApiError.validation('At least one corpusId is required.');
    }
    if (uniqueCorpusIds.length > maxMultiCorpora) {
      throw ApiError.validation(`At most ${maxMultiCorpora} corpora are allowed per request.`);
    }

    for (const corpusId of uniqueCorpusIds) {
      const corpus = await this.#corpora.getById(workspaceId, corpusId);
      if (!corpus) {
        throw ApiError.corpusNotFound(corpusId);
      }
    }

    const limit = request.limit ?? 20;
    const perCorpusLimit = Math.max(limit, 20);
    const merged: SearchResult[] = [];

    for (const corpusId of uniqueCorpusIds) {
      const hits = await this.search(workspaceId, corpusId, {
        ...request,
        limit: perCorpusLimit,
      });
      merged.push(...hits);
    }

    merged.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const corpusCompare = String(left.corpusId).localeCompare(String(right.corpusId));
      if (corpusCompare !== 0) {
        return corpusCompare;
      }
      return String(left.chunkId).localeCompare(String(right.chunkId));
    });

    return merged.slice(0, limit);
  }

  async #searchMetadataOnly(
    workspaceId: string,
    corpusId: string,
    request: SearchRequest,
    limit: number,
    includeAgentNotesInRetrieval = true,
  ): Promise<SearchResult[]> {
    const filters = request.filters;
    const pathPrefix = request.pathPrefix;
    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    const matchingNodes = nodes
      .filter((node) => node.nodeType === 'file')
      .filter((node) => {
        const filePath = nodeRelativeFilePath(node);
        if (!shouldIncludePathInRetrieval(filePath, includeAgentNotesInRetrieval)) {
          return false;
        }
        return (
          matchesDocumentPathPrefix(filePath, pathPrefix) &&
          nodeMatchesKnowledgeFilters(node, filters, filePath)
        );
      })
      .sort((left, right) => nodeRelativeFilePath(left).localeCompare(nodeRelativeFilePath(right)))
      .slice(0, limit);

    const results: SearchResult[] = [];
    for (const node of matchingNodes) {
      const filePath = nodeRelativeFilePath(node);
      const chunkIds = await this.#chunks.listIdsByNode(workspaceId, corpusId, node.id);
      const frontmatterPreview = formatFrontmatterPreview(node.metadata);
      if (chunkIds.length > 0) {
        const firstChunkId = chunkIds[0];
        if (firstChunkId) {
          const chunk = await this.#chunks.getById(workspaceId, corpusId, firstChunkId);
          if (chunk) {
            const bodyPreview =
              frontmatterPreview && !chunk.bodyPreview.toLowerCase().includes('frontmatter:')
                ? `${frontmatterPreview}\n${chunk.bodyPreview}`
                : chunk.bodyPreview || frontmatterPreview;
            results.push({
              chunkId: chunk.id,
              nodeId: chunk.nodeId,
              corpusId: asCorpusId(corpusId),
              workspaceId: asWorkspaceId(workspaceId),
              filePath: chunk.filePath,
              headingPath: chunk.headingPath,
              bodyPreview,
              score: 1,
              matchKind: 'metadata',
              citation: {
                citationId: chunk.id,
                corpusId: asCorpusId(corpusId),
                nodeId: asNodeId(chunk.nodeId),
                chunkId: asChunkId(chunk.id),
                filePath: chunk.filePath,
                headingPath: chunk.headingPath,
                sourceType: 'chunk',
              },
              ranking: {
                strategyId: 'metadata_only_v1',
                strategyVersion: '1',
                componentScores: { metadataMatch: 1 },
              },
            });
            continue;
          }
        }
      }

      if (!frontmatterPreview) {
        continue;
      }

      results.push({
        chunkId: asChunkId(node.id),
        nodeId: asNodeId(node.id),
        corpusId: asCorpusId(corpusId),
        workspaceId: asWorkspaceId(workspaceId),
        filePath,
        headingPath: ['Frontmatter'],
        bodyPreview: frontmatterPreview,
        score: 1,
        matchKind: 'metadata',
        citation: {
          citationId: asChunkId(node.id),
          corpusId: asCorpusId(corpusId),
          nodeId: asNodeId(node.id),
          chunkId: asChunkId(node.id),
          filePath,
          headingPath: ['Frontmatter'],
          sourceType: 'chunk',
        },
        ranking: {
          strategyId: 'metadata_only_v1',
          strategyVersion: '1',
          componentScores: { metadataMatch: 1 },
        },
      });
    }

    return results;
  }

  #mergeChunkHits(
    keywordHits: Awaited<ReturnType<ChunkRepository['searchKeyword']>>,
    semanticHits: ChunkSearchHit[],
  ): ChunkSearchHit[] {
    const byId = new Map<string, ChunkSearchHit>();

    for (const [index, hit] of keywordHits.entries()) {
      byId.set(hit.id, {
        id: hit.id,
        nodeId: hit.nodeId,
        filePath: hit.filePath,
        headingPath: hit.headingPath,
        body: hit.body,
        indexedAt: hit.indexedAt,
        keywordRank: index + 1,
        keywordScore: hit.keywordScore,
      });
    }

    for (const [index, hit] of semanticHits.entries()) {
      const existing = byId.get(hit.id);
      if (existing) {
        existing.semanticRank = index + 1;
        if (hit.semanticScore !== undefined) {
          existing.semanticScore = hit.semanticScore;
        }
        continue;
      }
      byId.set(hit.id, {
        id: hit.id,
        nodeId: hit.nodeId,
        filePath: hit.filePath,
        headingPath: hit.headingPath,
        body: hit.body,
        indexedAt: hit.indexedAt,
        semanticRank: index + 1,
        ...(hit.semanticScore !== undefined ? { semanticScore: hit.semanticScore } : {}),
      });
    }

    return [...byId.values()];
  }

  async isSemanticAvailable(): Promise<boolean> {
    if (!this.#embeddingProvider) {
      return false;
    }
    const health = await this.#embeddingProvider.health();
    return health.status === 'ok';
  }
}
