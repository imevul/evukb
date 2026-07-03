import { pathToFileURL } from 'node:url';

import {
  assertRankingStrategy,
  createPresetRankingStrategy,
  defaultRankingStrategyId,
  type HybridRankingWeights,
  isRankingPluginReloadEnabled,
  type RankingRetrievalProfile,
  type RankingStrategy,
  type RankingStrategyRegistry,
  resolveRankingStrategyIdSetting,
  toRankingStrategySummary,
} from '@evu/kb-core';
import type { AuditLogRepository, CorpusRepository, WorkspaceRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import { resolveExampleRankingStrategy } from '../search/load-example-ranking-strategies.js';

export type RankingStrategyUsageView = {
  strategyId: string;
  workspaceDefaultUsesStrategy: boolean;
  corpora: Array<{ id: string; name: string }>;
};

export type RegisterRankingStrategyInput = {
  strategy?: RankingStrategy;
  preset?: {
    id: string;
    version: string;
    label?: string;
    description?: string;
    retrieval?: RankingRetrievalProfile;
    weights?: HybridRankingWeights;
    postRank?: string;
  };
  importPath?: string;
  exampleId?: string;
  force?: boolean;
};

export type RankingStrategyPluginServiceDeps = {
  rankingRegistry: RankingStrategyRegistry;
  workspaces: WorkspaceRepository;
  corpora: CorpusRepository;
  auditLog: AuditLogRepository;
};

function assertPluginReloadEnabled(): void {
  if (!isRankingPluginReloadEnabled()) {
    throw ApiError.forbidden(
      'Ranking plugin reload is disabled. Set EVUKB_ENABLE_RANKING_PLUGIN_RELOAD=true to enable.',
    );
  }
}

function isImportPathAllowed(importPath: string): boolean {
  const allowlist = process.env.EVUKB_RANKING_PLUGIN_ALLOWLIST?.trim();
  if (!allowlist) {
    return false;
  }
  const normalized = importPath.trim();
  for (const entry of allowlist.split(',')) {
    const prefix = entry.trim();
    if (prefix && normalized.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

async function loadStrategyFromImportPath(importPath: string): Promise<RankingStrategy> {
  if (!isImportPathAllowed(importPath)) {
    throw ApiError.forbidden('importPath is not under EVUKB_RANKING_PLUGIN_ALLOWLIST.');
  }
  const moduleUrl = importPath.startsWith('file://') ? importPath : pathToFileURL(importPath).href;
  const loaded = (await import(moduleUrl)) as {
    default?: RankingStrategy;
    strategy?: RankingStrategy;
  };
  const strategy = loaded.default ?? loaded.strategy;
  if (!strategy) {
    throw ApiError.validation('importPath module must export default or strategy RankingStrategy.');
  }
  assertRankingStrategy(strategy);
  return strategy;
}

export class RankingStrategyPluginService {
  readonly #rankingRegistry: RankingStrategyRegistry;
  readonly #workspaces: WorkspaceRepository;
  readonly #corpora: CorpusRepository;
  readonly #auditLog: AuditLogRepository;

  constructor(deps: RankingStrategyPluginServiceDeps) {
    this.#rankingRegistry = deps.rankingRegistry;
    this.#workspaces = deps.workspaces;
    this.#corpora = deps.corpora;
    this.#auditLog = deps.auditLog;
  }

  listStrategies() {
    return this.#rankingRegistry.list().map((strategy) => toRankingStrategySummary(strategy));
  }

  async getUsage(workspaceId: string, strategyId: string): Promise<RankingStrategyUsageView> {
    this.#rankingRegistry.resolve(strategyId);
    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      throw ApiError.workspaceNotFound(workspaceId);
    }
    const workspaceStrategyId =
      typeof workspace.settings.rankingStrategyId === 'string'
        ? workspace.settings.rankingStrategyId
        : undefined;
    const corpora = await this.#corpora.listByWorkspaceAndRankingStrategy(workspaceId, strategyId);
    return {
      strategyId,
      workspaceDefaultUsesStrategy: workspaceStrategyId === strategyId,
      corpora: corpora.map((corpus) => ({ id: corpus.id, name: corpus.name })),
    };
  }

  async registerStrategy(
    workspaceId: string,
    input: RegisterRankingStrategyInput,
    actor: { kind: 'api_key'; tokenId: string } | { kind: 'dev' },
  ) {
    assertPluginReloadEnabled();

    let strategy: RankingStrategy;
    if (input.importPath) {
      strategy = await loadStrategyFromImportPath(input.importPath);
    } else if (input.exampleId) {
      try {
        strategy = await resolveExampleRankingStrategy(input.exampleId);
      } catch (error) {
        throw ApiError.validation(
          error instanceof Error ? error.message : 'Example ranking strategy is not available.',
        );
      }
    } else if (input.preset) {
      strategy = createPresetRankingStrategy(input.preset);
      assertRankingStrategy(strategy);
    } else if (input.strategy) {
      strategy = input.strategy;
      assertRankingStrategy(strategy);
    } else {
      throw ApiError.validation('strategy, preset, importPath, or exampleId is required.');
    }

    try {
      this.#rankingRegistry.register(strategy, input.force ? { force: true } : undefined);
    } catch (error) {
      throw ApiError.validation(error instanceof Error ? error.message : 'Invalid strategy.');
    }

    await this.#auditLog.record({
      workspaceId,
      action: 'ranking_strategy_register',
      actor: actor.kind === 'dev' ? { kind: 'dev' } : { kind: 'api_key', tokenId: actor.tokenId },
      target: { type: 'ranking_strategy', id: strategy.id },
      metadata: {
        strategyId: strategy.id,
        version: strategy.version,
        ...(input.importPath ? { importPath: input.importPath } : {}),
        ...(input.exampleId ? { exampleId: input.exampleId } : {}),
        ...(input.force ? { force: true } : {}),
      },
    });

    return toRankingStrategySummary(strategy);
  }

  async unregisterStrategy(
    workspaceId: string,
    strategyId: string,
    options: { confirm: boolean },
    actor: { kind: 'api_key'; tokenId: string } | { kind: 'dev' },
  ) {
    assertPluginReloadEnabled();
    if (!options.confirm) {
      throw ApiError.validation('confirm: true is required to unregister a ranking strategy.');
    }
    if (this.#rankingRegistry.isBuiltin(strategyId)) {
      throw ApiError.validation(`Cannot unregister built-in strategy: ${strategyId}`);
    }
    this.#rankingRegistry.resolve(strategyId);

    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      throw ApiError.workspaceNotFound(workspaceId);
    }

    const workspaceFallback = resolveRankingStrategyIdSetting(
      { workspaceSettings: workspace.settings, envStrategyId: process.env.EVUKB_RANKING_STRATEGY },
      defaultRankingStrategyId,
    ).value;

    const workspaceStrategyId =
      typeof workspace.settings.rankingStrategyId === 'string'
        ? workspace.settings.rankingStrategyId
        : undefined;
    const corpusFallback =
      workspaceStrategyId === strategyId ? defaultRankingStrategyId : workspaceFallback;

    const remediatedCorpusCount = await this.#corpora.clearRankingStrategyForWorkspace(
      workspaceId,
      strategyId,
      corpusFallback,
    );

    let workspaceRemediated = false;
    if (workspaceStrategyId === strategyId) {
      await this.#workspaces.update(workspaceId, {
        settings: {
          ...workspace.settings,
          rankingStrategyId: defaultRankingStrategyId,
        },
      });
      workspaceRemediated = true;
    }

    this.#rankingRegistry.unregister(strategyId);

    await this.#auditLog.record({
      workspaceId,
      action: 'ranking_strategy_unregister',
      actor: actor.kind === 'dev' ? { kind: 'dev' } : { kind: 'api_key', tokenId: actor.tokenId },
      target: { type: 'ranking_strategy', id: strategyId },
      metadata: {
        strategyId,
        remediatedCorpusCount,
        workspaceRemediated,
        corpusFallbackStrategyId: corpusFallback,
        workspaceFallbackStrategyId: defaultRankingStrategyId,
      },
    });

    return {
      strategyId,
      remediatedCorpusCount,
      workspaceRemediated,
      corpusFallbackStrategyId: corpusFallback,
      workspaceFallbackStrategyId: defaultRankingStrategyId,
    };
  }
}
