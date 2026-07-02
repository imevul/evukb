import type { KbWriteActor } from '@evu/kb-core';
import type { FastifyPluginAsync } from 'fastify';

import { isHttpAuthRequired } from '../auth/http-auth.js';
import { isApiKeySecret } from '../auth/token-hash.js';
import { ApiError } from '../errors.js';
import type { MutationApprovalService } from '../services/mutation-approval-service.js';
import type { TokenAuthService } from '../services/token-auth-service.js';

export type ApprovalRoutesOptions = {
  mutationApprovalService: MutationApprovalService;
  tokenAuth: TokenAuthService;
};

async function resolveWriteActor(
  tokenAuth: TokenAuthService,
  workspaceId: string,
  authorization: string | undefined,
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

    if (!authenticated.scopes.includes('kb:write')) {
      throw ApiError.forbidden('API key is missing kb:write scope.');
    }

    return { kind: 'api_key', tokenId: authenticated.tokenId };
  }

  if (isHttpAuthRequired()) {
    throw ApiError.forbidden('API key with kb:write scope is required.');
  }

  return { kind: 'dev' };
}

export const approvalRoutesPlugin: FastifyPluginAsync<ApprovalRoutesOptions> = async (
  server,
  options,
) => {
  server.get('/approvals', async (request) => {
    return options.mutationApprovalService.listPending(request.evuKbWorkspace.id);
  });

  server.post<{ Params: { approvalId: string } }>(
    '/approvals/:approvalId/approve',
    async (request) => {
      const actor = await resolveWriteActor(
        options.tokenAuth,
        request.evuKbWorkspace.id,
        request.headers.authorization,
      );
      return options.mutationApprovalService.approve(
        request.evuKbWorkspace.id,
        request.params.approvalId,
        actor,
      );
    },
  );

  server.post<{ Params: { approvalId: string } }>(
    '/approvals/:approvalId/reject',
    async (request) => {
      const actor = await resolveWriteActor(
        options.tokenAuth,
        request.evuKbWorkspace.id,
        request.headers.authorization,
      );
      return options.mutationApprovalService.reject(
        request.evuKbWorkspace.id,
        request.params.approvalId,
        actor,
      );
    },
  );
};
