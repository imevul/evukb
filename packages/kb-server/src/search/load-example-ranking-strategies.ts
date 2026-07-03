import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { RankingStrategy } from '@evu/kb-core';

export const exampleRankingStrategyIds = ['boost_agent_notes_v1', 'prefer_docs_prefix_v1'] as const;

export type ExampleRankingStrategyId = (typeof exampleRankingStrategyIds)[number];

const exampleRankingStrategyIdSet = new Set<string>(exampleRankingStrategyIds);

export function isExampleRankingStrategyId(value: string): value is ExampleRankingStrategyId {
  return exampleRankingStrategyIdSet.has(value);
}

export function resolveExampleRankingStrategiesModulePath(): string {
  const configured = process.env.EVUKB_EXAMPLE_RANKING_STRATEGIES_MODULE?.trim();
  if (configured) {
    return configured;
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, '../../../../examples/custom-ranking-strategy/src/register-dev.ts'),
    path.join(process.cwd(), 'examples/custom-ranking-strategy/src/register-dev.ts'),
    path.resolve(process.cwd(), '../examples/custom-ranking-strategy/src/register-dev.ts'),
    path.resolve(process.cwd(), '../../examples/custom-ranking-strategy/src/register-dev.ts'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

let cachedStrategies: Map<string, RankingStrategy> | null = null;

async function loadExampleStrategiesById(): Promise<Map<string, RankingStrategy>> {
  if (cachedStrategies) {
    return cachedStrategies;
  }
  const modulePath = resolveExampleRankingStrategiesModulePath();
  const moduleUrl = modulePath.startsWith('file://') ? modulePath : pathToFileURL(modulePath).href;
  const loaded = (await import(moduleUrl)) as {
    createExampleRankingStrategyRegistry?: () => {
      list: () => RankingStrategy[];
      isBuiltin: (strategyId: string) => boolean;
    };
  };
  if (typeof loaded.createExampleRankingStrategyRegistry !== 'function') {
    throw new Error(
      'Example ranking strategies module must export createExampleRankingStrategyRegistry.',
    );
  }
  const registry = loaded.createExampleRankingStrategyRegistry();
  cachedStrategies = new Map(
    registry
      .list()
      .filter((strategy) => !registry.isBuiltin(strategy.id))
      .map((strategy) => [strategy.id, strategy]),
  );
  return cachedStrategies;
}

export async function resolveExampleRankingStrategy(exampleId: string): Promise<RankingStrategy> {
  if (!isExampleRankingStrategyId(exampleId)) {
    throw new Error(`Unknown example ranking strategy: ${exampleId}`);
  }
  const strategies = await loadExampleStrategiesById();
  const strategy = strategies.get(exampleId);
  if (!strategy) {
    throw new Error(`Example ranking strategy is not available: ${exampleId}`);
  }
  return strategy;
}

/** @internal Test helper */
export function clearExampleRankingStrategyCache(): void {
  cachedStrategies = null;
}
