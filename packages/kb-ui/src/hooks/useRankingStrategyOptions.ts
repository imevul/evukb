import type { EvuKbClient, RankingStrategySummary } from '@evu/kb-sdk';
import { useEffect, useState } from 'react';

export type RankingStrategyOptions = {
  strategies: RankingStrategySummary[];
  embeddingConfigured: boolean;
  loading: boolean;
};

export function useRankingStrategyOptions(
  client: EvuKbClient,
  workspaceId: string,
): RankingStrategyOptions {
  const [strategies, setStrategies] = useState<RankingStrategySummary[]>([]);
  const [embeddingConfigured, setEmbeddingConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([client.getSettings(workspaceId), client.getAiProviders(workspaceId)])
      .then(([settings, providers]) => {
        if (cancelled) {
          return;
        }
        setStrategies(settings.ranking.availableStrategies);
        setEmbeddingConfigured(
          providers.embedding.configured && providers.embedding.healthStatus === 'ok',
        );
      })
      .catch(() => {
        if (!cancelled) {
          setStrategies([]);
          setEmbeddingConfigured(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  return { strategies, embeddingConfigured, loading };
}
