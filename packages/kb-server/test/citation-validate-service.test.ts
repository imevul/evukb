import { evaluateCitationUrlPolicy } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

describe('citation URL policy', () => {
  it('blocks metadata hostnames', () => {
    const result = evaluateCitationUrlPolicy('http://metadata.google.internal/computeMetadata/v1/');
    expect(result.allowed).toBe(false);
  });
});

describe('CitationValidateService fetch behavior', () => {
  it('uses HEAD/GET with timeout via mocked fetch', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({}, { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { CitationValidateService } = await import(
      '../src/services/citation-validate-service.js'
    );
    const service = new CitationValidateService({
      blobStore: {
        get: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                Buffer.from(
                  [
                    '---',
                    'type: Document',
                    '---',
                    '',
                    '## Citations',
                    '',
                    '- [Site](https://example.com/page)',
                  ].join('\n'),
                ),
              );
              controller.close();
            },
          }),
      },
      corpora: {
        getById: async () => ({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: { formatProfile: 'okf' },
        }),
      },
      nodes: {
        getById: async () => ({
          id: 'node-1',
          nodeType: 'file',
          storageRelPath: 'alpha.md',
          indexStatus: 'indexed',
          metadata: {},
        }),
        updateIndexStatus: async () => undefined,
      },
    });

    const result = await service.validateNode({
      workspaceId: 'ws-1',
      corpusId: 'corpus-1',
      nodeId: 'node-1',
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.status).toBe('valid');

    vi.unstubAllGlobals();
  });

  it('aborts fetch when citation validation exceeds timeout', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      setTimeout(() => controller.abort(), 50);
      return controller.signal;
    });

    const fetchMock = vi.fn(
      (_url, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { CitationValidateService } = await import(
      '../src/services/citation-validate-service.js'
    );
    const service = new CitationValidateService({
      blobStore: {
        get: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                Buffer.from(
                  [
                    '---',
                    'type: Document',
                    '---',
                    '',
                    '## Citations',
                    '',
                    '- [Slow](https://example.com/slow)',
                  ].join('\n'),
                ),
              );
              controller.close();
            },
          }),
      },
      corpora: {
        getById: async () => ({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: { formatProfile: 'okf' },
        }),
      },
      nodes: {
        getById: async () => ({
          id: 'node-1',
          nodeType: 'file',
          storageRelPath: 'alpha.md',
          indexStatus: 'indexed',
          metadata: {},
        }),
        updateIndexStatus: async () => undefined,
      },
    });

    const result = await service.validateNode({
      workspaceId: 'ws-1',
      corpusId: 'corpus-1',
      nodeId: 'node-1',
    });

    expect(result.entries[0]?.status).toBe('unreachable');

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('blocks private-network citation URLs before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { CitationValidateService } = await import(
      '../src/services/citation-validate-service.js'
    );
    const service = new CitationValidateService({
      blobStore: {
        get: async () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                Buffer.from(
                  [
                    '---',
                    'type: Document',
                    '---',
                    '',
                    '## Citations',
                    '',
                    '- [Local](http://127.0.0.1/admin)',
                  ].join('\n'),
                ),
              );
              controller.close();
            },
          }),
      },
      corpora: {
        getById: async () => ({
          id: 'corpus-1',
          workspaceId: 'ws-1',
          settings: { formatProfile: 'okf' },
        }),
      },
      nodes: {
        getById: async () => ({
          id: 'node-1',
          nodeType: 'file',
          storageRelPath: 'alpha.md',
          indexStatus: 'indexed',
          metadata: {},
        }),
        updateIndexStatus: async () => undefined,
      },
    });

    const result = await service.validateNode({
      workspaceId: 'ws-1',
      corpusId: 'corpus-1',
      nodeId: 'node-1',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.entries[0]?.status).toBe('blocked');

    vi.unstubAllGlobals();
  });
});
