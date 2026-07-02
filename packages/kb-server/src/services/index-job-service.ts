import { type IndexEnqueueResponse, needingAttentionIndexStatuses } from '@evu/kb-core';
import type { NodeRepository } from '@evu/kb-db';

import type { JobQueueService } from '../jobs/job-queue-service.js';

export type IndexJobServiceDeps = {
  jobQueue: JobQueueService;
  nodes: NodeRepository;
};

export class IndexJobService {
  readonly #jobQueue: JobQueueService;
  readonly #nodes: NodeRepository;

  constructor(deps: IndexJobServiceDeps) {
    this.#jobQueue = deps.jobQueue;
    this.#nodes = deps.nodes;
  }

  async enqueueNodes(
    workspaceId: string,
    corpusId: string,
    nodeIds: string[],
  ): Promise<IndexEnqueueResponse> {
    const enqueued = await this.#jobQueue.enqueueIndexMany(
      nodeIds.map((nodeId) => ({ workspaceId, corpusId, nodeId })),
    );
    return { enqueued, nodeIds };
  }

  async enqueueCorpus(workspaceId: string, corpusId: string): Promise<IndexEnqueueResponse> {
    const nodes = await this.#nodes.listIndexableFilesByCorpus(workspaceId, corpusId);
    const nodeIds = nodes.map((node) => node.id);
    await this.#jobQueue.enqueueCorpusReindex({ workspaceId, corpusId });
    return { enqueued: nodeIds.length, nodeIds };
  }

  async runCorpusReindex(workspaceId: string, corpusId: string): Promise<IndexEnqueueResponse> {
    const nodes = await this.#nodes.listIndexableFilesByCorpus(workspaceId, corpusId);
    const nodeIds = nodes.map((node) => node.id);
    const enqueued = await this.#jobQueue.enqueueIndexMany(
      nodeIds.map((nodeId) => ({ workspaceId, corpusId, nodeId })),
    );
    return { enqueued, nodeIds };
  }

  async enqueueNeedingAttention(
    workspaceId: string,
    corpusId: string,
  ): Promise<IndexEnqueueResponse> {
    const nodes = await this.#nodes.listIndexableFilesByCorpus(workspaceId, corpusId);
    const nodeIds = nodes
      .filter((node) =>
        needingAttentionIndexStatuses.includes(
          node.indexStatus as (typeof needingAttentionIndexStatuses)[number],
        ),
      )
      .map((node) => node.id);
    const enqueued = await this.#jobQueue.enqueueIndexMany(
      nodeIds.map((nodeId) => ({ workspaceId, corpusId, nodeId })),
    );
    return { enqueued, nodeIds };
  }
}
