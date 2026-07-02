import {
  type AskResponse,
  type AskStreamEvent,
  buildAskContextBlocks,
  buildAskSystemPrompt,
  buildAskUserPrompt,
  buildAskWarnings,
  type ChatCompletionUsage,
  type ChatProvider,
  type CorpusAskRequest,
  defaultMaxContextChunks,
  defaultRankingStrategyId,
  deriveAskCitations,
  formatAskContextForPrompt,
  maxAskCorpora,
  type OperationUsage,
  parseAiProviderSettings,
  type WorkspaceAskRequest,
} from '@evu/kb-core';
import type {
  CorpusRepository,
  NodeRepository,
  UsageRecordRepository,
  WorkspaceRepository,
} from '@evu/kb-db';

import { resolveChatProviderForWorkspace } from '../adapters/workspace-providers.js';
import { ApiError } from '../errors.js';
import type { SearchService } from './search-service.js';

export type AskServiceDeps = {
  chatProvider: ChatProvider | null;
  corpora: CorpusRepository;
  nodes: NodeRepository;
  search: SearchService;
  usageRecords?: UsageRecordRepository;
  workspaces: WorkspaceRepository;
};

type ResolvedAskContext = {
  question: string;
  corpusIds: string[];
  responseMode: NonNullable<CorpusAskRequest['responseMode']>;
  usedChunks: Awaited<ReturnType<SearchService['searchAcrossCorpora']>>;
  warnings: string[];
  contextText: string;
  citations: ReturnType<typeof deriveAskCitations>;
  retrievalTrace: AskResponse['retrievalTrace'];
  model: string;
};

function resolveChatProviderName(): string {
  return process.env.EVUKB_CHAT_PROVIDER?.trim() || 'openai-compatible';
}

export class AskService {
  readonly #defaultChatProvider: ChatProvider | null;
  readonly #corpora: CorpusRepository;
  readonly #nodes: NodeRepository;
  readonly #search: SearchService;
  readonly #usageRecords: UsageRecordRepository | undefined;
  readonly #workspaces: WorkspaceRepository;

  constructor(deps: AskServiceDeps) {
    this.#defaultChatProvider = deps.chatProvider;
    this.#corpora = deps.corpora;
    this.#nodes = deps.nodes;
    this.#search = deps.search;
    this.#usageRecords = deps.usageRecords;
    this.#workspaces = deps.workspaces;
  }

  async #resolveChatProvider(workspaceId: string): Promise<ChatProvider | null> {
    const workspace = await this.#workspaces.getById(workspaceId);
    const settings = workspace?.settings ?? {};
    return resolveChatProviderForWorkspace(settings, this.#defaultChatProvider);
  }

