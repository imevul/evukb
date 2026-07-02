import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OperationUsageSummary } from '../src/operation-usage-summary.js';

describe('OperationUsageSummary', () => {
  it('renders token and latency fields', () => {
    const html = renderToStaticMarkup(
      <OperationUsageSummary
        usage={{
          provider: 'openai-compatible',
          model: 'gpt-test',
          operationType: 'ask',
          inputTokens: 10,
          outputTokens: 5,
          requestCount: 1,
          latencyMs: 42,
        }}
      />,
    );

    expect(html).toContain('ask');
    expect(html).toContain('gpt-test');
    expect(html).toContain('10 in');
    expect(html).toContain('5 out');
    expect(html).toContain('42 ms');
  });
});
