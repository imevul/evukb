import { describe, expect, it } from 'vitest';

import { CorpusIndexEventHub } from '../src/services/corpus-index-event-hub.js';

describe('CorpusIndexEventHub', () => {
  it('delivers published events to subscribers for the same corpus', () => {
    const hub = new CorpusIndexEventHub();
    const received: Array<{ nodeId: string; indexStatus: string }> = [];
    const unsubscribe = hub.subscribe('ws-1', 'corpus-1', (event) => {
      received.push({ nodeId: event.nodeId, indexStatus: event.indexStatus });
    });

    hub.publish('ws-1', 'corpus-1', {
      nodeId: 'node-1',
      indexStatus: 'indexing',
      previousIndexStatus: 'pending',
    });

    expect(received).toEqual([{ nodeId: 'node-1', indexStatus: 'indexing' }]);
    unsubscribe();
  });

  it('does not deliver events to other corpora or after unsubscribe', () => {
    const hub = new CorpusIndexEventHub();
    const received: string[] = [];
    const unsubscribe = hub.subscribe('ws-1', 'corpus-1', (event) => {
      received.push(event.nodeId);
    });

    hub.publish('ws-1', 'corpus-2', { nodeId: 'other', indexStatus: 'indexed' });
    unsubscribe();
    hub.publish('ws-1', 'corpus-1', { nodeId: 'node-2', indexStatus: 'indexed' });

    expect(received).toEqual([]);
  });
});
