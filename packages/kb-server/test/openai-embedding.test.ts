import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EmbeddingRequestError,
  OpenAiEmbeddingProvider,
} from '../src/adapters/openai-embedding.js';

describe('OpenAiEmbeddingProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('batches embedding requests', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] };
      return new Response(
        JSON.stringify({
          data: body.input.map(() => ({ embedding: [0.1, 0.2] })),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiEmbeddingProvider({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1',
      batchSize: 2,
      maxRetries: 0,
    });

    const result = await provider.embed(['a', 'b', 'c', 'd', 'e']);

    expect(result).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries transient embedding failures', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response('no available server', { status: 503 });
      }
      return new Response(JSON.stringify({ data: [{ embedding: [0.5] }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiEmbeddingProvider({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1',
      batchSize: 1,
      maxRetries: 2,
    });

    const result = await provider.embed(['hello']);

    expect(result).toEqual([[0.5]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('includes response body in embedding errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no available server', { status: 503 })),
    );

    const provider = new OpenAiEmbeddingProvider({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1',
      batchSize: 1,
      maxRetries: 0,
    });

    await expect(provider.embed(['hello'])).rejects.toThrow(
      'Embedding request failed with status 503: no available server',
    );
  });

  it('does not retry non-transient failures', async () => {
    const fetchMock = vi.fn(async () => new Response('bad request', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAiEmbeddingProvider({
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1',
      batchSize: 1,
      maxRetries: 3,
    });

    await expect(provider.embed(['hello'])).rejects.toBeInstanceOf(EmbeddingRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
