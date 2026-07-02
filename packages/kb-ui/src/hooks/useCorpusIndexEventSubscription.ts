import type { CorpusIndexEvent } from '@evu/kb-sdk';

import { useCorpusIndexEventListener } from './CorpusIndexEventProvider.js';

export type UseCorpusIndexEventSubscriptionOptions = {
  enabled?: boolean;
  onEvent: (event: CorpusIndexEvent) => void;
};

export function useCorpusIndexEventSubscription({
  enabled = true,
  onEvent,
}: UseCorpusIndexEventSubscriptionOptions): void {
  useCorpusIndexEventListener(onEvent, enabled);
}
