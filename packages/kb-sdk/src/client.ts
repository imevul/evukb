import type { MutationApprovalRecord } from './approvals.js';
import type { AskResponse, AskStreamEvent, CorpusAskRequest, WorkspaceAskRequest } from './ask.js';
import type { AuditLogEntry, ListAuditLogQuery } from './audit.js';
import type {
  ApiKeyRecord,
  CreateAuthCredentialRequest,
  CreatedApiKey,
  CreatedMcpToken,
  McpTokenRecord,
} from './auth.js';
import type { CreateCorpusRequest, KnowledgeCorpus, UpdateCorpusRequest } from './corpus.js';
import type {
  BlobStoreHealth,
  DatabaseHealth,
  FailedJobRecord,
  JobDeleteResult,
  JobRetryResult,
  ListFailedJobsQuery,
  ProviderHealthSummary,
  VectorStoreHealth,
} from './diagnostics.js';
import { EvuKbApiError, type EvuKbApiErrorBody } from './errors.js';
import type {
  GraphNeighborhood,
  GraphNeighborhoodQuery,
  KnowledgeLink,
  KnowledgeLinkGraph,
  LinkGraphQuery,
} from './graph.js';
import type { EvuKbHealthResponse } from './health.js';
import type { CorpusIndexEvent, IndexEnqueueResponse } from './indexing.js';
import type { AskToolRequest, KbToolRequest, KbToolResponse } from './kb-tools.js';
import type { CreateFileRequest, CreateFolderRequest, KnowledgeNode } from './node.js';
import type { ConvertToOkfRequest, OkfConvertResult } from './okf.js';
import type { CorpusArchiveImportResult } from './portable.js';
import type { SearchRequest, SearchResult, WorkspaceSearchRequest } from './search.js';
import type {
  CreatedSecret,
  CreateSecretRequest,
  RotateSecretRequest,
  SecretRecord,
} from './secrets.js';
import type {
  AiProvidersView,
  RankingStrategiesListResponse,
  RankingStrategyUsageView,
  SettingsResponse,
  UpdateSettingsRequest,
} from './settings.js';
import { parseSseEvents } from './sse.js';
import type { KnowledgeCorpusStats } from './stats.js';
import type { SyncEnqueueResponse } from './sync.js';
import type {
  ListUsageRecordsQuery,
  UsageAggregateRow,
  UsageRecord,
  UsageSummaryQuery,
} from './usage.js';

