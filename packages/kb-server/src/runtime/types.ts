import type { BlobStore, RankingStrategyRegistry, VectorStore } from '@evu/kb-core';
import type {
  AuditLogRepository,
  ChunkRepository,
  CorpusRepository,
  DbHandle,
  LinkRepository,
  NodeRepository,
  UsageRecordRepository,
  WorkspaceRepository,
} from '@evu/kb-db';

import type { VectorBackend } from '../adapters/resolve-vector-store.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import type { PostRankHandlerRegistry } from '../search/post-rank-registry.js';
import type { AgentWriteService } from '../services/agent-write-service.js';
import type { AskService } from '../services/ask-service.js';
import type { CitationValidateService } from '../services/citation-validate-service.js';
import type { CorpusIndexEventHub } from '../services/corpus-index-event-hub.js';
import type { CorpusStatsService } from '../services/corpus-stats-service.js';
import type { FileManagerService } from '../services/file-manager.js';
import type { GitSyncService } from '../services/git-sync-service.js';
import type { GitWritebackService } from '../services/git-writeback-service.js';
import type { IndexJobService } from '../services/index-job-service.js';
import type { IndexService } from '../services/index-service.js';
import type { KbToolService } from '../services/kb-tool-service.js';
import type { LinkGraphService } from '../services/link-graph-service.js';
import type { MountSyncService } from '../services/mount-sync-service.js';
import type { MutationApprovalService } from '../services/mutation-approval-service.js';
import type { OkfMaintenanceService } from '../services/okf-maintenance-service.js';
import type { OkfService } from '../services/okf-service.js';
import type { PortableService } from '../services/portable-service.js';
import type { RankingStrategyPluginService } from '../services/ranking-strategy-plugin-service.js';
import type { SearchService } from '../services/search-service.js';
import type { SecretService } from '../services/secret-service.js';
import type { SettingsService } from '../services/settings-service.js';
import type { SyncScheduleService } from '../services/sync-schedule-service.js';
import type { TokenAuthService } from '../services/token-auth-service.js';

/**
 * The fully composed EvuKB backend runtime: repositories, adapters, and
 * services wired together by createEvuKbRuntime(). Lives in its own module so
 * MCP and kb-tool modules can depend on the type without importing the
 * composition root.
 */
export type EvuKbRuntime = {
  db: DbHandle;
  blobStore: BlobStore;
  workspaces: WorkspaceRepository;
  corpora: CorpusRepository;
  nodes: NodeRepository;
  chunks: ChunkRepository;
  links: LinkRepository;
  fileManager: FileManagerService;
  indexService: IndexService;
  searchService: SearchService;
  askService: AskService;
  linkGraphService: LinkGraphService;
  corpusStatsService: CorpusStatsService;
  okfService: OkfService;
  portableService: PortableService;
  okfMaintenanceService: OkfMaintenanceService;
  citationValidateService: CitationValidateService;
  indexJobService: IndexJobService;
  indexEventHub: CorpusIndexEventHub;
  jobQueue: JobQueueService;
  mountSyncService: MountSyncService;
  gitSyncService: GitSyncService;
  gitWritebackService: GitWritebackService;
  agentWriteService: AgentWriteService;
  kbToolService: KbToolService;
  mutationApprovalService: MutationApprovalService;
  tokenAuth: TokenAuthService;
  auditLog: AuditLogRepository;
  settingsService: SettingsService;
  rankingStrategyPluginService: RankingStrategyPluginService;
  rankingRegistry: RankingStrategyRegistry;
  postRankHandlers: PostRankHandlerRegistry;
  secretService: SecretService;
  syncScheduleService: SyncScheduleService;
  usageRecords: UsageRecordRepository;
  vectorBackend: VectorBackend;
  vectorStore: VectorStore;
};
