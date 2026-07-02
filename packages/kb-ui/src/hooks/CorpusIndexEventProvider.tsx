import type { CorpusIndexEvent, EvuKbClient } from '@evu/kb-sdk';
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

type CorpusIndexEventListener = (event: CorpusIndexEvent) => void;

type CorpusIndexEventContextValue = {
  subscribe: (listener: CorpusIndexEventListener) => () => void;
};

const CorpusIndexEventContext = createContext<CorpusIndexEventContextValue | null>(null);

export type CorpusIndexEventProviderProps = {
  children: ReactNode;
  client: EvuKbClient;
  corpusId: string;
  enabled?: boolean;
  workspaceId: string;
};

export function CorpusIndexEventProvider({
  children,
  client,
  workspaceId,
  corpusId,
  enabled = true,
}: CorpusIndexEventProviderProps): ReactElement {
  const listenersRef = useRef(new Set<CorpusIndexEventListener>());

  const subscribe = useCallback((listener: CorpusIndexEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !corpusId) {
      return;
    }

    const controller = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      void (async () => {
        try {
          for await (const event of client.subscribeCorpusIndexEvents(
            workspaceId,
            corpusId,
            controller.signal,
          )) {
            for (const listener of listenersRef.current) {
              listener(event);
            }
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
          console.error('[EvuKB] corpus index event stream failed', error);
        }

        if (!controller.signal.aborted) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      })();
    };

    connect();

    return () => {
      controller.abort();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [client, corpusId, enabled, workspaceId]);

  const value = useMemo(() => ({ subscribe }), [subscribe]);

  return (
    <CorpusIndexEventContext.Provider value={value}>{children}</CorpusIndexEventContext.Provider>
  );
}

export function useCorpusIndexEventListener(
  listener: CorpusIndexEventListener,
  enabled = true,
): void {
  const context = useContext(CorpusIndexEventContext);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!enabled || !context) {
      return;
    }

    return context.subscribe((event) => {
      listenerRef.current(event);
    });
  }, [context, enabled]);
}
