import { describe, expect, it } from 'vitest';

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

describe('okf contract', () => {
  it('convertToOkf issues POST .../convert-to-okf with JSON body', async () => {
    const result = { dryRun: true, updated: 3, skipped: 1, warnings: [], readOnlyBlocked: [] };
    const harness = createHarness(() => jsonResponse(result));
    await expect(
      harness.client.convertToOkf(WS, CORPUS, { dryRun: true, synthesizeIndex: false }),
    ).resolves.toEqual(result);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/convert-to-okf`);
    expect(request.method).toBe('POST');
    expectJsonRequestHeaders(request, true);
    expect(parseJsonBody(request)).toEqual({ dryRun: true, synthesizeIndex: false });
  });

  it('convertToOkf sends an empty JSON object when no options are given', async () => {
    const harness = createHarness(() =>
      jsonResponse({ dryRun: false, updated: 0, skipped: 0, warnings: [], readOnlyBlocked: [] }),
    );
    await harness.client.convertToOkf(WS, CORPUS);
    expect(parseJsonBody(harness.lastRequest())).toEqual({});
  });

  it('exportOkfZip issues GET .../export-okf with zip accept header', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const harness = createHarness(
      () => new Response(bytes, { status: 200, headers: { 'content-type': 'application/zip' } }),
    );
    const result = await harness.client.exportOkfZip(WS, CORPUS);
    expect(new Uint8Array(result)).toEqual(bytes);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/export-okf`);
    expect(request.method).toBe('GET');
    expect(request.headers.get('accept')).toBe('application/zip');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
  });

  it.each(
    apiErrorCases([
      ['convertToOkf', (client) => client.convertToOkf(WS, CORPUS)],
      ['exportOkfZip', (client) => client.exportOkfZip(WS, CORPUS)],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
