import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SearchResultList } from '../src/search-result-list.js';

describe('SearchResultList', () => {
  it('shows ranking diagnostics when ranking metadata is provided', () => {
    const html = renderToStaticMarkup(
      <SearchResultList
        results={[
          {
            chunkId: 'chunk-1',
            filePath: 'notes/alpha.md',
            headingPath: ['Intro'],
            bodyPreview: 'Preview text',
            score: 0.5,
            matchKind: 'both',
            ranking: {
              strategyId: 'reranker_llm',
              strategyVersion: '1',
              componentScores: { hybrid: 0.5, llmRerank: 1 },
              operationUsage: {
                provider: 'openai-compatible',
                model: 'gpt-test',
                operationType: 'rerank',
                inputTokens: 20,
                outputTokens: 2,
                requestCount: 1,
                latencyMs: 50,
              },
            },
          },
        ]}
      />,
    );

    expect(html).toContain('Preview text');
    expect(html).toContain('Ranking trace (reranker_llm v1)');
    expect(html).toContain('20 in');
    expect(html).toContain('2 out');
  });

  it('uses renderFileLink when provided and corpusId is set', () => {
    const html = renderToStaticMarkup(
      <SearchResultList
        renderFileLink={(result) => (
          <a href={`/files/${result.corpusId}?path=${result.filePath}`}>{result.filePath}</a>
        )}
        results={[
          {
            chunkId: 'chunk-1',
            corpusId: 'corpus-a',
            filePath: 'notes/alpha.md',
            headingPath: [],
            bodyPreview: 'Preview text',
            score: 0.5,
            matchKind: 'keyword',
          },
        ]}
      />,
    );

    expect(html).toContain('href="/files/corpus-a?path=notes/alpha.md"');
    expect(html).not.toContain('<strong');
  });
});
