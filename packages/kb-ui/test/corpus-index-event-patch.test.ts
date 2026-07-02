import type { CorpusIndexEvent, IndexStatusCounts } from '@evu/kb-sdk';
import { describe, expect, it } from 'vitest';

import {
  patchIndexStatusCounts,
  patchNodeIndexStatus,
} from '../src/hooks/corpus-index-event-patch.js';

const baseCounts: IndexStatusCounts = {
  pending: 1,
  indexing: 0,
  indexed: 2,
  stale: 0,
  failed: 0,
};

function nodeStatusEvent(
  overrides: Partial<CorpusIndexEvent> & Pick<CorpusIndexEvent, 'nodeId' | 'indexStatus'>,
): CorpusIndexEvent {
  return {
    kind: 'node_status',
    at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('patchIndexStatusCounts', () => {
  it('moves one count from previous status to the new status', () => {
    const next = patchIndexStatusCounts(
      baseCounts,
      nodeStatusEvent({
        nodeId: 'node-1',
        indexStatus: 'indexing',
        previousIndexStatus: 'pending',
      }),
    );

    expect(next).toEqual({
      pending: 0,
      indexing: 1,
      indexed: 2,
      stale: 0,
      failed: 0,
    });
  });

  it('increments the target bucket when there is no previous status', () => {
    const next = patchIndexStatusCounts(
      baseCounts,
      nodeStatusEvent({ nodeId: 'node-1', indexStatus: 'pending' }),
    );

    expect(next.pending).toBe(2);
  });

  it('clamps previous bucket at zero', () => {
    const next = patchIndexStatusCounts(
      { ...baseCounts, pending: 0 },
      nodeStatusEvent({
        nodeId: 'node-1',
        indexStatus: 'indexing',
        previousIndexStatus: 'pending',
      }),
    );

    expect(next.pending).toBe(0);
    expect(next.indexing).toBe(1);
  });
});

describe('patchNodeIndexStatus', () => {
  it('updates only the matching node', () => {
    const nodes = [
      {
        id: 'a',
        indexStatus: 'pending',
      },
      {
        id: 'b',
        indexStatus: 'indexed',
      },
    ] as const;

    const next = patchNodeIndexStatus(
      [...nodes] as unknown as Parameters<typeof patchNodeIndexStatus>[0],
      nodeStatusEvent({ nodeId: 'a', indexStatus: 'indexing', previousIndexStatus: 'pending' }),
    );

    expect(next[0]?.indexStatus).toBe('indexing');
    expect(next[1]?.indexStatus).toBe('indexed');
  });
});
