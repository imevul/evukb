import type { EvuKbClient } from '@evu/kb-sdk';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';

import {
  readStoredWorkspaceCorpusIds,
  resolveWorkspaceCorpusSelection,
  writeStoredWorkspaceCorpusIds,
} from '../search/workspace-corpus-selection.js';

export type WorkspaceCorpusOption = {
  id: string;
  name: string;
  fileCount: number;
  totalBytes: number;
  updatedAt: string;
};

export type UseWorkspaceCorporaResult = {
  availableCorpora: WorkspaceCorpusOption[];
  corpusIds: string[];
  setCorpusIds: Dispatch<SetStateAction<string[]>>;
  toggleCorpus: (corpusId: string) => void;
  loading: boolean;
  error: string | null;
};

export function useWorkspaceCorpora(
  client: EvuKbClient,
  workspaceId: string,
): UseWorkspaceCorporaResult {
  const [corpusIds, setCorpusIdsState] = useState<string[]>([]);
  const [availableCorpora, setAvailableCorpora] = useState<WorkspaceCorpusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setCorpusIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    (action) => {
      setCorpusIdsState((current) => {
        const next = typeof action === 'function' ? action(current) : action;
        writeStoredWorkspaceCorpusIds(workspaceId, next);
        return next;
      });
    },
    [workspaceId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void client
      .listCorpora(workspaceId)
      .then((items) => {
        if (!cancelled) {
          setAvailableCorpora(
            items.map((corpus) => ({
              id: corpus.id,
              name: corpus.name,
              fileCount: corpus.fileCount,
              totalBytes: corpus.totalBytes,
              updatedAt: corpus.updatedAt,
            })),
          );
          const availableIds = items.map((corpus) => corpus.id);
          setCorpusIdsState(
            resolveWorkspaceCorpusSelection(
              availableIds,
              readStoredWorkspaceCorpusIds(workspaceId),
            ),
          );
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load corpora.');
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

  const toggleCorpus = useCallback(
    (corpusId: string): void => {
      setCorpusIds((current) =>
        current.includes(corpusId)
          ? current.filter((id) => id !== corpusId)
          : [...current, corpusId],
      );
    },
    [setCorpusIds],
  );

  return {
    availableCorpora,
    corpusIds,
    setCorpusIds,
    toggleCorpus,
    loading,
    error,
  };
}
