import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  createTestApiKey,
  databaseUrl,
  describeIfDb,
  requireDatabaseUrl,
} from './helpers.js';

describeIfDb('kb-server workspace collection routes', () => {
  it('lists, creates, and deletes empty workspaces with auth rules', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-workspaces-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: requireDatabaseUrl(),
        bootstrapDevWorkspace: false,
      });

      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces',
      });
      expect(listResponse.statusCode).toBe(200);
      expect(Array.isArray(listResponse.json())).toBe(true);

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: { slug: 'ops-ui', name: 'Ops UI' },
      });
      expect(createResponse.statusCode).toBe(200);
      expect(createResponse.json()).toMatchObject({
        slug: 'ops-ui',
        name: 'Ops UI',
      });

      const duplicateResponse = await server.inject({
        method: 'POST',
        url: '/api/workspaces',
        payload: { slug: 'ops-ui', name: 'Duplicate' },
      });
      expect(duplicateResponse.statusCode).toBe(409);

      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: '/api/workspaces/ops-ui',
      });
      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json()).toMatchObject({ deleted: true, slug: 'ops-ui' });
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('restricts non-admin API keys to their workspace on list and forbids create', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-workspaces-auth-'));
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: requireDatabaseUrl(),
        bootstrapDevWorkspace: true,
      });

      const readKey = await createTestApiKey('local-dev', 'Read key', ['kb:read']);
      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces',
        headers: { authorization: `Bearer ${readKey}` },
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json()).toHaveLength(1);
      expect(listResponse.json()[0]?.slug).toBe('local-dev');

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/workspaces',
        headers: { authorization: `Bearer ${readKey}` },
        payload: { slug: 'blocked', name: 'Blocked' },
      });
      expect(createResponse.statusCode).toBe(403);
    } finally {
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
