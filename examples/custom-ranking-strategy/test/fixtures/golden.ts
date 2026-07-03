import type { RankingCandidate, RankingStrategy } from '@evu/kb-core';
import { preferDocsPrefixV1Strategy } from '../../src/strategies/custom-prefer-docs-prefix.js';
import { boostAgentNotesV1Strategy } from '../../src/strategies/preset-boost-agent-notes.js';

export type ExampleRankingGoldenCase = {
  strategy: RankingStrategy;
  candidates: RankingCandidate[];
  expectedTop: string;
};

export const exampleRankingGoldenCases: ExampleRankingGoldenCase[] = [
  {
    strategy: boostAgentNotesV1Strategy,
    candidates: [
      {
        chunkId: 'plain-winner',
        filePath: 'docs/note.md',
        keywordRank: 1,
        keywordScore: 0.9,
        semanticRank: 1,
        semanticScore: 0.9,
      },
      {
        chunkId: 'agent-note',
        filePath: 'agent-notes/session.md',
        keywordRank: 2,
        keywordScore: 0.8,
        semanticRank: 2,
        semanticScore: 0.8,
      },
    ],
    expectedTop: 'agent-note',
  },
  {
    strategy: preferDocsPrefixV1Strategy,
    candidates: [
      {
        chunkId: 'plain-equal',
        filePath: 'notes/topic.md',
        keywordRank: 1,
        keywordScore: 0.9,
        semanticRank: 1,
        semanticScore: 0.9,
      },
      {
        chunkId: 'docs-equal',
        filePath: 'docs/topic.md',
        keywordRank: 1,
        keywordScore: 0.9,
        semanticRank: 1,
        semanticScore: 0.9,
      },
    ],
    expectedTop: 'docs-equal',
  },
];