  async #recordAskUsage(
    workspaceId: string,
    corpusIds: string[],
    chatProvider: ChatProvider,
    usage?: ChatCompletionUsage,
  ): Promise<OperationUsage | undefined> {
    if (!usage) {
      return undefined;
    }

    const workspace = await this.#workspaces.getById(workspaceId);
    const providerOverride = parseAiProviderSettings(workspace?.settings ?? {}).chat;
    const operationUsage: OperationUsage = {
      provider: resolveChatProviderName(),
      model: providerOverride?.model ?? chatProvider.model,
      operationType: 'ask',
      requestCount: 1,
      latencyMs: usage.latencyMs ?? 0,
      ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
      ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
    };

    if (this.#usageRecords) {
      await this.#usageRecords.create({
        workspaceId,
        ...(corpusIds.length === 1 ? { corpusId: corpusIds[0] } : {}),
        ...operationUsage,
      });
    }

    return operationUsage;
  }

  async ask(
    workspaceId: string,
    corpusId: string,
    request: CorpusAskRequest,
  ): Promise<AskResponse> {
    return this.askCorpora(workspaceId, {
      question: request.question,
      corpusIds: [corpusId],
      ...(request.nodeId !== undefined ? { nodeId: request.nodeId } : {}),
      ...(request.pathPrefix !== undefined ? { pathPrefix: request.pathPrefix } : {}),
      ...(request.maxContextChunks !== undefined
        ? { maxContextChunks: request.maxContextChunks }
        : {}),
      ...(request.responseMode !== undefined ? { responseMode: request.responseMode } : {}),
      ...(request.stream !== undefined ? { stream: request.stream } : {}),
      ...(request.filters !== undefined ? { filters: request.filters } : {}),
      ...(request.rankingStrategyId !== undefined
        ? { rankingStrategyId: request.rankingStrategyId }
        : {}),
    });
  }

  async askCorpora(workspaceId: string, request: WorkspaceAskRequest): Promise<AskResponse> {
    const context = await this.#resolveAskContext(workspaceId, request);
    const chatProvider = await this.#resolveChatProvider(workspaceId);
    if (!chatProvider) {
      throw ApiError.serviceUnavailable(
        'Chat provider is not configured; set EVUKB_CHAT_API_KEY to enable ask.',
      );
    }

    const completion = await chatProvider.complete({
      messages: [
        { role: 'system', content: buildAskSystemPrompt(context.responseMode) },
        { role: 'user', content: buildAskUserPrompt(context.question, context.contextText) },
      ],
    });

    const operationUsage = await this.#recordAskUsage(
      workspaceId,
      context.corpusIds,
      chatProvider,
      completion.usage,
    );

    return {
      answer: completion.content.trim(),
      citations: context.citations,
      usedChunks: context.usedChunks,
      warnings: context.warnings,
      model: context.model,
      retrievalTrace: context.retrievalTrace,
      ...(operationUsage ? { operationUsage } : {}),
    };
  }

  async *askCorporaStream(
    workspaceId: string,
    request: WorkspaceAskRequest,
  ): AsyncIterable<AskStreamEvent> {
    const context = await this.#resolveAskContext(workspaceId, request);
    const chatProvider = await this.#resolveChatProvider(workspaceId);
    if (!chatProvider) {
      throw ApiError.serviceUnavailable(
        'Chat provider is not configured; set EVUKB_CHAT_API_KEY to enable ask.',
      );
    }

    yield {
      type: 'metadata',
      citations: context.citations,
      usedChunks: context.usedChunks,
      warnings: context.warnings,
      model: context.model,
      retrievalTrace: context.retrievalTrace,
    };

    let streamUsage: ChatCompletionUsage | undefined;
    for await (const event of chatProvider.completeStream({
      messages: [
        { role: 'system', content: buildAskSystemPrompt(context.responseMode) },
        { role: 'user', content: buildAskUserPrompt(context.question, context.contextText) },
      ],
    })) {
      if (event.type === 'token') {
        yield { type: 'token', delta: event.delta };
      } else if (event.type === 'done') {
        streamUsage = event.usage;
      }
    }

    const operationUsage = await this.#recordAskUsage(
      workspaceId,
      context.corpusIds,
      chatProvider,
      streamUsage,
    );

    yield {
      type: 'done',
      ...(operationUsage ? { operationUsage } : {}),
    };
  }

  async #resolveAskContext(
    workspaceId: string,
    request: WorkspaceAskRequest,
  ): Promise<ResolvedAskContext> {
    const chatProvider = await this.#resolveChatProvider(workspaceId);
    if (!chatProvider) {
      throw ApiError.serviceUnavailable(
        'Chat provider is not configured; set EVUKB_CHAT_API_KEY to enable ask.',
      );
    }

    const question = request.question?.trim();
    if (!question) {
      throw ApiError.validation('Question is required.');
    }

    const corpusIds = [...new Set(request.corpusIds.map((id) => id.trim()).filter(Boolean))];
    if (corpusIds.length === 0) {
      throw ApiError.validation('At least one corpusId is required.');
    }
    if (corpusIds.length > maxAskCorpora) {
      throw ApiError.validation(`At most ${maxAskCorpora} corpora are allowed per ask request.`);
    }

    for (const corpusId of corpusIds) {
      const corpus = await this.#corpora.getById(workspaceId, corpusId);
      if (!corpus) {
        throw ApiError.corpusNotFound(corpusId);
      }
    }

    if (request.nodeId) {
      const node = await this.#nodes.getByIdInWorkspace(workspaceId, request.nodeId);
      if (!node || !corpusIds.includes(node.corpusId)) {
        throw ApiError.nodeNotFound(request.nodeId);
      }
    }

    const responseMode = request.responseMode ?? 'concise';
    const maxContextChunks = request.maxContextChunks ?? defaultMaxContextChunks;

    const retrieved = await this.#search.searchAcrossCorpora(workspaceId, corpusIds, {
      query: question,
      ...(request.pathPrefix ? { pathPrefix: request.pathPrefix } : {}),
      ...(request.filters !== undefined ? { filters: request.filters } : {}),
      ...(request.rankingStrategyId !== undefined
        ? { rankingStrategyId: request.rankingStrategyId }
        : {}),
      limit: maxContextChunks,
    });

    const usedChunks = request.nodeId
      ? retrieved.filter((hit) => hit.nodeId === request.nodeId)
      : retrieved;

    const warnings = buildAskWarnings(usedChunks, responseMode);
    const contextBlocks = buildAskContextBlocks(usedChunks);
    const contextText = formatAskContextForPrompt(contextBlocks);
    const citations = deriveAskCitations(usedChunks);

    return {
      question,
      corpusIds,
      responseMode,
      usedChunks,
      warnings,
      contextText,
      citations,
      model: chatProvider.model,
      retrievalTrace: {
        query: question,
        strategyId: retrieved[0]?.ranking?.strategyId ?? defaultRankingStrategyId,
        candidateCount: retrieved.length,
        selectedCount: usedChunks.length,
        corpusCount: corpusIds.length,
      },
    };
  }
}
