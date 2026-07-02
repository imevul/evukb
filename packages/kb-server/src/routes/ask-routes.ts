import type { CorpusAskRequest, WorkspaceAskRequest } from '@evu/kb-core';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import type { AskService } from '../services/ask-service.js';
import { corpusAskBodySchema, parseBody, workspaceAskBodySchema } from './body-schemas.js';

export type AskRoutesOptions = {
  askService: AskService;
};

async function writeAskStream(
  reply: import('fastify').FastifyReply,
  events: AsyncIterable<import('@evu/kb-core').AskStreamEvent>,
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  for await (const event of events) {
    reply.raw.write(`event: ask\ndata: ${JSON.stringify(event)}\n\n`);
  }

  reply.raw.end();
}

export const askRoutesPlugin: FastifyPluginAsync<AskRoutesOptions> = async (server, options) => {
  server.post<{ Body: WorkspaceAskRequest }>('/ask', async (request, reply) => {
    parseBody(workspaceAskBodySchema, request.body);
    if (!request.body?.question?.trim()) {
      throw ApiError.validation('Question is required.');
    }

    if (request.body?.stream === true) {
      await writeAskStream(
        reply,
        options.askService.askCorporaStream(request.evuKbWorkspace.id, request.body),
      );
      return reply;
    }

    return options.askService.askCorpora(request.evuKbWorkspace.id, request.body);
  });

  server.post<{
    Params: { corpusId: string };
    Body: CorpusAskRequest;
  }>('/knowledge-corpora/:corpusId/ask', async (request, reply) => {
    parseBody(corpusAskBodySchema, request.body);
    if (!request.body?.question?.trim()) {
      throw ApiError.validation('Question is required.');
    }

    const workspaceRequest: WorkspaceAskRequest = {
      question: request.body.question,
      corpusIds: [request.params.corpusId],
      ...(request.body.nodeId !== undefined ? { nodeId: request.body.nodeId } : {}),
      ...(request.body.pathPrefix !== undefined ? { pathPrefix: request.body.pathPrefix } : {}),
      ...(request.body.filters !== undefined ? { filters: request.body.filters } : {}),
      ...(request.body.maxContextChunks !== undefined
        ? { maxContextChunks: request.body.maxContextChunks }
        : {}),
      ...(request.body.responseMode !== undefined
        ? { responseMode: request.body.responseMode }
        : {}),
      ...(request.body.stream !== undefined ? { stream: request.body.stream } : {}),
      ...(request.body.rankingStrategyId !== undefined
        ? { rankingStrategyId: request.body.rankingStrategyId }
        : {}),
    };

    if (request.body?.stream === true) {
      await writeAskStream(
        reply,
        options.askService.askCorporaStream(request.evuKbWorkspace.id, workspaceRequest),
      );
      return reply;
    }

    return options.askService.ask(request.evuKbWorkspace.id, request.params.corpusId, request.body);
  });
};
