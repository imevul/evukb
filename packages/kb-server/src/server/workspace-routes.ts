import type { ChatProvider } from '@evu/kb-core';
import type { FastifyInstance } from 'fastify';

import { resolveChatProvider } from '../adapters/openai-chat.js';
import { resolveEmbeddingProvider } from '../adapters/openai-embedding.js';
import { enforceHttpAuth } from '../auth/http-auth.js';
import { ApiError } from '../errors.js';
import { approvalRoutesPlugin } from '../routes/approval-routes.js';
import { askRoutesPlugin } from '../routes/ask-routes.js';
import { auditRoutesPlugin } from '../routes/audit-routes.js';
import { authRoutesPlugin } from '../routes/auth-routes.js';
import { citationRoutesPlugin } from '../routes/citation-routes.js';
import { corpusRoutesPlugin } from '../routes/corpus-routes.js';
import { diagnosticsRoutesPlugin } from '../routes/diagnostics-routes.js';
import { fileRoutesPlugin } from '../routes/file-routes.js';
import { indexRoutesPlugin } from '../routes/index-routes.js';
import { kbToolRoutesPlugin } from '../routes/kb-tool-routes.js';
import { linkRoutesPlugin } from '../routes/link-routes.js';
import { okfRoutesPlugin } from '../routes/okf-routes.js';
import { portableRoutesPlugin } from '../routes/portable-routes.js';
import { searchRoutesPlugin } from '../routes/search-routes.js';
import { secretRoutesPlugin } from '../routes/secret-routes.js';
import { settingsRoutesPlugin } from '../routes/settings-routes.js';
import { statsRoutesPlugin } from '../routes/stats-routes.js';
import { syncRoutesPlugin } from '../routes/sync-routes.js';
import { usageRoutesPlugin } from '../routes/usage-routes.js';
import type { EvuKbRuntime } from '../runtime/types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceRouteOptions = {
  blobRoot?: string | undefined;
  /** Explicit chat provider override; undefined means resolve from env. */
  chatProvider?: ChatProvider | null | undefined;
  connectionString?: string | undefined;
  maxUploadBytes: number;
  runtime: EvuKbRuntime;
};

export async function registerWorkspaceRoutes(
  server: FastifyInstance,
  options: WorkspaceRouteOptions,
): Promise<void> {
  const { blobRoot, connectionString, maxUploadBytes, runtime } = options;

  await server.register(
    async (workspaceRoutes) => {
      workspaceRoutes.addHook('preHandler', async (request) => {
        const workspaceParam = (request.params as { workspaceId?: string }).workspaceId;
        if (!workspaceParam) {
          throw ApiError.validation('workspaceId path parameter is required.');
        }

        const byId = UUID_PATTERN.test(workspaceParam)
          ? await runtime.workspaces.getById(workspaceParam)
          : null;
        const workspace = byId ?? (await runtime.workspaces.getBySlug(workspaceParam));
        if (!workspace) {
          throw ApiError.workspaceNotFound(workspaceParam);
        }

        request.evuKbWorkspace = workspace;
      });

      workspaceRoutes.addHook('preHandler', async (request) => {
        await enforceHttpAuth(runtime.tokenAuth, request.evuKbWorkspace.id, request);
      });

      await workspaceRoutes.register(corpusRoutesPlugin, {
        corpora: runtime.corpora,
        fileManager: runtime.fileManager,
      });
      await workspaceRoutes.register(fileRoutesPlugin, {
        fileManager: runtime.fileManager,
        maxUploadBytes,
      });
      await workspaceRoutes.register(indexRoutesPlugin, {
        corpora: runtime.corpora,
        indexEventHub: runtime.indexEventHub,
        indexJobService: runtime.indexJobService,
      });
      await workspaceRoutes.register(searchRoutesPlugin, {
        searchService: runtime.searchService,
      });
      await workspaceRoutes.register(askRoutesPlugin, {
        askService: runtime.askService,
      });
      await workspaceRoutes.register(linkRoutesPlugin, {
        linkGraphService: runtime.linkGraphService,
      });
      await workspaceRoutes.register(statsRoutesPlugin, {
        corpusStatsService: runtime.corpusStatsService,
      });
      await workspaceRoutes.register(okfRoutesPlugin, {
        okfService: runtime.okfService,
      });
      await workspaceRoutes.register(portableRoutesPlugin, {
        portableService: runtime.portableService,
        maxUploadBytes,
      });
      await workspaceRoutes.register(citationRoutesPlugin, {
        citationValidateService: runtime.citationValidateService,
      });
      await workspaceRoutes.register(syncRoutesPlugin, {
        mountSync: runtime.mountSyncService,
        gitSync: runtime.gitSyncService,
      });
      await workspaceRoutes.register(authRoutesPlugin, {
        tokenAuth: runtime.tokenAuth,
      });
      await workspaceRoutes.register(auditRoutesPlugin, {
        auditLog: runtime.auditLog,
      });
      await workspaceRoutes.register(settingsRoutesPlugin, {
        settings: runtime.settingsService,
      });
      await workspaceRoutes.register(diagnosticsRoutesPlugin, {
        jobQueue: runtime.jobQueue,
        nodes: runtime.nodes,
        ...(connectionString ? { connectionString } : {}),
        ...(blobRoot ? { blobRoot } : {}),
        embeddingProvider: resolveEmbeddingProvider(),
        chatProvider:
          options.chatProvider !== undefined ? options.chatProvider : resolveChatProvider(),
        vectorStore: runtime.vectorStore,
      });
      await workspaceRoutes.register(usageRoutesPlugin, {
        usageRecords: runtime.usageRecords,
      });
      await workspaceRoutes.register(secretRoutesPlugin, {
        secrets: runtime.secretService,
      });
      await workspaceRoutes.register(kbToolRoutesPlugin, {
        kbToolService: runtime.kbToolService,
        tokenAuth: runtime.tokenAuth,
        askService: runtime.askService,
      });
      await workspaceRoutes.register(approvalRoutesPlugin, {
        mutationApprovalService: runtime.mutationApprovalService,
        tokenAuth: runtime.tokenAuth,
      });
    },
    { prefix: '/api/workspaces/:workspaceId' },
  );
}
