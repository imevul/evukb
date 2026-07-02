import { describe, expect, it } from 'vitest';

import type { CreateFileRequest, CreateFolderRequest } from '../../src/index.js';
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

const corpusBase = `${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}`;
const node = { id: 'node-1', corpusId: CORPUS, name: 'Note.md', nodeType: 'file' };

describe('node contract', () => {
  it('listNodes issues GET .../nodes?format=flat by default', async () => {
    const harness = createHarness(() => jsonResponse([node]));
    await expect(harness.client.listNodes(WS, CORPUS)).resolves.toEqual([node]);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes?format=flat`);
    expect(request.method).toBe('GET');
    expectJsonRequestHeaders(request, false);
  });

  it('listNodes forwards format=tree', async () => {
    const harness = createHarness(() => jsonResponse([]));
    await harness.client.listNodes(WS, CORPUS, 'tree');
    expect(harness.lastRequest().url).toBe(`${corpusBase}/nodes?format=tree`);
  });

  it('readNodeContent issues GET .../nodes/{nodeId}/content with text accept header', async () => {
    const harness = createHarness(() => new Response('# Hello', { status: 200 }));
    await expect(harness.client.readNodeContent(WS, CORPUS, 'node one')).resolves.toBe('# Hello');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes/node%20one/content`);
    expect(request.method).toBe('GET');
    expect(request.headers.get('accept')).toBe('text/plain');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
  });

  it('saveNodeContent issues PUT with text/plain body', async () => {
    const harness = createHarness(() => jsonResponse(node));
    await expect(
      harness.client.saveNodeContent(WS, CORPUS, 'node-1', '# Updated'),
    ).resolves.toEqual(node);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes/node-1/content`);
    expect(request.method).toBe('PUT');
    expect(request.headers.get('content-type')).toBe('text/plain');
    expect(request.headers.get('accept')).toBe('application/json');
    expect(request.body).toBe('# Updated');
  });

  it('createFile issues POST .../files with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(node, 201));
    const body: CreateFileRequest = {
      path: 'guides',
      name: 'Note.md',
      content: '# Note',
      mimeType: 'text/markdown',
    };
    await harness.client.createFile(WS, CORPUS, body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/files`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('createFolder issues POST .../folders with JSON body', async () => {
    const harness = createHarness(() => jsonResponse(node, 201));
    const body: CreateFolderRequest = { name: 'guides' };
    await harness.client.createFolder(WS, CORPUS, body);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/folders`);
    expect(request.method).toBe('POST');
    expect(parseJsonBody(request)).toEqual(body);
  });

  it('renameNode issues PATCH .../nodes/{nodeId} with name body', async () => {
    const harness = createHarness(() => jsonResponse(node));
    await harness.client.renameNode(WS, CORPUS, 'node-1', 'Renamed.md');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes/node-1`);
    expect(request.method).toBe('PATCH');
    expect(parseJsonBody(request)).toEqual({ name: 'Renamed.md' });
  });

  it('moveNode issues PATCH .../nodes/{nodeId}/move with path body', async () => {
    const harness = createHarness(() => jsonResponse(node));
    await harness.client.moveNode(WS, CORPUS, 'node-1', 'guides/archive');
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes/node-1/move`);
    expect(request.method).toBe('PATCH');
    expect(parseJsonBody(request)).toEqual({ path: 'guides/archive' });
  });

  it('deleteNodes issues DELETE .../nodes with nodeIds body', async () => {
    const harness = createHarness(() => jsonResponse({ deleted: 2 }));
    await expect(harness.client.deleteNodes(WS, CORPUS, ['node-1', 'node-2'])).resolves.toEqual({
      deleted: 2,
    });
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/nodes`);
    expect(request.method).toBe('DELETE');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual({ nodeIds: ['node-1', 'node-2'] });
  });

  it.each(
    apiErrorCases([
      ['listNodes', (client) => client.listNodes(WS, CORPUS)],
      ['readNodeContent', (client) => client.readNodeContent(WS, CORPUS, 'n')],
      ['saveNodeContent', (client) => client.saveNodeContent(WS, CORPUS, 'n', 'x')],
      ['createFile', (client) => client.createFile(WS, CORPUS, { name: 'a.md', content: '' })],
      ['createFolder', (client) => client.createFolder(WS, CORPUS, { name: 'a' })],
      ['renameNode', (client) => client.renameNode(WS, CORPUS, 'n', 'b.md')],
      ['moveNode', (client) => client.moveNode(WS, CORPUS, 'n', 'p')],
      ['deleteNodes', (client) => client.deleteNodes(WS, CORPUS, ['n'])],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
