import type { EvuKbClient, KnowledgeLinkGraph } from '@evu/kb-sdk';
import { useEffect, useState } from 'react';

export function useLinkGraph(
  client: EvuKbClient,
  workspaceId: string,
  corpusId: string | undefined,
  limit?: number,
): {
  graph: KnowledgeLinkGraph | null;
  loading: boolean;
  error: string | null;
} {
  const [graph, setGraph] = useState<KnowledgeLinkGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!corpusId) {
      setGraph(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void client
      .getLinkGraph(workspaceId, corpusId, limit !== undefined ? { limit } : undefined)
      .then((loaded) => {
        if (!cancelled) {
          setGraph(loaded);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setGraph(null);
          setError(loadError instanceof Error ? loadError.message : 'Failed to load link graph.');
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
  }, [client, corpusId, workspaceId, limit]);

  return { graph, loading, error };
}
