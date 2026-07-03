import { describe, expect, it } from 'vitest';

import { appRouteTable, isCorpusDetailPath } from '../src/routes.js';

describe('web app routes', () => {
  it('includes the primary knowledge routes from the sprint plan', () => {
    expect(appRouteTable.map((route) => route.path)).toEqual([
      '/knowledge',
      '/knowledge/:corpusId/overview',
      '/knowledge/:corpusId/files',
      '/knowledge/:corpusId/search',
      '/knowledge/:corpusId/links',
      '/knowledge/:corpusId/graph',
      '/knowledge/:corpusId/ask',
      '/ask',
      '/search',
      '/diagnostics',
      '/settings/overview',
      '/settings/workspace',
      '/settings/ai',
      '/settings/ranking',
      '/settings/secrets',
      '/settings/mcp-tokens',
      '/settings/api-keys',
      '/settings/audit',
    ]);
  });

  it('detects corpus detail paths', () => {
    expect(isCorpusDetailPath('/knowledge/c1/overview')).toBe(true);
    expect(isCorpusDetailPath('/knowledge/c1/search')).toBe(true);
    expect(isCorpusDetailPath('/knowledge/c1/links')).toBe(true);
    expect(isCorpusDetailPath('/knowledge')).toBe(false);
    expect(isCorpusDetailPath('/search')).toBe(false);
  });
});
