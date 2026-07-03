import { describeKnowledgeScope, type KnowledgeWorkspaceScope } from '@evu/kb-core';
import type { FastifyInstance } from 'fastify';

import { resolveChatProvider } from '../adapters/openai-chat.js';
import { resolveEmbeddingProvider } from '../adapters/openai-embedding.js';
import { resolveVectorBackend } from '../adapters/resolve-vector-store.js';
import { probeBlobStore, probeDatabase, probeProviders } from '../health-probes.js';
import type { EvuKbRuntime } from '../runtime/types.js';
import { readApiReferenceHtml } from './api-reference.js';

export type EvuKbHealth = {
  service: 'evukb-api';
  status: 'ok' | 'degraded';
  scope: string;
  database: {
    status: 'ok' | 'error' | 'not-configured';
    migrationsApplied?: number;
  };
  blobStore: {
    status: 'ok' | 'error' | 'not-configured';
    root?: string;
  };
};

export type HealthRouteOptions = {
  blobRoot?: string | undefined;
  connectionString?: string | undefined;
  runtime: EvuKbRuntime | null;
  scope: KnowledgeWorkspaceScope;
};

export function registerHealthRoutes(server: FastifyInstance, options: HealthRouteOptions): void {
  const { blobRoot, connectionString, runtime, scope } = options;

  server.get('/health', async (): Promise<EvuKbHealth> => {
    const currentDatabase = await probeDatabase(connectionString);
    const currentBlob = probeBlobStore(blobRoot);
    const status =
      currentDatabase.status === 'ok' && currentBlob.health.status === 'ok' ? 'ok' : 'degraded';

    return {
      service: 'evukb-api',
      status,
      scope: describeKnowledgeScope(scope),
      database: currentDatabase,
      blobStore: currentBlob.health,
    };
  });

  server.get('/health/db', async () => probeDatabase(connectionString));
  server.get('/health/blob-store', async () => probeBlobStore(blobRoot).health);
  server.get('/health/providers', async () =>
    probeProviders({
      embeddingProvider: resolveEmbeddingProvider(),
      chatProvider: resolveChatProvider(),
    }),
  );
  server.get('/health/vector-store', async () => {
    if (!runtime) {
      return {
        backend: resolveVectorBackend(),
        status: 'not-configured' as const,
        message: 'Database runtime is not configured.',
      };
    }
    return runtime.vectorStore.health();
  });

  server.get('/version', async () => ({
    name: 'EvuKB',
    version: '0.1.0',
  }));

  server.get('/api-reference', async (_request, reply) => {
    const html = readApiReferenceHtml();
    if (!html) {
      await reply.code(404).send({
        error: 'API reference is not bundled. Run pnpm generate-api-docs.',
        code: 'not_found',
      });
      return;
    }
    reply.header('content-type', 'text/html; charset=utf-8');
    await reply.send(html);
  });
}
