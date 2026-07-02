import { describe, expect, it } from 'vitest';

import { appRouteTable, isCorpusDetailPath, isWideLayoutPath } from '../src/routes.js';

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

  it('applies the wide layout only to diagnostics, corpus files, and corpus graph', () => {
    expect(isWideLayoutPath('/diagnostics')).toBe(true);
    expect(isWideLayoutPath('/knowledge/c1/files')).toBe(true);
    expect(isWideLayoutPath('/knowledge/c1/graph')).toBe(true);
    expect(isWideLayoutPath('/knowledge/c1/overview')).toBe(false);
    expect(isWideLayoutPath('/knowledge/c1/search')).toBe(false);
    expect(isWideLayoutPath('/knowledge/c1/links')).toBe(false);
    expect(isWideLayoutPath('/knowledge/c1/ask')).toBe(false);
    expect(isWideLayoutPath('/knowledge')).toBe(false);
    expect(isWideLayoutPath('/settings/workspace')).toBe(false);
  });
});
