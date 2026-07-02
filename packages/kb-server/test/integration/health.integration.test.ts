import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import './helpers.js';

describe('kb-server health', () => {
  it('reports database and blob-store readiness', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-smoke-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
      });

      const response = await server.inject('/health');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        service: 'evukb-api',
        blobStore: {
          status: 'ok',
          root: blobRoot,
        },
      });

      await server.close();
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
