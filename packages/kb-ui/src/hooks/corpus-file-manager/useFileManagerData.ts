import type { EvuKbClient, KnowledgeNode } from '@evu/kb-sdk';
import { useCallback, useEffect, useState } from 'react';
import { patchNodeIndexStatus } from '../corpus-index-event-patch.js';
import { useCorpusIndexEventSubscription } from '../useCorpusIndexEventSubscription.js';

export type UseFileManagerDataOptions = {
  client: EvuKbClient;
  workspaceId: string;
  corpusId: string;
};

export function useFileManagerData({ client, workspaceId, corpusId }: UseFileManagerDataOptions) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corpusSettings, setCorpusSettings] = useState<Record<string, unknown>>({});

  const reloadNodes = useCallback(async (): Promise<KnowledgeNode[]> => {
    if (!corpusId) {
      return [];
    }
    setRefreshing(true);
    try {
      const loaded = await client.listNodes(workspaceId, corpusId, 'flat');
      setNodes(loaded);
      return loaded;
    } finally {
      setRefreshing(false);
    }
  }, [client, corpusId, workspaceId]);

  useEffect(() => {
    if (!corpusId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void client
      .listNodes(workspaceId, corpusId, 'flat')
      .then((loaded) => {
        if (!cancelled) {
          setNodes(loaded);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load files.');
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
  }, [client, corpusId, workspaceId]);

  useCorpusIndexEventSubscription({
    enabled: Boolean(corpusId),
    onEvent: useCallback((event) => {
      setNodes((current) => patchNodeIndexStatus(current, event));
    }, []),
  });

  useEffect(() => {
    if (!corpusId) {
      setCorpusSettings({});
      return;
    }

    let cancelled = false;
    void client
      .getCorpus(workspaceId, corpusId)
      .then((corpus) => {
        if (!cancelled) {
          setCorpusSettings(corpus.settings ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCorpusSettings({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, corpusId, workspaceId]);

  return {
    corpusSettings,
    error,
    loading,
    nodes,
    refreshing,
    reloadNodes,
    setError,
  };
}

export type UseFileManagerDataReturn = ReturnType<typeof useFileManagerData>;
