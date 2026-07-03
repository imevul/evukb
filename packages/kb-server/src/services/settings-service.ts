import {
  type AiProviderSettings,
  type AiProvidersView,
  aiProviderSource,
  buildProviderConfig,
  type ChatProvider,
  defaultRankingStrategyId,
  defaultRankingStrategyRegistry,
  type EmbeddingProvider,
  isImportWritebackEnabled,
  isMountAuthoritativeEnabled,
  mergeAiProviderSettings,
  parseAiProviderSettings,
  parseRankingSettings,
  type RankingSettingsView,
  type RankingStrategyRegistry,
  resolveEmbeddingChunkingStrategyFromSettings,
  resolveMaxChunkTokensFromSettings,
  resolveRankingStrategyIdSetting,
  toRankingStrategySummary,
  validateAiProviderSettings,
  validateMutationApprovalPolicy,
  validateRankingSettings,
  type WorkspaceSettingsView,
} from '@evu/kb-core';
import type { WorkspaceRepository } from '@evu/kb-db';
import {
  resolveChatProviderForWorkspace,
  resolveEmbeddingProviderForWorkspace,
} from '../adapters/workspace-providers.js';
import { isSecretsKeyConfigured } from '../auth/secret-crypto.js';
import { ApiError } from '../errors.js';
import { assertValidRankingStrategyId } from '../search/validate-ranking-strategy.js';

export type SettingsServiceDeps = {
  workspaces: WorkspaceRepository;
  embeddingProvider: EmbeddingProvider | null;
  chatProvider: ChatProvider | null;
  connectionString?: string;
  blobRoot?: string;
  mountAllowlist?: string;
  rankingRegistry?: RankingStrategyRegistry;
};

export class SettingsService {
  readonly #workspaces: WorkspaceRepository;
  readonly #embeddingProvider: EmbeddingProvider | null;
  readonly #chatProvider: ChatProvider | null;
  readonly #connectionString: string | undefined;
  readonly #blobRoot: string | undefined;
  readonly #mountAllowlist: string | undefined;
  readonly #rankingRegistry: RankingStrategyRegistry;

  constructor(deps: SettingsServiceDeps) {
    this.#workspaces = deps.workspaces;
    this.#embeddingProvider = deps.embeddingProvider;
    this.#chatProvider = deps.chatProvider;
    this.#connectionString = deps.connectionString;
    this.#blobRoot = deps.blobRoot;
    this.#mountAllowlist = deps.mountAllowlist;
    this.#rankingRegistry = deps.rankingRegistry ?? defaultRankingStrategyRegistry;
  }

  async getSettings(workspaceId: string): Promise<WorkspaceSettingsView | null> {
    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      return null;
    }

