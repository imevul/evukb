import type { FailedJobRecord } from '@evu/kb-core';
import { PgBoss } from 'pg-boss';

import {
  ACTIVE_JOB_QUEUES,
  JOB_QUEUE_CITATION_VALIDATE,
  JOB_QUEUE_CORPUS_REINDEX,
  JOB_QUEUE_GIT_SYNC,
  JOB_QUEUE_GIT_WRITEBACK,
  JOB_QUEUE_INDEX,
  JOB_QUEUE_MOUNT_SYNC,
  JOB_QUEUE_MOUNT_SYNC_SCHEDULE,
  JOB_QUEUE_OKF_MAINTAIN,
  REGISTERED_JOB_QUEUES,
} from './queue-names.js';
import type {
  CitationValidateJob,
  CorpusJobCounts,
  CorpusReindexJob,
  GitSyncJob,
  GitWritebackJob,
  IndexNodeJob,
  MountSyncJob,
  OkfMaintainJob,
} from './types.js';

function parseJobOutput(output: unknown): unknown {
  if (output === null || output === undefined) {
    return null;
  }
  if (typeof output === 'string') {
    try {
      return JSON.parse(output) as unknown;
    } catch {
      return output;
    }
  }
  return output;
}

function summarizeJobOutput(output: unknown): string | null {
  const parsed = parseJobOutput(output);
  if (parsed === null) {
    return null;
  }
  if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
    return String((parsed as { message?: unknown }).message ?? '');
  }
  if (typeof parsed === 'string') {
    return parsed;
  }
  return JSON.stringify(parsed);
}

export type JobQueueErrorCode = 'job_not_found' | 'job_not_retryable' | 'job_workspace_mismatch';

export class JobQueueError extends Error {
  readonly code: JobQueueErrorCode;

  constructor(code: JobQueueErrorCode, message: string) {
    super(message);
    this.name = 'JobQueueError';
    this.code = code;
  }
}

export type JobQueueHandlers = {
  onIndexNode: (job: IndexNodeJob) => Promise<void>;
  onOkfMaintain: (job: OkfMaintainJob) => Promise<void>;
  onCitationValidate: (job: CitationValidateJob) => Promise<void>;
  onMountSync: (job: MountSyncJob) => Promise<void>;
  onGitSync: (job: GitSyncJob) => Promise<void>;
  onGitWriteback: (job: GitWritebackJob) => Promise<void>;
  onMountSyncSchedule: () => Promise<void>;
  onCorpusReindex: (job: CorpusReindexJob) => Promise<void>;
};

export type JobQueueServiceDeps = {
  connectionString: string;
  handlers: JobQueueHandlers;
};

const OKF_MAINTAIN_DEBOUNCE_SECONDS = 2;
const JOB_IDLE_POLL_MS = 100;

export class JobQueueService {
  readonly #boss: PgBoss;
  readonly #handlers: JobQueueHandlers;
  #started = false;
  #workerIds: string[] = [];

  constructor(deps: JobQueueServiceDeps) {
    this.#boss = new PgBoss(deps.connectionString);
    this.#handlers = deps.handlers;
  }

