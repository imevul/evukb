import type { AskToolRequest, KbToolRequest, KbWriteActor } from '@evu/kb-core';
import { isKbReadAction, isKbWriteAction } from '@evu/kb-core';
import type { FastifyPluginAsync } from 'fastify';

import { isHttpAuthRequired } from '../auth/http-auth.js';
import { isApiKeySecret } from '../auth/token-hash.js';
import { ApiError } from '../errors.js';
import type { AskService } from '../services/ask-service.js';
import type { KbToolService } from '../services/kb-tool-service.js';
import type { TokenAuthService } from '../services/token-auth-service.js';

export type KbToolRoutesOptions = {
  kbToolService: KbToolService;
  tokenAuth: TokenAuthService;
  askService: AskService;
};

async function resolveKbToolAuth(
  tokenAuth: TokenAuthService,
  workspaceId: string,
  authorization: string | undefined,
  requireWrite: boolean,
): Promise<KbWriteActor> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim();

  if (bearer) {
    const authenticated = await tokenAuth.authenticateApiBearer(bearer);
    if (!authenticated) {
      if (isApiKeySecret(bearer)) {
        throw ApiError.forbidden('Invalid or expired API key.');
      }
      throw ApiError.forbidden('Invalid or missing API key.');
    }

    if (authenticated.workspaceId !== workspaceId) {
      throw ApiError.forbidden('API key workspace does not match request workspace.');
    }

    const hasWrite = authenticated.scopes.includes('kb:write');
    const hasRead = authenticated.scopes.includes('kb:read') || hasWrite;

    if (requireWrite) {
      if (!hasWrite) {
        throw ApiError.forbidden('API key is missing kb:write scope.');
      }
    } else if (!hasRead) {
      throw ApiError.forbidden('API key is missing kb:read scope.');
    }

    return { kind: 'api_key', tokenId: authenticated.tokenId };
  }

  if (isHttpAuthRequired()) {
    throw ApiError.forbidden(
      requireWrite
        ? 'API key with kb:write scope is required.'
        : 'API key with kb:read scope is required.',
    );
  }

  return { kind: 'open' };
}

function parseKbToolRequest(body: unknown): KbToolRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.validation('Request body must be a JSON object.');
  }

  const action = (body as { action?: unknown }).action;
  if (typeof action !== 'string') {
    throw ApiError.validation('action is required.');
  }

  if (isKbReadAction(action) || isKbWriteAction(action)) {
    return body as KbToolRequest;
  }

  throw ApiError.validation(`Unsupported kb tool action: ${action}`);
}

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

function isAskToolRequest(request: KbToolRequest): request is AskToolRequest {
  return request.action === 'ask';
}

export const kbToolRoutesPlugin: FastifyPluginAsync<KbToolRoutesOptions> = async (app, options) => {
  app.post('/tools/kb', async (request, reply) => {
    const toolRequest = parseKbToolRequest(request.body);
    const requireWrite = isKbWriteAction(toolRequest.action);
    const actor = await resolveKbToolAuth(
      options.tokenAuth,
      request.evuKbWorkspace.id,
      request.headers.authorization,
      requireWrite,
    );

    if (isAskToolRequest(toolRequest) && toolRequest.stream === true) {
      const corpusIds =
        toolRequest.corpusIds ?? (toolRequest.corpusId ? [toolRequest.corpusId] : undefined);
      if (!corpusIds || corpusIds.length === 0) {
        throw ApiError.validation('corpusId or corpusIds is required for ask.');
      }
      if (!toolRequest.question?.trim()) {
        throw ApiError.validation('question is required for ask.');
      }

      await writeAskStream(
        reply,
        options.askService.askCorporaStream(request.evuKbWorkspace.id, {
          question: toolRequest.question,
          corpusIds,
          ...(toolRequest.nodeId !== undefined ? { nodeId: toolRequest.nodeId } : {}),
          ...(toolRequest.pathPrefix !== undefined ? { pathPrefix: toolRequest.pathPrefix } : {}),
          ...(toolRequest.filters !== undefined ? { filters: toolRequest.filters } : {}),
          ...(toolRequest.maxContextChunks !== undefined
            ? { maxContextChunks: toolRequest.maxContextChunks }
            : {}),
          ...(toolRequest.responseMode !== undefined
            ? { responseMode: toolRequest.responseMode }
            : {}),
          ...(toolRequest.rankingStrategyId !== undefined
            ? { rankingStrategyId: toolRequest.rankingStrategyId }
            : {}),
          stream: true,
        }),
      );
      return reply;
    }

    return options.kbToolService.execute(request.evuKbWorkspace.id, actor, toolRequest);
  });
};