    return {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      settings: workspace.settings,
      bootHints: this.#buildBootHints(),
    };
  }

  async updateSettings(
    workspaceId: string,
    input: { name?: string; settings?: Record<string, unknown> },
  ): Promise<WorkspaceSettingsView | null> {
    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      return null;
    }

    if (input.name !== undefined && !input.name.trim()) {
      throw ApiError.validation('name must be a non-empty string.');
    }

    let nextSettings = workspace.settings;
    if (input.settings !== undefined) {
      nextSettings = { ...workspace.settings, ...input.settings };
      const incomingRanking = input.settings.rankingSettings;
      if (
        incomingRanking &&
        typeof incomingRanking === 'object' &&
        !Array.isArray(incomingRanking)
      ) {
        const existingRanking = workspace.settings.rankingSettings;
        nextSettings.rankingSettings = {
          ...(existingRanking &&
          typeof existingRanking === 'object' &&
          !Array.isArray(existingRanking)
            ? existingRanking
            : {}),
          ...incomingRanking,
        };
      }

      const incomingApprovalPolicy = input.settings.mutationApprovalPolicy;
      if (
        incomingApprovalPolicy &&
        typeof incomingApprovalPolicy === 'object' &&
        !Array.isArray(incomingApprovalPolicy)
      ) {
        const existingApprovalPolicy = workspace.settings.mutationApprovalPolicy;
        nextSettings.mutationApprovalPolicy = {
          ...(existingApprovalPolicy &&
          typeof existingApprovalPolicy === 'object' &&
          !Array.isArray(existingApprovalPolicy)
            ? existingApprovalPolicy
            : {}),
          ...incomingApprovalPolicy,
        };
      }

      const validationError =
        validateRankingSettings(nextSettings) ??
        validateMutationApprovalPolicy(nextSettings.mutationApprovalPolicy);
      if (validationError) {
        throw ApiError.validation(validationError);
      }

      const incomingStrategyId = input.settings.rankingStrategyId;
      if (typeof incomingStrategyId === 'string') {
        assertValidRankingStrategyId(this.#rankingRegistry, incomingStrategyId);
      }
    }

    const updated = await this.#workspaces.update(workspaceId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.settings !== undefined ? { settings: nextSettings } : {}),
    });

    if (!updated) {
      return null;
    }

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      settings: updated.settings,
      bootHints: this.#buildBootHints(),
    };
  }

  getRankingSettingsView(settings: Record<string, unknown>): RankingSettingsView {
    const parsed = parseRankingSettings(settings);
    const hasStored =
      settings.rankingSettings &&
      typeof settings.rankingSettings === 'object' &&
      !Array.isArray(settings.rankingSettings) &&
      Object.keys(settings.rankingSettings as Record<string, unknown>).length > 0;

    const resolvedStrategy = resolveRankingStrategyIdSetting(
      {
        workspaceSettings: settings,
        envStrategyId: process.env.EVUKB_RANKING_STRATEGY,
      },
      defaultRankingStrategyId,
    );

    return {
      strategyId: resolvedStrategy.value,
      settings: parsed,
      source:
        resolvedStrategy.source === 'default' && hasStored ? 'database' : resolvedStrategy.source,
      note: 'Hybrid RRF v1 applies keyword, semantic, path, recency, OKF citation, and exact title boosts from workspace, corpus, and request settings.',
      availableStrategies: this.#rankingRegistry
        .list()
        .map((strategy) => toRankingStrategySummary(strategy)),
    };
  }

  async getAiProviders(workspaceId: string): Promise<AiProvidersView> {
    const workspace = await this.#workspaces.getById(workspaceId);
    const settings = workspace?.settings ?? {};
    const aiProviderSettings = parseAiProviderSettings(settings);

    const embeddingProvider =
      resolveEmbeddingProviderForWorkspace(settings, this.#embeddingProvider) ??
      this.#embeddingProvider;
    const chatProvider =
      resolveChatProviderForWorkspace(settings, this.#chatProvider) ?? this.#chatProvider;

    const embeddingHealth = embeddingProvider
      ? await embeddingProvider.health()
      : { status: 'not-configured' as const, model: 'none' };
    const chatHealth = chatProvider
      ? await chatProvider.health()
      : { status: 'not-configured' as const, model: 'none' };

    const chunkingStrategy = resolveEmbeddingChunkingStrategyFromSettings(settings, process.env);
    const maxChunkTokens = resolveMaxChunkTokensFromSettings(settings, process.env);

    return {
      embedding: {
        ...buildProviderConfig({
          providerId: 'openai-compatible',
          model:
            embeddingProvider?.model ??
            process.env.EVUKB_EMBEDDING_MODEL ??
            'text-embedding-3-small',
          baseUrl:
            aiProviderSettings.embedding?.baseUrl ??
            process.env.EVUKB_EMBEDDING_BASE_URL ??
            'https://api.openai.com/v1',
          configured: embeddingHealth.status !== 'not-configured',
          health: embeddingHealth,
        }),
        source: aiProviderSource(settings, 'embedding'),
        chunkingStrategy,
        maxChunkTokens,
      },
      chat: {
        ...buildProviderConfig({
          providerId: 'openai-compatible',
          model: chatProvider?.model ?? process.env.EVUKB_CHAT_MODEL ?? 'gpt-4o-mini',
          baseUrl:
            aiProviderSettings.chat?.baseUrl ??
            process.env.EVUKB_CHAT_BASE_URL ??
            'https://api.openai.com/v1',
          configured: chatHealth.status !== 'not-configured',
          health: chatHealth,
        }),
        source: aiProviderSource(settings, 'chat'),
      },
    };
  }

  async updateAiProviders(
    workspaceId: string,
    patch: AiProviderSettings,
  ): Promise<AiProvidersView | null> {
    const validationError = validateAiProviderSettings(patch);
    if (validationError) {
      throw ApiError.validation(validationError);
    }

    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      return null;
    }

    const nextSettings = mergeAiProviderSettings(workspace.settings, patch);
    const updated = await this.#workspaces.update(workspaceId, { settings: nextSettings });
    if (!updated) {
      return null;
    }

    return this.getAiProviders(workspaceId);
  }

  #buildBootHints(): WorkspaceSettingsView['bootHints'] {
    return {
      databaseConfigured: Boolean(this.#connectionString),
      blobStoreConfigured: Boolean(this.#blobRoot),
      mountAllowlistConfigured: Boolean(
        this.#mountAllowlist?.trim() || process.env.EVUKB_MOUNT_ALLOWLIST?.trim(),
      ),
      secretsKeyConfigured: isSecretsKeyConfigured(),
      mountAuthoritativeEnabled: isMountAuthoritativeEnabled(process.env),
      importWritebackEnabled: isImportWritebackEnabled(process.env),
    };
  }
}
