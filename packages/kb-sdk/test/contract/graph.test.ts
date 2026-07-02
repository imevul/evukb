import { describe, expect, it } from 'vitest';

import {
  apiErrorCases,
  BASE_URL,
  CORPUS,
  createHarness,
  expectJsonRequestHeaders,
  expectStandardApiError,
  jsonResponse,
  WS,
} from './harness.js';

const corpusBase = `${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}`;
const graph = { nodes: [], edges: [], truncated: false };

describe('graph contract', () => {
  it('getLinkGraph issues GET .../link-graph without query by default', async () => {
    const harness = createHarness(() => jsonResponse(graph));
    await expect(harness.client.getLinkGraph(WS, CORPUS)).resolves.toEqual(graph);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/link-graph`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('getLinkGraph forwards folderPrefix and limit query params', async () => {
    const harness = createHarness(() => jsonResponse(graph));
    await harness.client.getLinkGraph(WS, CORPUS, { folderPrefix: 'guides', limit: 50 });
    expect(harness.lastRequest().url).toBe(`${corpusBase}/link-graph?folderPrefix=guides&limit=50`);
  });

  it('getGraphNeighborhood issues GET .../nodes/{nodeId}/graph/neighborhood', async () => {
    const neighborhood = { centerNodeId: 'node-1', ...graph };
    const harness = createHarness(() => jsonResponse(neighborhood));
    await expect(harness.client.getGraphNeighborhood(WS, CORPUS, 'node-1')).resolves.toEqual(
      neighborhood,
    );
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes/node-1/graph/neighborhood`);
    expect(request.method).toBe('GET');
  });

  it('getGraphNeighborhood forwards depth and limit query params', async () => {
    const harness = createHarness(() => jsonResponse({ centerNodeId: 'node-1', ...graph }));
    await harness.client.getGraphNeighborhood(WS, CORPUS, 'node one', { depth: 2, limit: 10 });
    expect(harness.lastRequest().url).toBe(
      `${corpusBase}/nodes/node%20one/graph/neighborhood?depth=2&limit=10`,
    );
  });

  it('listNodeLinks issues GET .../nodes/{nodeId}/links', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await expect(harness.client.listNodeLinks(WS, CORPUS, 'node-1')).resolves.toEqual([]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes/node-1/links`);
    expect(request.method).toBe('GET');
  });

  it.each(
    apiErrorCases([
      ['getLinkGraph', (client) => client.getLinkGraph(WS, CORPUS)],
      ['getGraphNeighborhood', (client) => client.getGraphNeighborhood(WS, CORPUS, 'n')],
      ['listNodeLinks', (client) => client.listNodeLinks(WS, CORPUS, 'n')],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
