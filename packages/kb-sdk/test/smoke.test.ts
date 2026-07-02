import { describe, expect, it } from 'vitest';

import { EvuKbClient, evuKbSdkPackageName } from '../src/index.js';

describe('kb-sdk scaffold', () => {
  it('requests API health through an injected fetch implementation', async () => {
    const client = new EvuKbClient({
      baseUrl: 'http://evukb.local',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            blobStore: { status: 'ok', root: '/data' },
            database: { status: 'ok', migrationsApplied: 1 },
            scope: 'local-dev',
            service: 'evukb-api',
            status: 'ok',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    });

    await expect(client.health()).resolves.toMatchObject({
      service: 'evukb-api',
      status: 'ok',
    });
    expect(evuKbSdkPackageName).toBe('@evu/kb-sdk');
  });
});
