import { describe, expect, it } from 'vitest';

import {
  BASE_URL,
  CORPUS,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  WS,
} from './harness.js';

const stats = {
  corpusId: CORPUS,
  workspaceId: WS,
  fileCount: 10,
  chunkCount: 42,
  totalBytes: 1024,
  indexStatusCounts: { pending: 0, indexing: 0, indexed: 10, stale: 0, failed: 0 },
  linkCounts: { total: 5, internal: 4, resolved: 4, unresolved: 1 },
  okfIssueCount: 0,
  citationIssueCount: 0,
  pendingJobCount: 0,
  failedJobCount: 0,
  warnings: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('stats contract', () => {
  it('getCorpusStats issues GET .../knowledge-corpora/{corpusId}/stats', async () => {
    const harness = createHarness(() => jsonResponse(stats));
    await expect(harness.client.getCorpusStats(WS, CORPUS)).resolves.toEqual(stats);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}/stats`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('getCorpusStats surfaces JSON API errors as EvuKbApiError', async () => {
    await expectStandardApiError((client) => client.getCorpusStats(WS, CORPUS));
  });
});
