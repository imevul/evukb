import { describe, expect, it } from 'vitest';

import {
  apiErrorCases,
  BASE_URL,
  CORPUS,
  createHarness,
  expectStandardApiError,
  jsonResponse,
  WS,
} from './harness.js';

const corpusBase = `${BASE_URL}/api/workspaces/${WS}/knowledge-corpora/${CORPUS}`;

const importResult = {
  imported: 3,
  updated: 1,
  skipped: 0,
  linksRestored: 2,
  indexed: 3,
  warnings: [],
  errors: [],
  mode: 'portable',
};

describe('portable contract', () => {
  it('exportPortableZip issues GET .../export with zip accept header', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const harness = createHarness(
      () => new Response(bytes, { status: 200, headers: { 'content-type': 'application/zip' } }),
    );
    const result = await harness.client.exportPortableZip(WS, CORPUS);
    expect(new Uint8Array(result)).toEqual(bytes);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/export`);
    expect(request.method).toBe('GET');
    expect(request.headers.get('accept')).toBe('application/zip');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
  });

  it('importPortableZip POSTs multipart form data with the archive field', async () => {
    const harness = createHarness(() => jsonResponse(importResult));
    const file = new File(['zip-bytes'], 'my-corpus.evukb.zip', { type: 'application/zip' });
    await expect(harness.client.importPortableZip(WS, CORPUS, file)).resolves.toEqual(importResult);
    const request = harness.lastRequest();
    expect(request.url).toBe(`${corpusBase}/import`);
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
    // fetch must set the multipart boundary itself; the SDK must not set content-type.
    expect(request.headers.get('content-type')).toBeNull();
    expect(request.body).toBeInstanceOf(FormData);
    const formData = request.body as FormData;
    const archive = formData.get('archive');
    expect(archive).toBeInstanceOf(File);
    expect((archive as File).name).toBe('my-corpus.evukb.zip');
  });

  it('importPortableZip falls back to a default archive name for plain blobs', async () => {
    const harness = createHarness(() => jsonResponse(importResult));
    await harness.client.importPortableZip(WS, CORPUS, new Blob(['zip-bytes']));
    const formData = harness.lastRequest().body as FormData;
    expect((formData.get('archive') as File).name).toBe('import.evukb.zip');
  });

  it.each(
    apiErrorCases([
      ['exportPortableZip', (client) => client.exportPortableZip(WS, CORPUS)],
      ['importPortableZip', (client) => client.importPortableZip(WS, CORPUS, new Blob(['x']))],
    ]),
  )('%s surfaces JSON API errors as EvuKbApiError', async (_name, invoke) => {
    await expectStandardApiError(invoke);
  });
});
