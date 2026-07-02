import type {
  BlobStoreHealth,
  DatabaseHealth,
  FailedJobRecord,
  KnowledgeCorpus,
  ProviderHealthSummary,
  UsageAggregateRow,
  UsageRecord,
  VectorStoreHealth,
} from '@evu/kb-sdk';
import {
  AppModal,
  Button,
  EmptyState,
  PageHeader,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmAction,
} from '@evu/kb-ui';
import { Eye, RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

function formatDiagnosticsJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function healthTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'ok') {
    return 'success';
  }
  if (status === 'error') {
    return 'warning';
  }
  return 'neutral';
}

const usageOperationLabels: Record<UsageAggregateRow['operationType'], string> = {
  embed: 'Embedding',
  ask: 'Ask',
  rerank: 'Rerank',
  index: 'Indexing',
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatLatencyMs(ms: number): string {
  if (ms < 1000) {
    return `${formatCount(ms)} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatLatencyDetail(ms: number): string {
  return `${formatLatencyMs(ms)} (${formatCount(ms)} ms)`;
}

function averageLatencyMs(totalMs: number, requestCount: number): number {
  if (requestCount <= 0) {
    return 0;
  }
  return Math.round(totalMs / requestCount);
}

function UsageSummaryCard({ row }: { row: UsageAggregateRow }) {
  const averageMs = averageLatencyMs(row.latencyMs, row.requestCount);

  return (
    <div className="evukb-stat-card">
      <strong>{usageOperationLabels[row.operationType] ?? row.operationType}</strong>
      <dl className="evukb-stat-metrics">
        <div>
          <dt>Records</dt>
          <dd>{formatCount(row.recordCount)}</dd>
        </div>
        <div>
          <dt>Requests</dt>
          <dd>{formatCount(row.requestCount)}</dd>
        </div>
        <div>
          <dt>Input tokens</dt>
          <dd>{formatCount(row.inputTokens)}</dd>
        </div>
        <div>
          <dt>Output tokens</dt>
          <dd>{formatCount(row.outputTokens)}</dd>
        </div>
        <div>
          <dt>Total latency</dt>
          <dd>{formatLatencyDetail(row.latencyMs)}</dd>
        </div>
        <div>
          <dt>Avg per request</dt>
          <dd>{formatLatencyDetail(averageMs)}</dd>
        </div>
      </dl>
    </div>
  );
}

function CorpusReference({
  corpusId,
  corpusNameById,
}: {
  corpusId: string | null;
  corpusNameById: Map<string, string>;
}) {
  if (!corpusId) {
    return <>—</>;
  }

  const name = corpusNameById.get(corpusId);

  return (
    <div className="min-w-0">
      <div>{name ?? 'Unknown corpus'}</div>
      <div className="evukb-muted truncate font-mono text-xs" title={corpusId}>
        {corpusId}
      </div>
    </div>
  );
}

export function DiagnosticsPage() {
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [blobHealth, setBlobHealth] = useState<BlobStoreHealth | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthSummary | null>(null);
  const [vectorHealth, setVectorHealth] = useState<VectorStoreHealth | null>(null);
  const [failedJobs, setFailedJobs] = useState<FailedJobRecord[]>([]);
  const [corpora, setCorpora] = useState<KnowledgeCorpus[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageAggregateRow[]>([]);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<'retry' | 'delete' | null>(null);
  const [detailJob, setDetailJob] = useState<FailedJobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmModal } = useConfirmAction();

  const corpusNameById = useMemo(
    () => new Map(corpora.map((corpus) => [corpus.id, corpus.name])),
    [corpora],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      kbClient.getHealthDb(appConfig.workspaceId),
      kbClient.getHealthBlobStore(appConfig.workspaceId),
      kbClient.getHealthProviders(appConfig.workspaceId),
      kbClient.getHealthVectorStore(appConfig.workspaceId),
      kbClient.listFailedJobs(appConfig.workspaceId, { limit: 50 }),
      kbClient.listCorpora(appConfig.workspaceId),
      kbClient.listUsageRecords(appConfig.workspaceId, { limit: 25 }),
      kbClient.getUsageSummary(appConfig.workspaceId, {
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        groupBy: 'operationType',
      }),
    ])
      .then(([db, blob, providers, vectorStore, jobs, corporaList, usage, summary]) => {
        if (!cancelled) {
          setDbHealth(db);
          setBlobHealth(blob);
          setProviderHealth(providers);
          setVectorHealth(vectorStore);
          setFailedJobs(jobs);
          setCorpora(corporaList);
          setUsageRecords(usage);
          setUsageSummary(summary);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load diagnostics.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshFailedJobs(): Promise<void> {
    const jobs = await kbClient.listFailedJobs(appConfig.workspaceId, { limit: 50 });
    setFailedJobs(jobs);
  }

  async function handleRetry(jobId: string): Promise<void> {
    setRetryingJobId(jobId);
    try {
      await kbClient.retryFailedJob(appConfig.workspaceId, jobId);
      await refreshFailedJobs();
      setError(null);
    } catch (retryError: unknown) {
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry job.');
    } finally {
      setRetryingJobId(null);
    }
  }

  function openDeleteConfirm(job: FailedJobRecord): void {
    confirm({
      title: 'Delete failed job?',
      body: (
        <p>
          This removes the failed job record from the queue. It cannot be retried or inspected
          afterward.
        </p>
      ),
      confirmLabel: 'Delete job',
      confirmingLabel: 'Deleting…',
      confirmVariant: 'danger',
      action: async () => {
        await kbClient.deleteFailedJob(appConfig.workspaceId, job.id);
        if (detailJob?.id === job.id) {
          setDetailJob(null);
        }
        await refreshFailedJobs();
        setError(null);
      },
    });
  }

  function openDeleteAllConfirm(): void {
    confirm({
      title: `Delete ${failedJobs.length} failed jobs?`,
      body: (
        <p>
          This removes every failed job record shown here from the queue. They cannot be retried or
          inspected afterward.
        </p>
      ),
      confirmLabel: 'Delete all',
      confirmingLabel: 'Deleting…',
      confirmVariant: 'danger',
      action: async () => {
        setBulkAction('delete');
        try {
          for (const job of failedJobs) {
            await kbClient.deleteFailedJob(appConfig.workspaceId, job.id);
          }
          setDetailJob(null);
          await refreshFailedJobs();
          setError(null);
        } catch (deleteError: unknown) {
          setError(
            deleteError instanceof Error ? deleteError.message : 'Failed to delete failed jobs.',
          );
        } finally {
          setBulkAction(null);
        }
      },
    });
  }

  async function handleRetryAll(): Promise<void> {
    if (failedJobs.length === 0) {
      return;
    }

    setBulkAction('retry');
    try {
      for (const job of failedJobs) {
        await kbClient.retryFailedJob(appConfig.workspaceId, job.id);
      }
      await refreshFailedJobs();
      setError(null);
    } catch (retryError: unknown) {
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry failed jobs.');
    } finally {
      setBulkAction(null);
    }
  }

  return (
    <>
      <PageHeader
        description="Workspace health probes, usage telemetry, and recent failed background jobs."
        title="Diagnostics"
      />
      <section className="evukb-panel">
        {error ? <p className="evukb-error">{error}</p> : null}
        {loading ? <p className="evukb-muted">Loading diagnostics…</p> : null}
        {!loading ? (
          <>
            <div className="evukb-stat-grid">
              <div className="evukb-stat-card">
                <strong>Database</strong>
                <p>
                  <StatusPill tone={healthTone(dbHealth?.status ?? 'not-configured')}>
                    {dbHealth?.status ?? 'unknown'}
                  </StatusPill>
                </p>
                {dbHealth?.migrationsApplied !== undefined ? (
                  <p>Migrations applied: {dbHealth.migrationsApplied}</p>
                ) : null}
              </div>
              <div className="evukb-stat-card">
                <strong>Blob store</strong>
                <p>
                  <StatusPill tone={healthTone(blobHealth?.status ?? 'not-configured')}>
                    {blobHealth?.status ?? 'unknown'}
                  </StatusPill>
                </p>
                {blobHealth?.root ? <p>Root: {blobHealth.root}</p> : null}
              </div>
              <div className="evukb-stat-card">
                <strong>Embedding provider</strong>
                <p>
                  <StatusPill
                    tone={healthTone(providerHealth?.embedding.status ?? 'not-configured')}
                  >
                    {providerHealth?.embedding.status ?? 'unknown'}
                  </StatusPill>
                </p>
                {providerHealth?.embedding.model ? (
                  <p>Model: {providerHealth.embedding.model}</p>
                ) : null}
              </div>
              <div className="evukb-stat-card">
                <strong>Chat provider</strong>
                <p>
                  <StatusPill tone={healthTone(providerHealth?.chat.status ?? 'not-configured')}>
                    {providerHealth?.chat.status ?? 'unknown'}
                  </StatusPill>
                </p>
                {providerHealth?.chat.model ? <p>Model: {providerHealth.chat.model}</p> : null}
              </div>
              <div className="evukb-stat-card">
                <strong>Vector store</strong>
                <p>
                  <StatusPill tone={healthTone(vectorHealth?.status ?? 'not-configured')}>
                    {vectorHealth?.status ?? 'unknown'}
                  </StatusPill>
                </p>
                {vectorHealth?.backend ? <p>Backend: {vectorHealth.backend}</p> : null}
                {vectorHealth?.message ? <p>{vectorHealth.message}</p> : null}
                {vectorHealth?.backend === 'qdrant' ? (
                  <p className="evukb-form-hint">
                    Switching vector backends requires a corpus reindex.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="min-w-0">
              <h2>Usage summary (last 7 days)</h2>
              {usageSummary.length === 0 ? (
                <EmptyState
                  title="No usage recorded"
                  hint="Ask, rerank, and indexing usage appears here."
                />
              ) : (
                <div className="evukb-stat-grid-half">
                  {usageSummary.map((row) => (
                    <UsageSummaryCard key={row.operationType} row={row} />
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2>Failed jobs</h2>
                {failedJobs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      aria-label={
                        bulkAction === 'retry'
                          ? 'Retrying all failed jobs'
                          : 'Retry all failed jobs'
                      }
                      disabled={bulkAction !== null || retryingJobId !== null}
                      onClick={() => void handleRetryAll()}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <RotateCw
                        aria-hidden
                        className={`h-4 w-4${bulkAction === 'retry' ? ' animate-spin' : ''}`}
                      />
                    </Button>
                    <Button
                      aria-label="Delete all failed jobs"
                      disabled={bulkAction !== null || retryingJobId !== null}
                      onClick={openDeleteAllConfirm}
                      size="icon"
                      type="button"
                      variant="dangerOutline"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
              {failedJobs.length === 0 ? (
                <EmptyState title="No failed jobs" hint="Background jobs are healthy." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Queue</TableHead>
                      <TableHead>Corpus</TableHead>
                      <TableHead>Failed at</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.queueName}</TableCell>
                        <TableCell>
                          <CorpusReference
                            corpusId={job.corpusId}
                            corpusNameById={corpusNameById}
                          />
                        </TableCell>
                        <TableCell>{new Date(job.failedAt).toLocaleString()}</TableCell>
                        <TableCell>{job.errorMessage ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap align-middle">
                          <div className="flex items-center gap-2">
                            <Button
                              aria-label="View job details"
                              onClick={() => setDetailJob(job)}
                              size="icon"
                              type="button"
                              variant="outline"
                            >
                              <Eye aria-hidden className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={retryingJobId === job.id ? 'Retrying job' : 'Retry job'}
                              disabled={retryingJobId === job.id || bulkAction !== null}
                              onClick={() => void handleRetry(job.id)}
                              size="icon"
                              type="button"
                              variant="outline"
                            >
                              <RotateCw
                                aria-hidden
                                className={`h-4 w-4${retryingJobId === job.id ? ' animate-spin' : ''}`}
                              />
                            </Button>
                            <Button
                              aria-label="Delete job"
                              disabled={retryingJobId === job.id || bulkAction !== null}
                              onClick={() => openDeleteConfirm(job)}
                              size="icon"
                              type="button"
                              variant="dangerOutline"
                            >
                              <Trash2 aria-hidden className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <h2>Recent usage</h2>
            {usageRecords.length === 0 ? (
              <EmptyState
                title="No recent usage"
                hint="Provider-backed operations will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Corpus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{record.operationType}</TableCell>
                      <TableCell>{record.model}</TableCell>
                      <TableCell>
                        {record.inputTokens ?? '—'} / {record.outputTokens ?? '—'}
                      </TableCell>
                      <TableCell>{record.latencyMs} ms</TableCell>
                      <TableCell>
                        <CorpusReference
                          corpusId={record.corpusId ?? null}
                          corpusNameById={corpusNameById}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : null}

        <AppModal
          footer={
            <Button onClick={() => setDetailJob(null)} type="button" variant="outline">
              Close
            </Button>
          }
          onClose={() => setDetailJob(null)}
          open={detailJob !== null}
          size="lg"
          title={detailJob ? `Failed job: ${detailJob.queueName}` : 'Failed job'}
        >
          {detailJob ? (
            <div className="flex flex-col gap-4">
              <dl className="evukb-settings-dl">
                <div>
                  <dt>Job ID</dt>
                  <dd>{detailJob.id}</dd>
                </div>
                <div>
                  <dt>Queue</dt>
                  <dd>{detailJob.queueName}</dd>
                </div>
                <div>
                  <dt>Failed at</dt>
                  <dd>{new Date(detailJob.failedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Corpus</dt>
                  <dd>
                    <CorpusReference
                      corpusId={detailJob.corpusId}
                      corpusNameById={corpusNameById}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Node</dt>
                  <dd>{detailJob.nodeId ?? '—'}</dd>
                </div>
                <div>
                  <dt>File path</dt>
                  <dd className="break-all font-mono text-sm">{detailJob.filePath ?? '—'}</dd>
                </div>
                <div>
                  <dt>Summary</dt>
                  <dd>{detailJob.errorMessage ?? '—'}</dd>
                </div>
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Error output</h3>
                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                  {formatDiagnosticsJson(detailJob.output)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Job payload</h3>
                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                  {formatDiagnosticsJson(detailJob.payload)}
                </pre>
              </div>
            </div>
          ) : null}
        </AppModal>
        {confirmModal}
      </section>
    </>
  );
}
