import { describe, expect, it } from 'vitest';

import type { SearchRequest, WorkspaceSearchRequest } from '../../src/index.js';
import {
  apiErrorCases,
  BASE_URL,
  CORPUS,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  parseJsonBody,
  WS,
} from './harness.js';

const searchResult = {
  chunkId: 'chunk-1',
  nodeId: 'node-1',
  corpusId: CORPUS,
  workspaceId: WS,
  filePath: 'guides/note.md',
  headingPath: ['Intro'],
  bodyPreview: 'Hello',
  score: 0.9,
  matchKind: 'both',
};

describe('search contract', () => {
  it('search issues POST .../knowledge-corpora/{corpusId}/search with JSON body', async () => {
    const harness = createHarness(() => jsonResponse([searchResult]));
    const body: SearchRequest = {
      query: 'hello',
      pathPrefix: 'guides',
      limit: 5,
      filters: { tags: ['howto'] },
      rankingStrategyId: 'default',
    };
    await expect(harness.client.search(WS, CORPUS, body)).resolves.toEqual([searchResult]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}/search`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('searchWorkspace issues POST /api/workspaces/{workspaceId}/search with corpusIds', async () => {
    const harness = createHarness(() => jsonResponse([]));
    const body: WorkspaceSearchRequest = { query: 'hello', corpusIds: ['corpus-1', 'corpus-2'] };
    await expect(harness.client.searchWorkspace(WS, body)).resolves.toEqual([]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/search`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it.each(
    apiErrorCases([
      ['search', (client) => client.search(WS, CORPUS, { query: 'x' })],
      ['searchWorkspace', (client) => client.searchWorkspace(WS, { query: 'x', corpusIds: [] })],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
