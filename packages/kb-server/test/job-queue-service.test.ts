import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { JobQueueService } from '../src/jobs/job-queue-service.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

if (databaseUrl) {
  vi.setConfig({ testTimeout: 60_000 });
}

describeIfDb('JobQueueService', () => {
  it('enqueues and processes index jobs', async () => {
    const processed: string[] = [];
    const jobQueue = new JobQueueService({
      connectionString: databaseUrl as string,
      handlers: {
        onIndexNode: async (job) => {
          processed.push(job.nodeId);
        },
        onOkfMaintain: async () => undefined,
        onCitationValidate: async () => undefined,
        onMountSync: async () => undefined,
        onGitSync: async () => undefined,
        onGitWriteback: async () => undefined,
        onMountSyncSchedule: async () => undefined,
        onCorpusReindex: async () => undefined,
      },
    });

    await jobQueue.start();
    try {
      const nodeId = randomUUID();
      const jobId = await jobQueue.enqueueIndex({
        workspaceId: randomUUID(),
        corpusId: randomUUID(),
        nodeId,
      });
      expect(jobId).toBeTruthy();
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (processed.includes(nodeId)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(processed).toContain(nodeId);
    } finally {
      await jobQueue.stop();
    }
  });
});
