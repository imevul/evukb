import { createPresetRankingStrategy, type RankingStrategy } from '@evu/kb-core';

export const boostAgentNotesV1Strategy: RankingStrategy = createPresetRankingStrategy({
  id: 'boost_agent_notes_v1',
  version: '1',
  label: 'Agent notes boost',
  description: 'Hybrid RRF with a default path boost for agent-notes/.',
  weights: {
    pathBoosts: {
      'agent-notes/': 2,
    },
  },
});
