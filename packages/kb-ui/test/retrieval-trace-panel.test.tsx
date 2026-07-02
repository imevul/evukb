import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RetrievalTracePanel } from '../src/retrieval-trace-panel.js';

describe('RetrievalTracePanel', () => {
  it('renders trace fields inside a collapsed details element', () => {
    const html = renderToStaticMarkup(
      <RetrievalTracePanel
        trace={{
          query: 'alpha fixture',
          strategyId: 'hybrid_default_v1',
          candidateCount: 8,
          selectedCount: 3,
        }}
        model="gpt-test"
        usedChunks={[
          {
            chunkId: 'chunk-1',
            filePath: 'notes/alpha.md',
            score: 0.42,
            componentScores: { keyword: 0.4 },
          },
        ]}
      />,
    );

    expect(html).toContain('Retrieval diagnostics');
    expect(html).toContain('alpha fixture');
    expect(html).toContain('hybrid_default_v1');
    expect(html).toContain('notes/alpha.md');
  });
});