export type EvuKbClientOptions = {
  apiKey?: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export class EvuKbClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #apiKey: string | undefined;

  constructor(options: EvuKbClientOptions) {
    this.#baseUrl = options.baseUrl;
    this.#fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.#apiKey = options.apiKey;
  }

  async health(): Promise<EvuKbHealthResponse> {
    return this.#requestJson<EvuKbHealthResponse>('GET', '/health');
  }

  async listCorpora(workspaceId: string): Promise<KnowledgeCorpus[]> {
    return this.#requestJson<KnowledgeCorpus[]>(
      'GET',
      this.#workspacePath(workspaceId, '/knowledge-corpora'),
    );
  }

  async createCorpus(workspaceId: string, body: CreateCorpusRequest): Promise<KnowledgeCorpus> {
    return this.#requestJson<KnowledgeCorpus>(
      'POST',
      this.#workspacePath(workspaceId, '/knowledge-corpora'),
      body,
    );
  }

  async getCorpus(workspaceId: string, corpusId: string): Promise<KnowledgeCorpus> {
    return this.#requestJson<KnowledgeCorpus>(
      'GET',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}`),
    );
  }

  async updateCorpus(
    workspaceId: string,
    corpusId: string,
    body: UpdateCorpusRequest,
  ): Promise<KnowledgeCorpus> {
    return this.#requestJson<KnowledgeCorpus>(
      'PATCH',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}`),
      body,
    );
  }

  async deleteCorpus(workspaceId: string, corpusId: string): Promise<void> {
    await this.#requestJson<void>(
      'DELETE',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}`),
    );
  }

  async listNodes(
    workspaceId: string,
    corpusId: string,
    format: 'flat' | 'tree' = 'flat',
  ): Promise<KnowledgeNode[]> {
    const path = `${this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes`)}?format=${format}`;
    return this.#requestJson<KnowledgeNode[]>('GET', path);
  }

  async readNodeContent(workspaceId: string, corpusId: string, nodeId: string): Promise<string> {
    const response = await this.#fetch(
      this.#url(
        this.#workspacePath(
          workspaceId,
          `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes/${encodeURIComponent(nodeId)}/content`,
        ),
      ),
      {
        headers: this.#headers({ accept: 'text/plain' }),
      },
    );

    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    return response.text();
  }

  async saveNodeContent(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    content: string,
  ): Promise<KnowledgeNode> {
    return this.#requestJson<KnowledgeNode>(
      'PUT',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes/${encodeURIComponent(nodeId)}/content`,
      ),
      content,
      'text/plain',
    );
  }

  async createFile(
    workspaceId: string,
    corpusId: string,
    body: CreateFileRequest,
  ): Promise<KnowledgeNode> {
    return this.#requestJson<KnowledgeNode>(
      'POST',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/files`),
      body,
    );
  }

  async createFolder(
    workspaceId: string,
    corpusId: string,
    body: CreateFolderRequest,
  ): Promise<KnowledgeNode> {
    return this.#requestJson<KnowledgeNode>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/folders`,
      ),
      body,
    );
  }

  async renameNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    name: string,
  ): Promise<KnowledgeNode> {
    return this.#requestJson<KnowledgeNode>(
      'PATCH',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes/${encodeURIComponent(nodeId)}`,
      ),
      { name },
    );
  }

  async moveNode(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    path: string,
  ): Promise<KnowledgeNode> {
    return this.#requestJson<KnowledgeNode>(
      'PATCH',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes/${encodeURIComponent(nodeId)}/move`,
      ),
      { path },
    );
  }

  async deleteNodes(
    workspaceId: string,
    corpusId: string,
    nodeIds: string[],
  ): Promise<{ deleted: number }> {
    return this.#requestJson<{ deleted: number }>(
      'DELETE',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes`),
      { nodeIds },
    );
  }

  async search(
    workspaceId: string,
    corpusId: string,
    body: SearchRequest,
  ): Promise<SearchResult[]> {
    return this.#requestJson<SearchResult[]>(
      'POST',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/search`),
      body,
    );
  }

  async searchWorkspace(
    workspaceId: string,
    body: WorkspaceSearchRequest,
  ): Promise<SearchResult[]> {
    return this.#requestJson<SearchResult[]>(
      'POST',
      this.#workspacePath(workspaceId, '/search'),
      body,
    );
  }

  async ask(workspaceId: string, corpusId: string, body: CorpusAskRequest): Promise<AskResponse> {
    return this.#requestJson<AskResponse>(
      'POST',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/ask`),
      body,
    );
  }

  async askWorkspace(workspaceId: string, body: WorkspaceAskRequest): Promise<AskResponse> {
    return this.#requestJson<AskResponse>('POST', this.#workspacePath(workspaceId, '/ask'), body);
  }

  async *askWorkspaceStream(
    workspaceId: string,
    body: WorkspaceAskRequest,
  ): AsyncIterable<AskStreamEvent> {
    yield* this.#askStream(this.#workspacePath(workspaceId, '/ask'), { ...body, stream: true });
  }

  async *askStream(
    workspaceId: string,
    corpusId: string,
    body: CorpusAskRequest,
  ): AsyncIterable<AskStreamEvent> {
    yield* this.#askStream(
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/ask`),
      { ...body, stream: true },
    );
  }

  async getLinkGraph(
    workspaceId: string,
    corpusId: string,
    params: LinkGraphQuery = {},
  ): Promise<KnowledgeLinkGraph> {
    const searchParams = new URLSearchParams();
    if (params.folderPrefix !== undefined) {
      searchParams.set('folderPrefix', params.folderPrefix);
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    const query = searchParams.toString();
    const suffix = `/knowledge-corpora/${encodeURIComponent(corpusId)}/link-graph${query ? `?${query}` : ''}`;
    return this.#requestJson<KnowledgeLinkGraph>('GET', this.#workspacePath(workspaceId, suffix));
  }

  async getGraphNeighborhood(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
    params: GraphNeighborhoodQuery = {},
  ): Promise<GraphNeighborhood> {
    const searchParams = new URLSearchParams();
    if (params.depth !== undefined) {
      searchParams.set('depth', String(params.depth));
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    const query = searchParams.toString();
    const suffix = `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes/${encodeURIComponent(nodeId)}/graph/neighborhood${query ? `?${query}` : ''}`;
    return this.#requestJson<GraphNeighborhood>('GET', this.#workspacePath(workspaceId, suffix));
  }

  async getCorpusStats(workspaceId: string, corpusId: string): Promise<KnowledgeCorpusStats> {
    return this.#requestJson<KnowledgeCorpusStats>(
      'GET',
      this.#workspacePath(workspaceId, `/knowledge-corpora/${encodeURIComponent(corpusId)}/stats`),
    );
  }

  async *subscribeCorpusIndexEvents(
    workspaceId: string,
    corpusId: string,
    signal?: AbortSignal,
  ): AsyncIterable<CorpusIndexEvent> {
    yield* this.#indexEventStream(
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/index-events`,
      ),
      signal,
    );
  }

  async listNodeLinks(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<KnowledgeLink[]> {
    return this.#requestJson<KnowledgeLink[]>(
      'GET',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/nodes/${encodeURIComponent(nodeId)}/links`,
      ),
    );
  }

  async listMcpTokens(workspaceId: string): Promise<McpTokenRecord[]> {
    return this.#requestJson<McpTokenRecord[]>(
      'GET',
      this.#workspacePath(workspaceId, '/mcp-tokens'),
    );
  }

  async createMcpToken(
    workspaceId: string,
    body: CreateAuthCredentialRequest,
  ): Promise<CreatedMcpToken> {
    return this.#requestJson<CreatedMcpToken>(
      'POST',
      this.#workspacePath(workspaceId, '/mcp-tokens'),
      body,
    );
  }

  async revokeMcpToken(workspaceId: string, tokenId: string): Promise<void> {
    await this.#requestJson<void>(
      'DELETE',
      this.#workspacePath(workspaceId, `/mcp-tokens/${encodeURIComponent(tokenId)}`),
    );
  }

  async rotateMcpToken(workspaceId: string, tokenId: string): Promise<CreatedMcpToken> {
    return this.#requestJson<CreatedMcpToken>(
      'POST',
      this.#workspacePath(workspaceId, `/mcp-tokens/${encodeURIComponent(tokenId)}/rotate`),
    );
  }

  async listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]> {
    return this.#requestJson<ApiKeyRecord[]>('GET', this.#workspacePath(workspaceId, '/api-keys'));
  }

  async createApiKey(
    workspaceId: string,
    body: CreateAuthCredentialRequest,
  ): Promise<CreatedApiKey> {
    return this.#requestJson<CreatedApiKey>(
      'POST',
      this.#workspacePath(workspaceId, '/api-keys'),
      body,
    );
  }

  async revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
    await this.#requestJson<void>(
      'DELETE',
      this.#workspacePath(workspaceId, `/api-keys/${encodeURIComponent(keyId)}`),
    );
  }

  async rotateApiKey(workspaceId: string, keyId: string): Promise<CreatedApiKey> {
    return this.#requestJson<CreatedApiKey>(
      'POST',
      this.#workspacePath(workspaceId, `/api-keys/${encodeURIComponent(keyId)}/rotate`),
    );
  }

  async listAuditLog(workspaceId: string, query: ListAuditLogQuery = {}): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    if (query.action !== undefined) {
      params.set('action', query.action);
    }
    const queryString = params.toString();
    const suffix = queryString ? `/audit?${queryString}` : '/audit';
    return this.#requestJson<AuditLogEntry[]>('GET', this.#workspacePath(workspaceId, suffix));
  }

  async executeKbTool(workspaceId: string, request: KbToolRequest): Promise<KbToolResponse> {
    return this.#requestJson<KbToolResponse>(
      'POST',
      this.#workspacePath(workspaceId, '/tools/kb'),
      request,
    );
  }

  async *askKbToolStream(
    workspaceId: string,
    request: Extract<KbToolRequest, { action: 'ask' }>,
  ): AsyncIterable<AskStreamEvent> {
    yield* this.#askStream(this.#workspacePath(workspaceId, '/tools/kb'), {
      ...request,
      stream: true,
    });
  }

  async listMutationApprovals(workspaceId: string): Promise<MutationApprovalRecord[]> {
    return this.#requestJson<MutationApprovalRecord[]>(
      'GET',
      this.#workspacePath(workspaceId, '/approvals'),
    );
  }

  async approveMutation(workspaceId: string, approvalId: string): Promise<KbToolResponse> {
    return this.#requestJson<KbToolResponse>(
      'POST',
      this.#workspacePath(workspaceId, `/approvals/${encodeURIComponent(approvalId)}/approve`),
    );
  }

  async rejectMutation(workspaceId: string, approvalId: string): Promise<MutationApprovalRecord> {
    return this.#requestJson<MutationApprovalRecord>(
      'POST',
      this.#workspacePath(workspaceId, `/approvals/${encodeURIComponent(approvalId)}/reject`),
    );
  }

  async reindexNodes(
    workspaceId: string,
    corpusId: string,
    nodeIds: string[],
  ): Promise<IndexEnqueueResponse> {
    return this.#requestJson<IndexEnqueueResponse>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/reindex`,
      ),
      { nodeIds },
    );
  }

  async reindexCorpus(workspaceId: string, corpusId: string): Promise<IndexEnqueueResponse> {
    return this.#requestJson<IndexEnqueueResponse>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/reindex-all`,
      ),
    );
  }

  async reindexNeedingAttention(
    workspaceId: string,
    corpusId: string,
  ): Promise<IndexEnqueueResponse> {
    return this.#requestJson<IndexEnqueueResponse>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/reindex-needing`,
      ),
    );
  }

  async validateCitations(workspaceId: string, corpusId: string): Promise<{ enqueued: number }> {
    return this.#requestJson<{ enqueued: number }>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/validate-citations`,
      ),
    );
  }

  async syncMount(workspaceId: string, corpusId: string): Promise<SyncEnqueueResponse> {
    return this.#requestJson<SyncEnqueueResponse>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/sync-mount`,
      ),
    );
  }

  async syncGit(workspaceId: string, corpusId: string): Promise<SyncEnqueueResponse> {
    return this.#requestJson<SyncEnqueueResponse>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/sync-git`,
      ),
    );
  }

  async getSettings(workspaceId: string): Promise<SettingsResponse> {
    return this.#requestJson<SettingsResponse>(
      'GET',
      this.#workspacePath(workspaceId, '/settings'),
    );
  }

  async updateSettings(
    workspaceId: string,
    body: UpdateSettingsRequest,
  ): Promise<SettingsResponse> {
    return this.#requestJson<SettingsResponse>(
      'PATCH',
      this.#workspacePath(workspaceId, '/settings'),
      body,
    );
  }

  async listRankingStrategies(workspaceId: string): Promise<RankingStrategiesListResponse> {
    return this.#requestJson<RankingStrategiesListResponse>(
      'GET',
      this.#workspacePath(workspaceId, '/settings/ranking/strategies'),
    );
  }

  async getRankingStrategyUsage(
    workspaceId: string,
    strategyId: string,
  ): Promise<RankingStrategyUsageView> {
    return this.#requestJson<RankingStrategyUsageView>(
      'GET',
      this.#workspacePath(
        workspaceId,
        `/settings/ranking/strategies/${encodeURIComponent(strategyId)}/usage`,
      ),
    );
  }

  async registerRankingStrategyPreset(
    workspaceId: string,
    body: {
      preset: {
        id: string;
        version: string;
        label?: string;
        description?: string;
        weights?: Record<string, unknown>;
        postRank?: string;
      };
      force?: boolean;
    },
  ): Promise<{ strategy: import('./settings.js').RankingStrategySummary }> {
    return this.#requestJson(
      'POST',
      this.#workspacePath(workspaceId, '/settings/ranking/strategies'),
      body,
    );
  }

  async registerRankingStrategyExample(
    workspaceId: string,
    exampleId: string,
    options?: { force?: boolean },
  ): Promise<{ strategy: import('./settings.js').RankingStrategySummary }> {
    return this.#requestJson(
      'POST',
      this.#workspacePath(workspaceId, '/settings/ranking/strategies'),
      {
        exampleId,
        ...(options?.force ? { force: true } : {}),
      },
    );
  }

  async unregisterRankingStrategy(
    workspaceId: string,
    strategyId: string,
  ): Promise<{
    strategyId: string;
    remediatedCorpusCount: number;
    workspaceRemediated: boolean;
    corpusFallbackStrategyId: string;
    workspaceFallbackStrategyId: string;
  }> {
    return this.#requestJson(
      'DELETE',
      this.#workspacePath(
        workspaceId,
        `/settings/ranking/strategies/${encodeURIComponent(strategyId)}`,
      ),
      { confirm: true },
    );
  }

  async getAiProviders(workspaceId: string): Promise<AiProvidersView> {
    return this.#requestJson<AiProvidersView>(
      'GET',
      this.#workspacePath(workspaceId, '/ai/providers'),
    );
  }

  async updateAiProviders(
    workspaceId: string,
    body: import('./settings.js').UpdateAiProvidersRequest,
  ): Promise<AiProvidersView> {
    return this.#requestJson<AiProvidersView>(
      'PATCH',
      this.#workspacePath(workspaceId, '/ai/providers'),
      body,
    );
  }

  async getHealthDb(workspaceId: string): Promise<DatabaseHealth> {
    return this.#requestJson<DatabaseHealth>('GET', this.#workspacePath(workspaceId, '/health/db'));
  }

  async getHealthBlobStore(workspaceId: string): Promise<BlobStoreHealth> {
    return this.#requestJson<BlobStoreHealth>(
      'GET',
      this.#workspacePath(workspaceId, '/health/blob-store'),
    );
  }

  async getHealthProviders(workspaceId: string): Promise<ProviderHealthSummary> {
    return this.#requestJson<ProviderHealthSummary>(
      'GET',
      this.#workspacePath(workspaceId, '/health/providers'),
    );
  }

  async getHealthVectorStore(workspaceId: string): Promise<VectorStoreHealth> {
    return this.#requestJson<VectorStoreHealth>(
      'GET',
      this.#workspacePath(workspaceId, '/health/vector-store'),
    );
  }

  async listFailedJobs(
    workspaceId: string,
    query: ListFailedJobsQuery = {},
  ): Promise<FailedJobRecord[]> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    const suffix = params.size > 0 ? `/jobs/failed?${params.toString()}` : '/jobs/failed';
    return this.#requestJson<FailedJobRecord[]>('GET', this.#workspacePath(workspaceId, suffix));
  }

  async retryFailedJob(workspaceId: string, jobId: string): Promise<JobRetryResult> {
    return this.#requestJson<JobRetryResult>(
      'POST',
      this.#workspacePath(workspaceId, `/jobs/${encodeURIComponent(jobId)}/retry`),
    );
  }

  async deleteFailedJob(workspaceId: string, jobId: string): Promise<JobDeleteResult> {
    return this.#requestJson<JobDeleteResult>(
      'DELETE',
      this.#workspacePath(workspaceId, `/jobs/${encodeURIComponent(jobId)}`),
    );
  }

  async listUsageRecords(
    workspaceId: string,
    query: ListUsageRecordsQuery = {},
  ): Promise<UsageRecord[]> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    const suffix = params.size > 0 ? `/usage/recent?${params.toString()}` : '/usage/recent';
    return this.#requestJson<UsageRecord[]>('GET', this.#workspacePath(workspaceId, suffix));
  }

  async getUsageSummary(
    workspaceId: string,
    query: UsageSummaryQuery = {},
  ): Promise<UsageAggregateRow[]> {
    const params = new URLSearchParams();
    if (query.since !== undefined) {
      params.set('since', query.since);
    }
    if (query.until !== undefined) {
      params.set('until', query.until);
    }
    if (query.operationType !== undefined) {
      params.set('operationType', query.operationType);
    }
    if (query.groupBy !== undefined) {
      params.set('groupBy', query.groupBy);
    }
    const suffix = params.size > 0 ? `/usage/summary?${params.toString()}` : '/usage/summary';
    return this.#requestJson<UsageAggregateRow[]>('GET', this.#workspacePath(workspaceId, suffix));
  }

  async listSecrets(workspaceId: string): Promise<SecretRecord[]> {
    return this.#requestJson<SecretRecord[]>('GET', this.#workspacePath(workspaceId, '/secrets'));
  }

  async createSecret(workspaceId: string, body: CreateSecretRequest): Promise<CreatedSecret> {
    return this.#requestJson<CreatedSecret>(
      'POST',
      this.#workspacePath(workspaceId, '/secrets'),
      body,
    );
  }

  async deleteSecret(workspaceId: string, secretId: string): Promise<void> {
    await this.#requestJson<void>(
      'DELETE',
      this.#workspacePath(workspaceId, `/secrets/${encodeURIComponent(secretId)}`),
    );
  }

  async rotateSecret(
    workspaceId: string,
    secretId: string,
    body: RotateSecretRequest,
  ): Promise<SecretRecord> {
    return this.#requestJson<SecretRecord>(
      'PATCH',
      this.#workspacePath(workspaceId, `/secrets/${encodeURIComponent(secretId)}`),
      body,
    );
  }

  async convertToOkf(
    workspaceId: string,
    corpusId: string,
    body: ConvertToOkfRequest = {},
  ): Promise<OkfConvertResult> {
    return this.#requestJson<OkfConvertResult>(
      'POST',
      this.#workspacePath(
        workspaceId,
        `/knowledge-corpora/${encodeURIComponent(corpusId)}/convert-to-okf`,
      ),
      body,
    );
  }

  async exportOkfZip(workspaceId: string, corpusId: string): Promise<ArrayBuffer> {
    const response = await this.#fetch(
      this.#url(
        this.#workspacePath(
          workspaceId,
          `/knowledge-corpora/${encodeURIComponent(corpusId)}/export-okf`,
        ),
      ),
      {
        headers: this.#headers({ accept: 'application/zip' }),
      },
    );

    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    return response.arrayBuffer();
  }

  async exportPortableZip(workspaceId: string, corpusId: string): Promise<ArrayBuffer> {
    const response = await this.#fetch(
      this.#url(
        this.#workspacePath(
          workspaceId,
          `/knowledge-corpora/${encodeURIComponent(corpusId)}/export`,
        ),
      ),
      {
        headers: this.#headers({ accept: 'application/zip' }),
      },
    );

    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    return response.arrayBuffer();
  }

  async importPortableZip(
    workspaceId: string,
    corpusId: string,
    zipFile: Blob | File,
  ): Promise<CorpusArchiveImportResult> {
    const formData = new FormData();
    formData.append(
      'archive',
      zipFile,
      zipFile instanceof File ? zipFile.name : 'import.evukb.zip',
    );

    const response = await this.#fetch(
      this.#url(
        this.#workspacePath(
          workspaceId,
          `/knowledge-corpora/${encodeURIComponent(corpusId)}/import`,
        ),
      ),
      {
        method: 'POST',
        headers: this.#headers(),
        body: formData,
      },
    );

    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    return (await response.json()) as CorpusArchiveImportResult;
  }

  async *#indexEventStream(path: string, signal?: AbortSignal): AsyncIterable<CorpusIndexEvent> {
    const response = await this.#fetch(this.#url(path), {
      method: 'GET',
      headers: this.#headers({ accept: 'text/event-stream' }),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        for (const event of parseSseEvents(`${part}\n\n`, 'index')) {
          yield JSON.parse(event.data) as CorpusIndexEvent;
        }
      }
    }

    if (buffer.trim()) {
      for (const event of parseSseEvents(`${buffer}\n\n`, 'index')) {
        yield JSON.parse(event.data) as CorpusIndexEvent;
      }
    }
  }

  async *#askStream(
    path: string,
    body: WorkspaceAskRequest | CorpusAskRequest | (AskToolRequest & { stream?: boolean }),
  ): AsyncIterable<AskStreamEvent> {
    const response = await this.#fetch(this.#url(path), {
      method: 'POST',
      headers: this.#headers({
        'content-type': 'application/json',
        accept: 'text/event-stream',
      }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        for (const event of parseSseEvents(`${part}\n\n`, 'ask')) {
          yield JSON.parse(event.data) as AskStreamEvent;
        }
      }
    }

    if (buffer.trim()) {
      for (const event of parseSseEvents(`${buffer}\n\n`, 'ask')) {
        yield JSON.parse(event.data) as AskStreamEvent;
      }
    }
  }

  #workspacePath(workspaceId: string, suffix: string): string {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}${suffix}`;
  }

  #headers(extra: Record<string, string> = {}): HeadersInit {
    return {
      ...(this.#apiKey ? { authorization: `Bearer ${this.#apiKey}` } : {}),
      ...extra,
    };
  }

  async #requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
    contentType = 'application/json',
  ): Promise<T> {
    const requestInit: RequestInit = {
      method,
      headers: this.#headers(
        body !== undefined
          ? { 'content-type': contentType, accept: 'application/json' }
          : { accept: 'application/json' },
      ),
    };

    if (body !== undefined) {
      requestInit.body = contentType === 'application/json' ? JSON.stringify(body) : String(body);
    }

    const response = await this.#fetch(this.#url(path), requestInit);
    if (!response.ok) {
      throw await this.#errorFromResponse(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentTypeHeader = response.headers.get('content-type') ?? '';
    if (!contentTypeHeader.includes('application/json')) {
      return (await response.text()) as T;
    }

    return (await response.json()) as T;
  }

  #url(path: string): URL {
    const base =
      this.#baseUrl ||
      (typeof globalThis.location?.origin === 'string'
        ? globalThis.location.origin
        : 'http://localhost');
    return new URL(path, base);
  }

  async #errorFromResponse(response: Response): Promise<EvuKbApiError> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as EvuKbApiErrorBody;
      return new EvuKbApiError(response.status, payload.code, payload.error);
    }

    return new EvuKbApiError(
      response.status,
      'internal_error',
      `EvuKB request failed with ${response.status}`,
    );
  }
}
