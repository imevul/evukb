import { createRankingStrategyRegistry, type RankingStrategyRegistry } from '@evu/kb-core';

import boostAgentNotesV1Strategy, { preferDocsPrefixV1Strategy } from './index.js';

export function createExampleRankingStrategyRegistry(): RankingStrategyRegistry {
  return createRankingStrategyRegistry({
    extensions: [boostAgentNotesV1Strategy, preferDocsPrefixV1Strategy],
  });
}
