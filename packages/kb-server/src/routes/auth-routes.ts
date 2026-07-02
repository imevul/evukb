import type { KbAuthScope } from '@evu/kb-core';
import type { FastifyPluginAsync } from 'fastify';

import type { TokenAuthService } from '../services/token-auth-service.js';
import { parseBody, tokenCreateBodySchema } from './body-schemas.js';

export type AuthRoutesOptions = {
  tokenAuth: TokenAuthService;
};

type CreateTokenBody = {
  name: string;
  scopes?: KbAuthScope[];
  expiresAt?: string | null;
};

export const authRoutesPlugin: FastifyPluginAsync<AuthRoutesOptions> = async (server, options) => {
  server.get('/mcp-tokens', async (request) => {
    return options.tokenAuth.listMcpTokens(request.evuKbWorkspace.id);
  });

  server.post<{ Body: CreateTokenBody }>('/mcp-tokens', async (request, reply) => {
    parseBody(tokenCreateBodySchema, request.body);
    const created = await options.tokenAuth.createMcpToken({
      workspaceId: request.evuKbWorkspace.id,
      name: request.body.name,
      ...(request.body.scopes !== undefined ? { scopes: request.body.scopes } : {}),
      ...(request.body.expiresAt !== undefined ? { expiresAt: request.body.expiresAt } : {}),
    });
    reply.code(201);
    return created;
  });

  server.delete<{ Params: { tokenId: string } }>('/mcp-tokens/:tokenId', async (request, reply) => {
    await options.tokenAuth.revokeMcpToken(request.evuKbWorkspace.id, request.params.tokenId);
    reply.code(204);
    return;
  });

  server.post<{ Params: { tokenId: string } }>(
    '/mcp-tokens/:tokenId/rotate',
    async (request, reply) => {
      const rotated = await options.tokenAuth.rotateMcpToken(
        request.evuKbWorkspace.id,
        request.params.tokenId,
      );
      reply.code(201);
      return rotated;
    },
  );

  server.get('/api-keys', async (request) => {
    return options.tokenAuth.listApiKeys(request.evuKbWorkspace.id);
  });

  server.post<{ Body: CreateTokenBody }>('/api-keys', async (request, reply) => {
    parseBody(tokenCreateBodySchema, request.body);
    const created = await options.tokenAuth.createApiKey({
      workspaceId: request.evuKbWorkspace.id,
      name: request.body.name,
      ...(request.body.scopes !== undefined ? { scopes: request.body.scopes } : {}),
      ...(request.body.expiresAt !== undefined ? { expiresAt: request.body.expiresAt } : {}),
    });
    reply.code(201);
    return created;
  });

  server.delete<{ Params: { keyId: string } }>('/api-keys/:keyId', async (request, reply) => {
    await options.tokenAuth.revokeApiKey(request.evuKbWorkspace.id, request.params.keyId);
    reply.code(204);
    return;
  });

  server.post<{ Params: { keyId: string } }>('/api-keys/:keyId/rotate', async (request, reply) => {
    const rotated = await options.tokenAuth.rotateApiKey(
      request.evuKbWorkspace.id,
      request.params.keyId,
    );
    reply.code(201);
    return rotated;
  });
};
