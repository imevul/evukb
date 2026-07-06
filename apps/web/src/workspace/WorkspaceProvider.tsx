import type { SettingsResponse } from '@evu/kb-sdk';
import { EvuKbApiError } from '@evu/kb-sdk';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';
import { readSelectedWorkspaceSlug, writeSelectedWorkspaceSlug } from './storage.js';

export type WorkspaceStatus = 'loading' | 'ready' | 'not_found' | 'forbidden' | 'error';

type WorkspaceContextValue = {
  selectedSlug: string;
  status: WorkspaceStatus;
  workspace: SettingsResponse | null;
  errorMessage: string | null;
  setSelectedSlug: (slug: string) => void;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function resolveInitialSlug(): string {
  return readSelectedWorkspaceSlug() ?? appConfig.workspaceId;
}

function mapValidationError(error: unknown): {
  status: WorkspaceStatus;
  message: string;
} {
  if (error instanceof EvuKbApiError) {
    if (error.code === 'workspace_not_found' || error.status === 404) {
      return { status: 'not_found', message: error.message };
    }
    if (error.status === 403) {
      return { status: 'forbidden', message: error.message };
    }
    return { status: 'error', message: error.message };
  }
  return {
    status: 'error',
    message: error instanceof Error ? error.message : 'Failed to validate workspace.',
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedSlug, setSelectedSlugState] = useState(resolveInitialSlug);
  const [status, setStatus] = useState<WorkspaceStatus>('loading');
  const [workspace, setWorkspace] = useState<SettingsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateSlug = useCallback(async (slug: string) => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const settings = await kbClient.getSettings(slug);
      setWorkspace(settings);
      setStatus('ready');
    } catch (error) {
      setWorkspace(null);
      const mapped = mapValidationError(error);
      setStatus(mapped.status);
      setErrorMessage(mapped.message);
    }
  }, []);

  const refresh = useCallback(async () => {
    await validateSlug(selectedSlug);
  }, [selectedSlug, validateSlug]);

  const setSelectedSlug = useCallback(
    (slug: string) => {
      const normalized = slug.trim();
      if (!normalized || normalized === selectedSlug) {
        return;
      }
      writeSelectedWorkspaceSlug(normalized);
      setSelectedSlugState(normalized);
    },
    [selectedSlug],
  );

  useEffect(() => {
    void validateSlug(selectedSlug);
  }, [selectedSlug, validateSlug]);

  const value = useMemo(
    () => ({
      selectedSlug,
      status,
      workspace,
      errorMessage,
      setSelectedSlug,
      refresh,
    }),
    [selectedSlug, status, workspace, errorMessage, setSelectedSlug, refresh],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider.');
  }
  return context;
}
