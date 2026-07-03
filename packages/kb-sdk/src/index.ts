export const evuKbSdkPackageName = '@evu/kb-sdk';

export type {
  AppendDocumentRequest,
  CreateDocumentRequest,
  DeleteDocumentRequest,
  KbToolPendingApprovalResponse,
  KbWriteAction,
  KbWriteToolRequest,
  KbWriteToolSuccessResponse,
  UpdateDocumentRequest,
} from './agent-write.js';
export type {
  MutationApprovalPolicy,
  MutationApprovalPreview,
  MutationApprovalRecord,
  MutationApprovalStatus,
} from './approvals.js';
export type {
  AskResponse,
  AskResponseMode,
  AskStreamDoneEvent,
  AskStreamEvent,
  AskStreamMetadataEvent,
  AskStreamTokenEvent,
  CorpusAskRequest,
  RetrievalTrace,
  WorkspaceAskRequest,
} from './ask.js';
export type { AuditLogActor, AuditLogEntry, AuditLogTarget, ListAuditLogQuery } from './audit.js';
export type {
  ApiKeyRecord,
  AuthenticatedToken,
  CreateAuthCredentialRequest,
  CreatedApiKey,
  CreatedMcpToken,
  KbAuthScope,
  McpTokenRecord,
} from './auth.js';
export type { Citation, CitationSourceType } from './citation.js';
export { EvuKbClient, type EvuKbClientOptions } from './client.js';
export type {
  CreateCorpusRequest,
  KnowledgeCorpus,
  KnowledgeCorpusSettings,
  KnowledgeFormatProfile,
  UpdateCorpusRequest,
} from './corpus.js';
export type {
  BlobStoreHealth,
  DatabaseHealth,
  FailedJobRecord,
  JobDeleteResult,
  JobRetryResult,
  ListFailedJobsQuery,
  ProviderHealthSummary,
  VectorStoreHealth,
} from './diagnostics.js';
export { EvuKbApiError, type EvuKbApiErrorBody } from './errors.js';
export type { KnowledgeFilters } from './filters.js';
export type { paths as EvuKbOpenApi } from './generated/openapi.js';
export type {
  GraphNeighborhood,
  GraphNeighborhoodQuery,
  KnowledgeLink,
  KnowledgeLinkGraph,
  KnowledgeLinkGraphEdge,
  KnowledgeLinkGraphNode,
  LinkGraphQuery,
} from './graph.js';
export type { EvuKbHealthResponse } from './health.js';
export type {
  CorpusIndexEvent,
  CorpusIndexEventKind,
  IndexEnqueueResponse,
  IndexNodeResult,
  IndexNodeResultStatus,
} from './indexing.js';
export type {
  AskToolRequest,
  FollowLinksRequest,
  GetDocumentRequest,
  GetDocumentResult,
  KbReadAction,
  KbReadToolRequest,
  KbReadToolSuccessResponse,
  KbToolRequest,
  KbToolResponse,
  KbToolSuccessResponse,
  ListConceptsRequest,
  ListCorporaRequest,
  ListDocumentsRequest,
  ReadChunkRequest,
  ReadChunkResult,
  ReadIndexRequest,
  SearchToolRequest,
} from './kb-tools.js';
export type {
  CreateFileRequest,
  CreateFolderRequest,
  IndexStatus,
  KnowledgeNode,
} from './node.js';
export type {
  ConvertToOkfRequest,
  OkfConceptSummary,
  OkfConvertResult,
  OkfListConceptsResult,
  OkfReadIndexResult,
} from './okf.js';
export type { CorpusArchiveImportResult, PortableImportResult } from './portable.js';
export type {
  SearchMatchKind,
  SearchRankingTrace,
  SearchRequest,
  SearchResult,
  WorkspaceSearchRequest,
} from './search.js';
export type {
  CreatedSecret,
  CreateSecretRequest,
  RotateSecretRequest,
  SecretRecord,
} from './secrets.js';
export type {
  AiProviderOverride,
  AiProviderSettings,
  AiProvidersView,
  EffectiveProviderConfig,
  EmbeddingChunkingStrategy,
  RankingSettings,
  RankingSettingsView,
  RankingStrategiesListResponse,
  RankingStrategySummary,
  RankingStrategyUsageView,
  SettingField,
  SettingSource,
  SettingsResponse,
  UpdateAiProvidersRequest,
  UpdateSettingsRequest,
  WorkspaceBootHints,
  WorkspaceSettingsView,
} from './settings.js';
export { parseSseEvents } from './sse.js';
export type {
  CorpusLinkCounts,
  IndexStatusCounts,
  KnowledgeCorpusStats,
} from './stats.js';
export type { SyncEnqueueResponse, SyncStatus } from './sync.js';
export type {
  ListUsageRecordsQuery,
  OperationUsage,
  UsageAggregateRow,
  UsageOperationType,
  UsageRecord,
  UsageSummaryQuery,
} from './usage.js';
