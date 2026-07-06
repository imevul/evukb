import {
  type ChatProvider,
  createRankingStrategyRegistry,
  folderPathsForMaintenanceEvent,
  LocalFilesystemBlobStore,
  parseMountAllowlist,
  type RankingStrategyRegistry,
} from '@evu/kb-core';
import {
  ApiKeyRepository,
  AuditLogRepository,
  ChunkRepository,
  CorpusRepository,
  createDb,
  ensureDevWorkspace,
  ensureWorkspace,
  LinkRepository,
  McpTokenRepository,
  MutationApprovalRepository,
  migrateLatest,
  NodeRepository,
  SecretRepository,
  UsageRecordRepository,
  WorkspaceRepository,
} from '@evu/kb-db';

import { resolveChatProvider } from '../adapters/openai-chat.js';
import { resolveEmbeddingProvider } from '../adapters/openai-embedding.js';
import { resolveVectorStore } from '../adapters/resolve-vector-store.js';
import { JobQueueService } from '../jobs/job-queue-service.js';
import {
  createDefaultPostRankHandlerRegistry,
  type PostRankHandlerRegistry,
} from '../search/post-rank-registry.js';
import { AgentWriteService } from '../services/agent-write-service.js';
import { ArchiveImportService } from '../services/archive-import-service.js';
import { AskService } from '../services/ask-service.js';
import { CitationValidateService } from '../services/citation-validate-service.js';
import { CorpusIndexEventHub } from '../services/corpus-index-event-hub.js';
import { CorpusStatsService } from '../services/corpus-stats-service.js';
import { FileManagerService } from '../services/file-manager.js';
import { GitSyncService } from '../services/git-sync-service.js';
import { IndexJobService } from '../services/index-job-service.js';
import { IndexService } from '../services/index-service.js';
import { KbToolService } from '../services/kb-tool-service.js';
import { LinkGraphService } from '../services/link-graph-service.js';
import { MountSyncService } from '../services/mount-sync-service.js';
import { MountWritebackService } from '../services/mount-writeback-service.js';
import { MutationApprovalService } from '../services/mutation-approval-service.js';
import { OkfMaintenanceService } from '../services/okf-maintenance-service.js';
import { OkfService } from '../services/okf-service.js';
import { PortableService } from '../services/portable-service.js';
import { RankingStrategyPluginService } from '../services/ranking-strategy-plugin-service.js';
import { SearchService } from '../services/search-service.js';
import { SecretService } from '../services/secret-service.js';
import { SettingsService } from '../services/settings-service.js';
import { SyncImportService } from '../services/sync-import-service.js';
import { SyncScheduleService } from '../services/sync-schedule-service.js';
import { TokenAuthService } from '../services/token-auth-service.js';
import type { EvuKbRuntime } from './types.js';

export type CreateEvuKbRuntimeOptions = {
  chatProvider?: ChatProvider | null;
  connectionString?: string;
  blobRoot?: string;
  bootstrapDevWorkspace?: boolean;
  rankingRegistry?: RankingStrategyRegistry;
  postRankHandlers?: PostRankHandlerRegistry;
};

/**
 * Composition root for the EvuKB backend. Job handlers resolve services
 * lazily through the assembled runtime so no service needs a definite
 * assignment before its dependencies exist; the queue only starts after the
 * runtime is fully wired.
 */
