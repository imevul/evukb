import { describe, expect, it } from 'vitest';

import type { Citation, CitationSourceType } from '../../src/index.js';
import { CORPUS, createHarness, jsonResponse, WS } from './harness.js';

describe('citation', () => {
  it('accepts all documented source types', () => {
    const sourceTypes: CitationSourceType[] = ['chunk', 'document', 'okf-citation', 'external-url'];
    expect(sourceTypes).toHaveLength(4);
  });

  it('round-trips citations from ask responses without transformation', async () => {
    const citation = {
      citationId: 'cite-1',
      corpusId: CORPUS,
      nodeId: 'node-1',
      chunkId: 'chunk-1',
      filePath: 'guides/note.md',
      headingPath: ['Intro'],
      title: 'Note',
      quote: 'Hello',
      sourceType: 'chunk',
    } satisfies Citation;
    const harness = createHarness(() =>
      jsonResponse({
        answer: 'Hi',
        citations: [citation],
        usedChunks: [],
        warnings: [],
        model: 'test-model',
        retrievalTrace: { query: 'q', strategyId: 'default', candidateCount: 1, selectedCount: 1 },
      }),
    );
    const response = await harness.client.ask(WS, CORPUS, { question: 'Hello?' });
    expect(response.citations).toEqual([citation]);
  });
});
