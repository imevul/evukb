import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import { createTestApiKey, describeIfDb, requireDatabaseUrl } from './helpers.js';

describeIfDb('kb-server operator API key auth', () => {
  it('accepts operator bearer on any workspace route', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-operator-auth-'));
    const operatorKey = 'evukb_ops_integration_test_key';
    const previousOperatorKey = process.env.EVUKB_OPERATOR_API_KEY;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.EVUKB_OPERATOR_API_KEY = operatorKey;
    process.env.NODE_ENV = 'production';
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: requireDatabaseUrl(),
        bootstrapDevWorkspace: true,
      });

      const listResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces',
        headers: { authorization: `Bearer ${operatorKey}` },
      });
      expect(listResponse.statusCode).toBe(200);

      const settingsResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/settings',
        headers: { authorization: `Bearer ${operatorKey}` },
      });
      expect(settingsResponse.statusCode).toBe(200);
    } finally {
      if (previousOperatorKey === undefined) {
        delete process.env.EVUKB_OPERATOR_API_KEY;
      } else {
        process.env.EVUKB_OPERATOR_API_KEY = previousOperatorKey;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });

  it('still enforces workspace match for workspace-scoped API keys', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-operator-scoped-'));
    const operatorKey = 'evukb_ops_scoped_mismatch_test';
    const previousOperatorKey = process.env.EVUKB_OPERATOR_API_KEY;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.EVUKB_OPERATOR_API_KEY = operatorKey;
    process.env.NODE_ENV = 'production';
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: requireDatabaseUrl(),
        bootstrapDevWorkspace: true,
      });

      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/workspaces',
        headers: { authorization: `Bearer ${operatorKey}` },
        payload: { slug: 'ops-scoped-test', name: 'Ops scoped test' },
      });
      expect(createResponse.statusCode).toBe(200);

      const readKey = await createTestApiKey('local-dev', 'Read key', ['kb:read']);
      const mismatchResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces/ops-scoped-test/settings',
        headers: { authorization: `Bearer ${readKey}` },
      });
      expect(mismatchResponse.statusCode).toBe(403);
    } finally {
      if (previousOperatorKey === undefined) {
        delete process.env.EVUKB_OPERATOR_API_KEY;
      } else {
        process.env.EVUKB_OPERATOR_API_KEY = previousOperatorKey;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
