import { describe, expect, it, vi } from 'vitest';

import { type EvuKbApiError, EvuKbClient } from '../src/index.js';

describe('EvuKbClient', () => {
  it('uses default fetch without illegal invocation', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'ok', service: 'evukb-api' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new EvuKbClient({ baseUrl: 'http://evukb.local' });
    await expect(client.health()).resolves.toEqual({ status: 'ok', service: 'evukb-api' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://evukb.local/health');
  });

  it('builds workspace-scoped corpus list URLs', async () => {
    let requestedUrl = '';
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify([{ id: 'corpus-1', name: 'Docs' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    const corpora = await client.listCorpora('local-dev');
    expect(requestedUrl).toBe('http://evukb.local/api/workspaces/local-dev/knowledge-corpora');
    expect(corpora).toEqual([{ id: 'corpus-1', name: 'Docs' }]);
  });

  it('surfaces API error codes from JSON responses', async () => {
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: 'Chat provider is not configured.',
            code: 'service_unavailable',
          }),
          {
            status: 503,
            headers: { 'content-type': 'application/json' },
          },
        ),
    });

    await expect(client.ask('local-dev', 'corpus-1', { question: 'Hello?' })).rejects.toMatchObject(
      {
        status: 503,
        code: 'service_unavailable',
      } satisfies Partial<EvuKbApiError>,
    );
  });

  it('reads node content as text', async () => {
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async (input, init) => {
        expect(String(input)).toContain('/nodes/node-1/content');
        expect(init?.headers).toMatchObject({ accept: 'text/plain' });
        return new Response('# Hello', { status: 200 });
      },
    });

    await expect(client.readNodeContent('local-dev', 'corpus-1', 'node-1')).resolves.toBe(
      '# Hello',
    );
  });

  it('deletes a corpus with workspace-scoped DELETE URL', async () => {
    let requestedUrl = '';
    let method = '';
    let headers: HeadersInit | undefined;
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async (input, init) => {
        requestedUrl = String(input);
        method = init?.method ?? 'GET';
        headers = init?.headers;
        return new Response(null, { status: 204 });
      },
    });

    await client.deleteCorpus('local-dev', 'corpus-1');
    expect(method).toBe('DELETE');
    expect(requestedUrl).toBe(
      'http://evukb.local/api/workspaces/local-dev/knowledge-corpora/corpus-1',
    );
    expect(headers).toMatchObject({ accept: 'application/json' });
    expect(headers).not.toHaveProperty('content-type');
  });

  it('renames and moves nodes with PATCH URLs', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: init?.body ? String(init.body) : undefined,
        });
        return new Response(JSON.stringify({ id: 'node-1', name: 'Renamed.md' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    await client.renameNode('local-dev', 'corpus-1', 'node-1', 'Renamed.md');
    await client.moveNode('local-dev', 'corpus-1', 'node-1', 'guides');
    expect(calls[0]).toMatchObject({
      method: 'PATCH',
      url: 'http://evukb.local/api/workspaces/local-dev/knowledge-corpora/corpus-1/nodes/node-1',
    });
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ name: 'Renamed.md' });
    expect(calls[1]).toMatchObject({
      method: 'PATCH',
      url: 'http://evukb.local/api/workspaces/local-dev/knowledge-corpora/corpus-1/nodes/node-1/move',
    });
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({ path: 'guides' });
  });

  it('bulk deletes nodes with DELETE body', async () => {
    let method = '';
    let body = '';
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async (_input, init) => {
        method = init?.method ?? 'GET';
        body = init?.body ? String(init.body) : '';
        return new Response(JSON.stringify({ deleted: 2 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    await expect(
      client.deleteNodes('local-dev', 'corpus-1', ['node-1', 'node-2']),
    ).resolves.toEqual({ deleted: 2 });
    expect(method).toBe('DELETE');
    expect(JSON.parse(body)).toEqual({ nodeIds: ['node-1', 'node-2'] });
  });
});
