import {
  type HybridRankingWeights,
  type RankingCandidate,
  type RankingStrategy,
  rankHybridDefaultV1,
} from '@evu/kb-core';

const docsPathBoost = 1.5;

function rankPreferDocsPrefixV1(
  candidates: RankingCandidate[],
  weights: HybridRankingWeights = {},
): ReturnType<typeof rankHybridDefaultV1> {
  const ranked = rankHybridDefaultV1(candidates, weights);
  return ranked
    .map((hit) => {
      const path =
        candidates.find((candidate) => candidate.chunkId === hit.chunkId)?.filePath ?? '';
      const docsBoost = path.startsWith('docs/') ? docsPathBoost : 1;
      return { ...hit, score: hit.score * docsBoost };
    })
    .sort((left, right) => right.score - left.score);
}

export const preferDocsPrefixV1Strategy: RankingStrategy = {
  id: 'prefer_docs_prefix_v1',
  version: '1',
  label: 'Docs prefix preference',
  description: 'Hybrid RRF with a custom rank() that boosts docs/ paths.',
  retrieval: { keyword: true, semantic: true },
  rank: rankPreferDocsPrefixV1,
};

export default preferDocsPrefixV1Strategy;