  async start(): Promise<void> {
    if (this.#started) {
      return;
    }

    await this.#boss.start();

    for (const queueName of REGISTERED_JOB_QUEUES) {
      await this.#boss.createQueue(queueName);
    }

    this.#workerIds.push(
      await this.#boss.work<IndexNodeJob>(JOB_QUEUE_INDEX, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onIndexNode(job.data);
        }
      }),
    );

    this.#workerIds.push(
      await this.#boss.work<OkfMaintainJob>(JOB_QUEUE_OKF_MAINTAIN, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onOkfMaintain(job.data);
        }
      }),
    );

    this.#workerIds.push(
      await this.#boss.work<CitationValidateJob>(JOB_QUEUE_CITATION_VALIDATE, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onCitationValidate(job.data);
        }
      }),
    );

    this.#workerIds.push(
      await this.#boss.work<MountSyncJob>(JOB_QUEUE_MOUNT_SYNC, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onMountSync(job.data);
        }
      }),
    );

    this.#workerIds.push(
      await this.#boss.work<GitSyncJob>(JOB_QUEUE_GIT_SYNC, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onGitSync(job.data);
        }
      }),
    );

    this.#workerIds.push(
      await this.#boss.work<GitWritebackJob>(JOB_QUEUE_GIT_WRITEBACK, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onGitWriteback(job.data);
        }
      }),
    );

    this.#workerIds.push(
      await this.#boss.work(JOB_QUEUE_MOUNT_SYNC_SCHEDULE, async () => {
        await this.#handlers.onMountSyncSchedule();
      }),
    );

    this.#workerIds.push(
      await this.#boss.work<CorpusReindexJob>(JOB_QUEUE_CORPUS_REINDEX, async (jobs) => {
        for (const job of jobs) {
          await this.#handlers.onCorpusReindex(job.data);
        }
      }),
    );

    this.#started = true;
  }

  async scheduleSyncTick(
    cron = process.env.EVUKB_SYNC_SCHEDULE_CRON ?? '*/5 * * * *',
  ): Promise<void> {
    await this.#boss.schedule(JOB_QUEUE_MOUNT_SYNC_SCHEDULE, cron, {});
  }

  async clearQueuedJobs(): Promise<void> {
    for (const queueName of ACTIVE_JOB_QUEUES) {
      await this.#boss.deleteQueuedJobs(queueName);
    }
  }

  async stop(): Promise<void> {
    if (!this.#started) {
      return;
    }

    for (const queueName of ACTIVE_JOB_QUEUES) {
      await this.#boss.offWork(queueName, { wait: true });
    }
    this.#workerIds = [];
    await this.#boss.stop();
    this.#started = false;
  }

  async enqueueIndex(job: IndexNodeJob): Promise<string | null> {
    return this.#boss.send(JOB_QUEUE_INDEX, job, {
      singletonKey: `${job.workspaceId}:${job.corpusId}:${job.nodeId}`,
    });
  }

  async enqueueIndexMany(jobs: IndexNodeJob[]): Promise<number> {
    let enqueued = 0;
    for (const job of jobs) {
      const id = await this.enqueueIndex(job);
      if (id) {
        enqueued += 1;
      }
    }
    return enqueued;
  }

  async enqueueOkfMaintain(job: OkfMaintainJob): Promise<string | null> {
    const singletonKey = `${job.workspaceId}:${job.corpusId}:${job.folderPath}`;
    return this.#boss.sendDebounced(
      JOB_QUEUE_OKF_MAINTAIN,
      job,
      { singletonKey },
      OKF_MAINTAIN_DEBOUNCE_SECONDS,
      singletonKey,
    );
  }

  async enqueueCitationValidate(job: CitationValidateJob): Promise<string | null> {
    return this.#boss.send(JOB_QUEUE_CITATION_VALIDATE, job, {
      singletonKey: `${job.workspaceId}:${job.corpusId}:${job.nodeId}`,
    });
  }

  async enqueueMountSync(job: MountSyncJob): Promise<string | null> {
    return this.#boss.send(JOB_QUEUE_MOUNT_SYNC, job, {
      singletonKey: `${job.workspaceId}:${job.corpusId}`,
    });
  }

  async enqueueGitSync(job: GitSyncJob): Promise<string | null> {
    return this.#boss.send(JOB_QUEUE_GIT_SYNC, job, {
      singletonKey: `${job.workspaceId}:${job.corpusId}`,
    });
  }

  async enqueueGitWriteback(job: GitWritebackJob): Promise<string | null> {
    const pathKey = job.changes.map((change) => `${change.op}:${change.relativePath}`).join('|');
    return this.#boss.send(JOB_QUEUE_GIT_WRITEBACK, job, {
      singletonKey: `${job.workspaceId}:${job.corpusId}:${pathKey}`,
    });
  }

  async enqueueCorpusReindex(job: CorpusReindexJob): Promise<string | null> {
    return this.#boss.send(JOB_QUEUE_CORPUS_REINDEX, job, {
      singletonKey: `${job.workspaceId}:${job.corpusId}:reindex`,
    });
  }

  async retryFailedJob(
    workspaceId: string,
    jobId: string,
  ): Promise<{ jobId: string; queueName: string; retried: true }> {
    const row = await this.#loadFailedJobForWorkspace(workspaceId, jobId);
    await this.#boss.retry(row.name, row.id);
    return { jobId: row.id, queueName: row.name, retried: true };
  }

  async deleteFailedJob(
    workspaceId: string,
    jobId: string,
  ): Promise<{ jobId: string; queueName: string; deleted: true }> {
    const row = await this.#loadFailedJobForWorkspace(workspaceId, jobId);
    await this.#boss.deleteJob(row.name, row.id);
    return { jobId: row.id, queueName: row.name, deleted: true };
  }

  async #loadFailedJobForWorkspace(
    workspaceId: string,
    jobId: string,
  ): Promise<{ id: string; name: string; data: Record<string, unknown> }> {
    const db = this.#boss.getDb();
    const result = await db.executeSql(
      `SELECT id, name, data, state
       FROM pgboss.job
       WHERE id = $1
       LIMIT 1`,
      [jobId],
    );

    const row = result.rows[0] as
      | {
          id: string;
          name: string;
          data: Record<string, unknown> | null;
          state: string;
        }
      | undefined;

    if (row?.state !== 'failed') {
      throw new JobQueueError('job_not_found', 'Failed job not found.');
    }

    if (!ACTIVE_JOB_QUEUES.includes(row.name as (typeof ACTIVE_JOB_QUEUES)[number])) {
      throw new JobQueueError('job_not_retryable', 'Job queue is not retryable.');
    }

    const data = row.data ?? {};
    if (data.workspaceId !== workspaceId) {
      throw new JobQueueError('job_workspace_mismatch', 'Job does not belong to this workspace.');
    }

    return { id: row.id, name: row.name, data };
  }

  async listFailedJobs(
    workspaceId: string,
    options: { limit?: number } = {},
  ): Promise<FailedJobRecord[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const db = this.#boss.getDb();
    const result = await db.executeSql(
      `SELECT id, name, data, output, completed_on
       FROM pgboss.job
       WHERE state = 'failed'
         AND data->>'workspaceId' = $1
         AND name = ANY($2::text[])
       ORDER BY completed_on DESC NULLS LAST
       LIMIT $3`,
      [workspaceId, ACTIVE_JOB_QUEUES, limit],
    );

    return (
      result.rows as Array<{
        id: string;
        name: string;
        data: Record<string, unknown> | null;
        output: { message?: string } | string | null;
        completed_on: string | Date | null;
      }>
    ).map((row) => {
      const data = row.data ?? {};
      const output = parseJobOutput(row.output);
      const failedAt =
        row.completed_on instanceof Date
          ? row.completed_on.toISOString()
          : row.completed_on
            ? String(row.completed_on)
            : new Date(0).toISOString();

      return {
        id: row.id,
        queueName: row.name,
        workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : null,
        corpusId: typeof data.corpusId === 'string' ? data.corpusId : null,
        nodeId: typeof data.nodeId === 'string' ? data.nodeId : null,
        filePath: null,
        failedAt,
        errorMessage: summarizeJobOutput(output),
        output,
        payload: data,
      };
    });
  }

  async countCorpusJobs(workspaceId: string, corpusId: string): Promise<CorpusJobCounts> {
    const db = this.#boss.getDb();
    const result = await db.executeSql(
      `SELECT state, COUNT(*)::int AS count
       FROM pgboss.job
       WHERE name = ANY($1::text[])
         AND data->>'workspaceId' = $2
         AND data->>'corpusId' = $3
         AND state IN ('created', 'retry', 'active', 'failed')
       GROUP BY state`,
      [ACTIVE_JOB_QUEUES, workspaceId, corpusId],
    );

    let pendingJobCount = 0;
    let failedJobCount = 0;
    for (const row of result.rows as Array<{ state: string; count: number }>) {
      if (row.state === 'failed') {
        failedJobCount += row.count;
        continue;
      }
      pendingJobCount += row.count;
    }

    return { pendingJobCount, failedJobCount };
  }

  async waitForIdle(timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const db = this.#boss.getDb();
      const result = await db.executeSql(
        `SELECT COUNT(*)::int AS count
         FROM pgboss.job
         WHERE name = ANY($1::text[])
           AND state IN ('created', 'retry', 'active')`,
        [ACTIVE_JOB_QUEUES],
      );
      const count = (result.rows[0] as { count: number } | undefined)?.count ?? 0;
      if (count === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, JOB_IDLE_POLL_MS));
    }
    throw new Error('Job queue did not become idle before timeout.');
  }
}

export async function waitForJobIdle(
  jobQueue: JobQueueService | undefined,
  timeoutMs = 15_000,
): Promise<void> {
  if (!jobQueue) {
    return;
  }
  await jobQueue.waitForIdle(timeoutMs);
}
