import {
  asWorkspaceId,
  type BlobStore,
  type ChatProvider,
  type KnowledgeWorkspaceScope,
} from '@evu/kb-core';
import { resolveDatabaseUrl } from '@evu/kb-db';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';

import { assertTokenPepperConfigured, isHttpAuthRequired } from './auth/http-auth.js';
import { bootstrapOperatorApiKeyIfNeeded } from './auth/operator-auth.js';
import { ApiError, type ApiErrorBody } from './errors.js';
import { probeBlobStore } from './health-probes.js';
import { resolveMaxUploadBytes } from './limits.js';
import { isMcpTokenRequired } from './mcp/context.js';
import { mcpRoutesPlugin } from './mcp/register-mcp.js';
import { workspaceCollectionRoutesPlugin } from './routes/workspace-collection-routes.js';
import { createEvuKbRuntime } from './runtime/create-runtime.js';
import type { EvuKbRuntime } from './runtime/types.js';
import { registerHealthRoutes } from './server/health-routes.js';
import { registerWorkspaceRoutes } from './server/workspace-routes.js';

export type EvuKbServerOptions = {
  blobRoot?: string;
  bootstrapDevWorkspace?: boolean;
  chatProvider?: ChatProvider | null;
  connectionString?: string;
  logger?: boolean;
  maxUploadBytes?: number;
  scope?: KnowledgeWorkspaceScope;
  rankingRegistry?: import('@evu/kb-core').RankingStrategyRegistry;
  postRankHandlers?: import('./search/post-rank-registry.js').PostRankHandlerRegistry;
};

declare module 'fastify' {
  interface FastifyInstance {
    evuKbBlobStore: BlobStore | null;
    evuKbRuntime: EvuKbRuntime | null;
  }

  interface FastifyRequest {
    evuKbWorkspace: import('@evu/kb-core').Workspace;
    evuKbActor: import('./auth/http-auth.js').HttpAuthActor;
  }
}

