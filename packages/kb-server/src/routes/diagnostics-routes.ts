import type { ChatProvider, EmbeddingProvider, VectorStore } from '@evu/kb-core';
import type { NodeRepository } from '@evu/kb-db';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import { probeBlobStore, probeDatabase, probeProviders } from '../health-probes.js';
import { enrichFailedJobsWithFilePaths } from '../jobs/failed-job-enrichment.js';
import { JobQueueError, type JobQueueService } from '../jobs/job-queue-service.js';

export function mapJobQueueErrorToApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof JobQueueError) {
    switch (error.code) {
      case 'job_not_found':
        return ApiError.notFound(error.message);
      case 'job_workspace_mismatch':
        return ApiError.forbidden(error.message);
      case 'job_not_retryable':
        return ApiError.validation(error.message);
    }
  }
  return ApiError.validation(error instanceof Error ? error.message : fallbackMessage);
}

export type DiagnosticsRoutesOptions = {
  jobQueue: JobQueueService;
  nodes: NodeRepository;
  connectionString?: string;
  blobRoot?: string;
  embeddingProvider?: EmbeddingProvider | null;
  chatProvider?: ChatProvider | null;
  vectorStore?: VectorStore | null;
};

export const diagnosticsRoutesPlugin: FastifyPluginAsync<DiagnosticsRoutesOptions> = async (
  server,
  options,
) => {
  server.get('/health/db', async () => {
    return probeDatabase(options.connectionString);
  });

  server.get('/health/blob-store', async () => {
    return probeBlobStore(options.blobRoot).health;
  });

  server.get('/health/providers', async () => {
    return probeProviders({
      ...(options.embeddingProvider !== undefined
        ? { embeddingProvider: options.embeddingProvider }
        : {}),
      ...(options.chatProvider !== undefined ? { chatProvider: options.chatProvider } : {}),
    });
  });

  server.get('/health/vector-store', async () => {
    if (!options.vectorStore) {
      return {
        backend: 'pgvector' as const,
        status: 'not-configured' as const,
        message: 'Vector store is not configured.',
      };
    }
    return options.vectorStore.health();
  });

  server.get<{ Querystring: { limit?: string } }>('/jobs/failed', async (request) => {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 50;
    const jobs = await options.jobQueue.listFailedJobs(request.evuKbWorkspace.id, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return enrichFailedJobsWithFilePaths(options.nodes, request.evuKbWorkspace.id, jobs);
  });

  server.post<{ Params: { jobId: string } }>('/jobs/:jobId/retry', async (request) => {
    try {
      return await options.jobQueue.retryFailedJob(request.evuKbWorkspace.id, request.params.jobId);
    } catch (error) {
      throw mapJobQueueErrorToApiError(error, 'Failed to retry job.');
    }
  });

  server.delete<{ Params: { jobId: string } }>('/jobs/:jobId', async (request, reply) => {
    try {
      const result = await options.jobQueue.deleteFailedJob(
        request.evuKbWorkspace.id,
        request.params.jobId,
      );
      return reply.status(200).send(result);
    } catch (error) {
      throw mapJobQueueErrorToApiError(error, 'Failed to delete job.');
    }
  });
};
