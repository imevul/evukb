import type { AskResponse, CorpusAskRequest, WorkspaceAskRequest } from '@evu/kb-sdk';
import { EvuKbApiError } from '@evu/kb-sdk';
import { useCallback, useState } from 'react';

import { mergeAskStreamDone } from '../ask/ask-trace.js';

type AskStreamEvent = {
  type: string;
  delta?: string;
  citations?: AskResponse['citations'];
  usedChunks?: AskResponse['usedChunks'];
  warnings?: AskResponse['warnings'];
  model?: string;
  retrievalTrace?: AskResponse['retrievalTrace'];
  operationUsage?: AskResponse['operationUsage'];
};

export type AskStreamFns<TRequest> = {
  stream: (request: TRequest) => AsyncIterable<AskStreamEvent>;
  fallback: (request: TRequest) => Promise<AskResponse>;
};

export type UseAskStreamResult<TRequest> = {
  response: AskResponse | null;
  loading: boolean;
  error: string | null;
  ask: (request: TRequest) => Promise<void>;
  reset: () => void;
};

const CHAT_UNAVAILABLE_MESSAGE =
  'Ask is unavailable. Configure EVUKB_CHAT_API_KEY on the API server.';

export function useAskStream<TRequest extends CorpusAskRequest | WorkspaceAskRequest>(
  fns: AskStreamFns<TRequest>,
): UseAskStreamResult<TRequest> {
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback((): void => {
    setResponse(null);
    setError(null);
  }, []);

  const ask = useCallback(
    async (request: TRequest): Promise<void> => {
      setLoading(true);
      setError(null);
      setResponse(null);

      try {
        let streamed = false;
        for await (const streamEvent of fns.stream(request)) {
          streamed = true;
          if (streamEvent.type === 'metadata') {
            setResponse({
              answer: '',
              citations: streamEvent.citations ?? [],
              usedChunks: streamEvent.usedChunks ?? [],
              warnings: streamEvent.warnings ?? [],
              model: streamEvent.model ?? '',
              retrievalTrace: streamEvent.retrievalTrace ?? {
                query: '',
                strategyId: '',
                candidateCount: 0,
                selectedCount: 0,
              },
            });
          } else if (streamEvent.type === 'token' && streamEvent.delta) {
            setResponse((current) =>
              current ? { ...current, answer: `${current.answer}${streamEvent.delta}` } : current,
            );
          } else if (streamEvent.type === 'done') {
            setResponse((current) =>
              current ? mergeAskStreamDone(current, streamEvent.operationUsage) : current,
            );
          }
        }

        if (!streamed) {
          throw new Error('Streaming ask returned no events.');
        }
      } catch (askError: unknown) {
        try {
          const answer = await fns.fallback(request);
          setResponse(answer);
          setError(null);
        } catch (fallbackError: unknown) {
          setResponse(null);
          const resolved = fallbackError ?? askError;
          if (resolved instanceof EvuKbApiError && resolved.status === 503) {
            setError(CHAT_UNAVAILABLE_MESSAGE);
          } else {
            setError(resolved instanceof Error ? resolved.message : 'Ask failed.');
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [fns],
  );

  return { response, loading, error, ask, reset };
}