export async function createEvuKbServer(
  options: EvuKbServerOptions = {},
): Promise<FastifyInstance> {
  if (isHttpAuthRequired() || isMcpTokenRequired()) {
    assertTokenPepperConfigured();
  }
  const scope = options.scope ?? { workspaceId: asWorkspaceId('local-dev') };
  const connectionString =
    options.connectionString ?? (process.env.EVUKB_DATABASE_URL ? resolveDatabaseUrl() : undefined);
  const blobRoot = options.blobRoot ?? process.env.EVUKB_BLOB_ROOT;
  const blobProbe = probeBlobStore(blobRoot);
  const runtime = await createEvuKbRuntime({
    ...(connectionString ? { connectionString } : {}),
    ...(blobRoot ? { blobRoot } : {}),
    ...(options.chatProvider !== undefined ? { chatProvider: options.chatProvider } : {}),
    ...(options.bootstrapDevWorkspace !== undefined
      ? { bootstrapDevWorkspace: options.bootstrapDevWorkspace }
      : {}),
    ...(options.rankingRegistry ? { rankingRegistry: options.rankingRegistry } : {}),
    ...(options.postRankHandlers ? { postRankHandlers: options.postRankHandlers } : {}),
  });

  const logLevel = process.env.EVUKB_LOG_LEVEL?.trim();
  const server = Fastify({
    logger: options.logger ?? (logLevel ? { level: logLevel } : true),
  });
  server.decorate('evuKbBlobStore', blobProbe.store);
  server.decorate('evuKbRuntime', runtime);

  if (isHttpAuthRequired()) {
    bootstrapOperatorApiKeyIfNeeded(process.env, {
      info: (_payload, message) => {
        server.log.info(message);
      },
    });
  }

  const webOrigin = process.env.EVUKB_WEB_ORIGIN;
  if (webOrigin) {
    server.addHook('onRequest', async (request, reply) => {
      reply.header('Access-Control-Allow-Origin', webOrigin);
      reply.header(
        'Access-Control-Allow-Headers',
        'authorization, content-type, x-evukb-workspace-id, mcp-session-id, mcp-protocol-version',
      );
      reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      if (request.method === 'OPTIONS') {
        await reply.code(204).send();
      }
    });
  }

  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      const body: ApiErrorBody = {
        error: error.message,
        code: error.code,
      };
      reply.code(error.statusCode).send(body);
      return;
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    const code = (error as { code?: string }).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      const body: ApiErrorBody = {
        error: ApiError.payloadTooLarge(resolveMaxUploadBytes()).message,
        code: 'payload_too_large',
      };
      reply.code(413).send(body);
      return;
    }

    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const body: ApiErrorBody = {
        error: error instanceof Error ? error.message : 'Request failed.',
        code: 'validation_error',
      };
      reply.code(statusCode).send(body);
      return;
    }

    server.log.error(error);
    reply.code(500).send({
      error: 'Internal server error.',
      code: 'internal_error',
    } satisfies ApiErrorBody);
  });

  server.addHook('onClose', async () => {
    if (runtime?.jobQueue) {
      await runtime.jobQueue.waitForIdle().catch(() => undefined);
      await runtime.jobQueue.stop();
    }
    await runtime?.db.close();
  });

  registerHealthRoutes(server, { blobRoot, connectionString, runtime, scope });

  if (runtime) {
    const maxUploadBytes = options.maxUploadBytes ?? resolveMaxUploadBytes();
    server.addContentTypeParser(
      ['application/octet-stream', 'text/plain'],
      { parseAs: 'buffer' },
      (_request, body, done) => {
        done(null, body);
      },
    );

    await server.register(multipart, {
      limits: {
        fileSize: maxUploadBytes,
        files: 1,
      },
    });

    await server.register(workspaceCollectionRoutesPlugin, {
      prefix: '/api',
      corpora: runtime.corpora,
      tokenAuth: runtime.tokenAuth,
      workspaces: runtime.workspaces,
    });

    await registerWorkspaceRoutes(server, {
      blobRoot,
      chatProvider: options.chatProvider,
      connectionString,
      maxUploadBytes,
      runtime,
    });

    await server.register(mcpRoutesPlugin, { runtime });
  }

  return server;
}

export { resolveChatProvider } from './adapters/openai-chat.js';
export { resolveEmbeddingProvider } from './adapters/openai-embedding.js';
export { resolveVectorBackend, resolveVectorStore } from './adapters/resolve-vector-store.js';
export { ApiError } from './errors.js';
export {
  JobQueueError,
  type JobQueueErrorCode,
  JobQueueService,
  waitForJobIdle,
} from './jobs/job-queue-service.js';
export { resolveMaxUploadBytes } from './limits.js';
export { buildOpenApiDocument } from './openapi/index.js';
export { createEvuKbRuntime } from './runtime/create-runtime.js';
export type { EvuKbRuntime } from './runtime/types.js';
export type { EvuKbHealth } from './server/health-routes.js';
export { AgentWriteService } from './services/agent-write-service.js';
export { AskService } from './services/ask-service.js';
export { CitationValidateService } from './services/citation-validate-service.js';
export { CorpusStatsService } from './services/corpus-stats-service.js';
export { GitSyncService } from './services/git-sync-service.js';
export { IndexJobService } from './services/index-job-service.js';
export { IndexService } from './services/index-service.js';
export { KbToolService } from './services/kb-tool-service.js';
export { LinkGraphService } from './services/link-graph-service.js';
export { MountSyncService } from './services/mount-sync-service.js';
export { MutationApprovalService } from './services/mutation-approval-service.js';
export { OkfMaintenanceService } from './services/okf-maintenance-service.js';
export { OkfService } from './services/okf-service.js';
export { PortableService } from './services/portable-service.js';
export { SearchService } from './services/search-service.js';
export { SyncImportService } from './services/sync-import-service.js';
export { TokenAuthService } from './services/token-auth-service.js';
