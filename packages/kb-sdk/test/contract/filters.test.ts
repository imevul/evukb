import { describe, expect, it } from 'vitest';

import type { KnowledgeFilters } from '../../src/index.js';
import { CORPUS, createHarness, jsonResponse, parseJsonBody, WS } from './harness.js';

describe('knowledge filters', () => {
  it('accepts the full documented filter shape', () => {
    const filters = {
      tags: ['howto', 'guide'],
      fileTypes: ['md'],
      okfType: 'concept',
      pathAllowlist: ['guides/'],
      frontmatter: { status: 'published' },
      sourceTypes: ['managed', 'git'],
      indexStatus: ['indexed', 'stale'],
    } satisfies KnowledgeFilters;
    expect(filters.tags).toHaveLength(2);
    expect(filters.sourceTypes).toContain('git');
  });

  it('serializes untouched inside search request bodies', async () => {
    const filters: KnowledgeFilters = {
      tags: ['howto'],
      frontmatter: { status: 'published' },
      indexStatus: ['indexed'],
    };
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.search(WS, CORPUS, { query: 'hello', filters });
    expect(parseJsonBody(harness.lastRequest())).toEqual({ query: 'hello', filters });
  });
});
