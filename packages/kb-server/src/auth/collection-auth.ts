import type { FastifyRequest } from 'fastify';

import { ApiError } from '../errors.js';
import type { TokenAuthService } from '../services/token-auth-service.js';
import { isHttpAuthRequired } from './http-auth.js';
import { isOperatorBearer } from './operator-auth.js';
import { isApiKeySecret } from './token-hash.js';

export type CollectionAuthActor =
  | { kind: 'dev' }
  | { kind: 'operator' }
  | {
      kind: 'api_key';
      tokenId: string;
      workspaceId: string;
      scopes: import('@evu/kb-core').KbAuthScope[];
    };

function parseBearer(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim();
  return bearer && bearer.length > 0 ? bearer : null;
}

export function isCollectionAdmin(actor: CollectionAuthActor): boolean {
  if (actor.kind === 'dev' || actor.kind === 'operator') {
    return true;
  }
  return actor.scopes.includes('kb:admin');
}

export async function enforceCollectionAuth(
  tokenAuth: TokenAuthService,
  request: FastifyRequest,
): Promise<CollectionAuthActor> {
  if (!isHttpAuthRequired()) {
    request.evuKbActor = { kind: 'dev' };
    return { kind: 'dev' };
  }

  const bearer = parseBearer(request.headers.authorization);
  if (!bearer) {
    throw ApiError.forbidden('API key is required.');
  }

  if (isOperatorBearer(bearer)) {
    request.evuKbActor = { kind: 'operator' };
    return { kind: 'operator' };
  }

  const authenticated = await tokenAuth.authenticateApiBearer(bearer);
  if (!authenticated) {
    throw ApiError.forbidden(
      isApiKeySecret(bearer) ? 'Invalid or expired API key.' : 'Invalid or missing API key.',
    );
  }

  const actor: CollectionAuthActor = {
    kind: 'api_key',
    tokenId: authenticated.tokenId,
    workspaceId: authenticated.workspaceId,
    scopes: authenticated.scopes,
  };
  request.evuKbActor = {
    kind: 'api_key',
    tokenId: authenticated.tokenId,
    scopes: authenticated.scopes,
  };
  return actor;
}

export function requireCollectionAdmin(actor: CollectionAuthActor): void {
  if (!isCollectionAdmin(actor)) {
    throw ApiError.forbidden('kb:admin scope is required for this operation.');
  }
}
