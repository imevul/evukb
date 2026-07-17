import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createEvuKbServer } from '../../src/index.js';

import {
  createStubChatProvider,
  databaseUrl,
  describeIfDb,
  requireDatabaseUrl,
} from './helpers.js';

describeIfDb('kb-server settings, diagnostics, and secrets routes', () => {
  it('returns settings, health probes, and manages secrets', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-settings-'));
    const secretsKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const previousSecretsKey = process.env.EVUKB_SECRETS_KEY;
    process.env.EVUKB_SECRETS_KEY = secretsKey;
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: true,
        chatProvider: createStubChatProvider(),
      });

      const settingsResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/settings',
      });
      expect(settingsResponse.statusCode).toBe(200);
      expect(settingsResponse.json()).toMatchObject({
        slug: 'local-dev',
        bootHints: {
          databaseConfigured: true,
          blobStoreConfigured: true,
          secretsKeyConfigured: true,
          mountAuthoritativeEnabled: expect.any(Boolean),
          importWritebackEnabled: expect.any(Boolean),
          gitWritebackEnabled: expect.any(Boolean),
        },
      });

      const patchResponse = await server.inject({
        method: 'PATCH',
        url: '/api/workspaces/local-dev/settings',
        payload: {
          settings: {
            rankingSettings: { keywordWeight: 0.8 },
          },
        },
      });
      expect(patchResponse.statusCode).toBe(200);
      expect(patchResponse.json().ranking.settings.keywordWeight).toBe(0.8);

      const providersResponse = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/ai/providers',
      });
      expect(providersResponse.statusCode).toBe(200);
      expect(providersResponse.json()).toHaveProperty('embedding');
      expect(providersResponse.json()).toHaveProperty('chat');

      const dbHealth = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/health/db',
      });
      expect(dbHealth.statusCode).toBe(200);
      expect(dbHealth.json().status).toBe('ok');

      const failedJobs = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/jobs/failed',
      });
      expect(failedJobs.statusCode).toBe(200);
      expect(Array.isArray(failedJobs.json())).toBe(true);

      const createSecret = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/secrets',
        payload: { name: 'git-token', value: 'secret-value-123' },
      });
      expect(createSecret.statusCode).toBe(201);
      expect(createSecret.json().value).toBe('secret-value-123');
      const secretId = createSecret.json().id as string;

      const listSecrets = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/secrets',
      });
      expect(listSecrets.statusCode).toBe(200);
      expect(listSecrets.json()).toHaveLength(1);
      expect(listSecrets.json()[0]).not.toHaveProperty('value');

      const rotateSecret = await server.inject({
        method: 'PATCH',
        url: `/api/workspaces/local-dev/secrets/${secretId}`,
        payload: { value: 'rotated-value-456' },
      });
      expect(rotateSecret.statusCode).toBe(200);
      expect(rotateSecret.json().id).toBe(secretId);
      expect(rotateSecret.json()).not.toHaveProperty('value');

      const deleteSecret = await server.inject({
        method: 'DELETE',
        url: `/api/workspaces/local-dev/secrets/${secretId}`,
      });
      expect(deleteSecret.statusCode).toBe(204);

      await server.close();
    } finally {
      if (previousSecretsKey === undefined) {
        delete process.env.EVUKB_SECRETS_KEY;
      } else {
        process.env.EVUKB_SECRETS_KEY = previousSecretsKey;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});

describeIfDb('kb-server HTTP API key auth', () => {
  it('enforces read and write scopes when auth is required', async () => {
    const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-http-auth-'));
    const previousRequire = process.env.EVUKB_REQUIRE_API_KEY;
    process.env.EVUKB_REQUIRE_API_KEY = 'true';
    try {
      const server = await createEvuKbServer({
        logger: false,
        blobRoot,
        connectionString: databaseUrl,
        bootstrapDevWorkspace: true,
        chatProvider: createStubChatProvider(),
      });

      const blocked = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/knowledge-corpora',
      });
      expect(blocked.statusCode).toBe(403);

      const { createDb, migrateLatest, ApiKeyRepository, WorkspaceRepository } = await import(
        '@evu/kb-db'
      );
      const { generateApiKeySecret, hashTokenSecret } = await import(
        '../../src/auth/token-hash.js'
      );
      const handle = createDb({ connectionString: requireDatabaseUrl() });
      await migrateLatest(handle);
      const workspaces = new WorkspaceRepository(handle);
      const workspace = await workspaces.getBySlug('local-dev');
      if (!workspace) {
        throw new Error('Expected local-dev workspace.');
      }
      const apiKeys = new ApiKeyRepository(handle);
      const readPlain = generateApiKeySecret();
      const writePlain = generateApiKeySecret();
      await apiKeys.create({
        workspaceId: workspace.id,
        name: 'read-only',
        hash: hashTokenSecret(readPlain),
        scopes: ['kb:read'],
        expiresAt: null,
      });
      await apiKeys.create({
        workspaceId: workspace.id,
        name: 'writer',
        hash: hashTokenSecret(writePlain),
        scopes: ['kb:write'],
        expiresAt: null,
      });
      await handle.close();

      const listCorpora = await server.inject({
        method: 'GET',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        headers: { authorization: `Bearer ${readPlain}` },
      });
      expect(listCorpora.statusCode).toBe(200);

      const createCorpus = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        headers: { authorization: `Bearer ${readPlain}` },
        payload: { name: 'Auth test corpus' },
      });
      expect(createCorpus.statusCode).toBe(403);

      const createCorpusWrite = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/knowledge-corpora',
        headers: { authorization: `Bearer ${writePlain}` },
        payload: { name: `Auth write corpus ${randomUUID()}` },
      });
      expect(createCorpusWrite.statusCode).toBe(201);

      const workspaceAskBlocked = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/ask',
        headers: { authorization: `Bearer ${readPlain}` },
        payload: { question: 'test', corpusIds: [createCorpusWrite.json().id] },
      });
      expect(workspaceAskBlocked.statusCode).toBe(200);

      const workspaceSearchAllowed = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/search',
        headers: { authorization: `Bearer ${readPlain}` },
        payload: { query: 'test', corpusIds: [createCorpusWrite.json().id] },
      });
      expect(workspaceSearchAllowed.statusCode).toBe(200);

      const approveBlocked = await server.inject({
        method: 'POST',
        url: '/api/workspaces/local-dev/approvals/00000000-0000-4000-8000-000000000001/approve',
        headers: { authorization: `Bearer ${readPlain}` },
      });
      expect(approveBlocked.statusCode).toBe(403);

      await server.close();
    } finally {
      if (previousRequire === undefined) {
        delete process.env.EVUKB_REQUIRE_API_KEY;
      } else {
        process.env.EVUKB_REQUIRE_API_KEY = previousRequire;
      }
      rmSync(blobRoot, { recursive: true, force: true });
    }
  });
});