export async function createEvuKbRuntime(
  options: CreateEvuKbRuntimeOptions,
): Promise<EvuKbRuntime | null> {
  if (!options.connectionString || !options.blobRoot) {
    return null;
  }

  const db = createDb({ connectionString: options.connectionString });
  await migrateLatest(db);

  if (options.bootstrapDevWorkspace ?? process.env.NODE_ENV !== 'production') {
    await ensureDevWorkspace(db);
  } else {
    const bootstrapSlug = process.env.EVUKB_BOOTSTRAP_WORKSPACE_SLUG?.trim();
    if (bootstrapSlug) {
      const bootstrapName = process.env.EVUKB_BOOTSTRAP_WORKSPACE_NAME?.trim() || bootstrapSlug;
      await ensureWorkspace(db, { slug: bootstrapSlug, name: bootstrapName });
    }
  }

  const blobStore = new LocalFilesystemBlobStore({ rootDir: options.blobRoot });
  const workspaces = new WorkspaceRepository(db);
  const corpora = new CorpusRepository(db);
  const nodes = new NodeRepository(db);
  const chunks = new ChunkRepository(db);
  const links = new LinkRepository(db);
  const mcpTokens = new McpTokenRepository(db);
  const apiKeys = new ApiKeyRepository(db);
  const auditLog = new AuditLogRepository(db);
  const secrets = new SecretRepository(db);
  const usageRecords = new UsageRecordRepository(db);
  const tokenAuth = new TokenAuthService(mcpTokens, apiKeys, workspaces);
  const embeddingProvider = resolveEmbeddingProvider();
  const resolvedVector = resolveVectorStore({ chunks, embeddingProvider });
  const chatProvider =
    options.chatProvider !== undefined ? options.chatProvider : resolveChatProvider();
  const rankingRegistry = options.rankingRegistry ?? createRankingStrategyRegistry();
  const postRankHandlers = options.postRankHandlers ?? createDefaultPostRankHandlerRegistry();
  const indexEventHub = new CorpusIndexEventHub();
  const indexService = new IndexService({
    blobStore,
    chunks,
    corpora,
    indexEventHub,
    links,
    nodes,
    embeddingProvider,
    vectorBackend: resolvedVector.backend,
    vectorStore: resolvedVector.store,
    workspaces,
    usageRecords,
  });

  // Job handlers run only after jobQueue.start(), which happens after the
  // runtime is assembled below, so the lazy lookup can never miss.
  let assembled: EvuKbRuntime | null = null;
  const runtime = (): EvuKbRuntime => {
    if (!assembled) {
      throw new Error('EvuKB runtime accessed before assembly completed.');
    }
    return assembled;
  };

  const jobQueue = new JobQueueService({
    connectionString: options.connectionString,
    handlers: {
      onIndexNode: async (job) => {
        await indexService.indexNode(job.workspaceId, job.corpusId, job.nodeId);
        await runtime().citationValidateService.scheduleValidationIfNeeded(
          job.workspaceId,
          job.corpusId,
          job.nodeId,
        );
      },
      onOkfMaintain: async (job) => {
        await runtime().okfMaintenanceService.maintainForEvent(
          job.workspaceId,
          job.corpusId,
          job.event,
          job.actor,
        );
      },
      onCitationValidate: async (job) => {
        await runtime().citationValidateService.validateNode(job);
      },
      onMountSync: async (job) => {
        await runtime().mountSyncService.runSync(job);
      },
      onGitSync: async (job) => {
        await runtime().gitSyncService.runSync(job);
      },
      onMountSyncSchedule: async () => {
        await runtime().syncScheduleService.runTick();
      },
      onCorpusReindex: async (job) => {
        await runtime().indexJobService.runCorpusReindex(job.workspaceId, job.corpusId);
      },
    },
  });

  const mountWritebackService = new MountWritebackService({
    corpora,
    mountAllowlist: parseMountAllowlist(process.env.EVUKB_MOUNT_ALLOWLIST),
  });

  const fileManager = new FileManagerService({
    auditLog,
    blobStore,
    corpora,
    indexEventHub,
    nodes,
    mountWriteback: mountWritebackService,
    onContentChanged: ({ workspaceId, corpusId, nodeId }) => {
      void (async () => {
        const node = await nodes.getById(workspaceId, corpusId, nodeId);
        if (!node?.name.toLowerCase().endsWith('.md')) {
          return;
        }
        await jobQueue.enqueueIndex({ workspaceId, corpusId, nodeId });
      })().catch((error) => {
        console.error(
          `EvuKB: failed to enqueue index job for node ${nodeId} after content change:`,
          error instanceof Error ? error.message : error,
        );
      });
    },
    onOkfMutation: async ({ workspaceId, corpusId, event, actor }) => {
      const folderPaths = folderPathsForMaintenanceEvent({
        kind: event.kind,
        filePath: event.filePath,
        ...(event.previousFilePath !== undefined
          ? { previousFilePath: event.previousFilePath }
          : {}),
        ...(event.nodeType !== undefined ? { nodeType: event.nodeType } : {}),
      });
      for (const folderPath of folderPaths) {
        await jobQueue.enqueueOkfMaintain({
          workspaceId,
          corpusId,
          folderPath,
          event,
          actor,
        });
      }
    },
  });

  const okfMaintenanceService = new OkfMaintenanceService({
    corpora,
    fileManager,
    nodes,
  });

  const syncImport = new SyncImportService({
    auditLog,
    blobStore,
    corpora,
    jobQueue,
    nodes,
  });
  const mountSyncService = new MountSyncService({
    corpora,
    jobQueue,
    syncImport,
  });
  const gitSyncService = new GitSyncService({
    blobRoot: options.blobRoot,
    corpora,
    jobQueue,
    secrets,
    syncImport,
  });
  const syncScheduleService = new SyncScheduleService({
    corpora,
    mountSync: mountSyncService,
    gitSync: gitSyncService,
  });

  const citationValidateService = new CitationValidateService({
    blobStore,
    corpora,
    nodes,
    jobQueue,
  });

  const searchService = new SearchService({
    chunks,
    corpora,
    nodes,
    workspaces,
    embeddingProvider,
    chatProvider,
    usageRecords,
    vectorStore: resolvedVector.store,
    rankingRegistry,
    postRankHandlers,
  });
  const askService = new AskService({
    chatProvider,
    corpora,
    nodes,
    search: searchService,
    usageRecords,
    workspaces,
  });
  const linkGraphService = new LinkGraphService({
    corpora,
    links,
    nodes,
  });
  const corpusStatsService = new CorpusStatsService({
    corpora,
    jobQueue,
    links,
    mountAllowlist: parseMountAllowlist(process.env.EVUKB_MOUNT_ALLOWLIST),
    nodes,
  });
  const agentWriteService = new AgentWriteService({
    auditLog,
    fileManager,
    nodes,
    workspaces,
    corpora,
    apiKeys,
    mcpTokens,
  });
  const mutationApprovalService = new MutationApprovalService({
    agentWrite: agentWriteService,
    approvals: new MutationApprovalRepository(db),
    auditLog,
    corpora,
    nodes,
    workspaces,
  });
  agentWriteService.setMutationApproval(mutationApprovalService);
  const kbToolService = new KbToolService({
    runtime: null,
    agentWrite: agentWriteService,
  });
  const okfService = new OkfService({
    corpora,
    fileManager,
    indexService,
    nodes,
  });
  const archiveImportService = new ArchiveImportService({
    blobStore,
    corpora,
    jobQueue,
    nodes,
  });
  const portableService = new PortableService({
    archiveImportService,
    auditLog,
    blobStore,
    corpora,
    fileManager,
    jobQueue,
    links,
    nodes,
  });
  const indexJobService = new IndexJobService({ jobQueue, nodes });
  const settingsService = new SettingsService({
    workspaces,
    embeddingProvider,
    chatProvider,
    connectionString: options.connectionString,
    blobRoot: options.blobRoot,
    rankingRegistry,
  });
  const rankingStrategyPluginService = new RankingStrategyPluginService({
    rankingRegistry,
    workspaces,
    corpora,
    auditLog,
  });
  const secretService = new SecretService({ secrets });

  assembled = {
    db,
    blobStore,
    workspaces,
    corpora,
    nodes,
    chunks,
    links,
    fileManager,
    indexService,
    searchService,
    askService,
    linkGraphService,
    corpusStatsService,
    okfService,
    portableService,
    okfMaintenanceService,
    citationValidateService,
    indexEventHub,
    indexJobService,
    jobQueue,
    mountSyncService,
    gitSyncService,
    agentWriteService,
    kbToolService,
    mutationApprovalService,
    tokenAuth,
    auditLog,
    settingsService,
    rankingStrategyPluginService,
    rankingRegistry,
    postRankHandlers,
    secretService,
    syncScheduleService,
    usageRecords,
    vectorBackend: resolvedVector.backend,
    vectorStore: resolvedVector.store,
  };
  kbToolService.setRuntime(assembled);

  await jobQueue.start();
  if (process.env.VITEST === 'true') {
    await jobQueue.clearQueuedJobs();
  } else {
    await jobQueue.scheduleSyncTick().catch(() => undefined);
  }

  return assembled;
}
