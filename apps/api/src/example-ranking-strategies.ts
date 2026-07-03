import { fileURLToPath } from 'node:url';

import type { RankingStrategyRegistry } from '@evu/kb-core';

export function shouldRegisterExampleRankingStrategies(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const explicit = env.EVUKB_REGISTER_EXAMPLE_RANKING_STRATEGIES?.trim();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }
  return env.NODE_ENV !== 'production';
}

const exampleRegisterModuleUrl = new URL(
  '../../../examples/custom-ranking-strategy/src/register-dev.ts',
  import.meta.url,
).href;

export const exampleRegisterModulePath = fileURLToPath(exampleRegisterModuleUrl);

export async function resolveRankingRegistryForApi(
  env: NodeJS.ProcessEnv = process.env,
): Promise<RankingStrategyRegistry | undefined> {
  if (!shouldRegisterExampleRankingStrategies(env)) {
    return undefined;
  }
  const mod = (await import(exampleRegisterModuleUrl)) as {
    createExampleRankingStrategyRegistry: () => RankingStrategyRegistry;
  };
  return mod.createExampleRankingStrategyRegistry();
}
