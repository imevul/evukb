import type { CorpusRepository } from '@evu/kb-db';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import type { CorpusIndexEventHub } from '../services/corpus-index-event-hub.js';
import type { IndexJobService } from '../services/index-job-service.js';
import { indexNodesBodySchema, parseBody } from './body-schemas.js';

export type IndexRoutesOptions = {
  corpora: CorpusRepository;
  indexEventHub: CorpusIndexEventHub;
  indexJobService: IndexJobService;
};

const INDEX_EVENTS_HEARTBEAT_MS = 25_000;

async function writeIndexEventStream(
  reply: import('fastify').FastifyReply,
  hub: CorpusIndexEventHub,
  workspaceId: string,
  corpusId: string,
  requestRaw: import('node:stream').Readable,
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n');
  }, INDEX_EVENTS_HEARTBEAT_MS);

  const unsubscribe = hub.subscribe(workspaceId, corpusId, (event) => {
    reply.raw.write(`event: index\ndata: ${JSON.stringify(event)}\n\n`);
  });

  await new Promise<void>((resolve) => {
    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
      resolve();
    };
    requestRaw.on('close', cleanup);
    requestRaw.on('error', cleanup);
  });
}

export const indexRoutesPlugin: FastifyPluginAsync<IndexRoutesOptions> = async (
  server,
  options,
) => {
  server.get<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/index-events',
    async (request, reply) => {
      const corpus = await options.corpora.getById(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
      if (!corpus) {
        throw ApiError.corpusNotFound(request.params.corpusId);
      }

      await writeIndexEventStream(
        reply,
        options.indexEventHub,
        request.evuKbWorkspace.id,
        request.params.corpusId,
        request.raw,
      );
      return reply;
    },
  );

  server.post<{ Params: { corpusId: string }; Body: { nodeIds: string[] } }>(
    '/knowledge-corpora/:corpusId/reindex',
    async (request) => {
      const { nodeIds } = parseBody(indexNodesBodySchema, request.body);
      if (nodeIds.length === 0) {
        throw ApiError.validation('nodeIds must contain at least one id.');
      }
      return options.indexJobService.enqueueNodes(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        nodeIds,
      );
    },
  );

  server.post<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/reindex-all',
    async (request) => {
      return options.indexJobService.enqueueCorpus(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
    },
  );

  server.post<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/reindex-needing',
    async (request) => {
      return options.indexJobService.enqueueNeedingAttention(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
    },
  );
};
