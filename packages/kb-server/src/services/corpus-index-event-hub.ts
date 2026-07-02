import type { IndexStatus } from '@evu/kb-core';

export type CorpusIndexEvent = {
  kind: 'node_status';
  nodeId: string;
  indexStatus: IndexStatus;
  previousIndexStatus?: IndexStatus;
  at: string;
};

type Subscriber = (event: CorpusIndexEvent) => void;

function channelKey(workspaceId: string, corpusId: string): string {
  return `${workspaceId}:${corpusId}`;
}

export class CorpusIndexEventHub {
  readonly #subscribers = new Map<string, Set<Subscriber>>();

  subscribe(workspaceId: string, corpusId: string, subscriber: Subscriber): () => void {
    const key = channelKey(workspaceId, corpusId);
    let subscribers = this.#subscribers.get(key);
    if (!subscribers) {
      subscribers = new Set();
      this.#subscribers.set(key, subscribers);
    }
    subscribers.add(subscriber);
    return () => {
      subscribers?.delete(subscriber);
      if (subscribers && subscribers.size === 0) {
        this.#subscribers.delete(key);
      }
    };
  }

  publish(
    workspaceId: string,
    corpusId: string,
    event: Omit<CorpusIndexEvent, 'at' | 'kind'> & {
      kind?: CorpusIndexEvent['kind'];
      at?: string;
    },
  ): void {
    const subscribers = this.#subscribers.get(channelKey(workspaceId, corpusId));
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const payload: CorpusIndexEvent = {
      kind: event.kind ?? 'node_status',
      nodeId: event.nodeId,
      indexStatus: event.indexStatus,
      ...(event.previousIndexStatus !== undefined
        ? { previousIndexStatus: event.previousIndexStatus }
        : {}),
      at: event.at ?? new Date().toISOString(),
    };

    for (const subscriber of subscribers) {
      try {
        subscriber(payload);
      } catch {
        // Ignore subscriber failures so one bad client cannot break indexing.
      }
    }
  }
}
