import type { FastifyRequest } from 'fastify';

import { ApiError } from '../errors.js';
import type { TokenAuthService } from '../services/token-auth-service.js';
import { isOperatorBearer } from './operator-auth.js';
import { isApiKeySecret } from './token-hash.js';

const READ_POST_SUFFIXES = ['/search', '/ask', '/tools/kb'] as const;

export type HttpAuthActor =
  | { kind: 'dev' }
  | { kind: 'operator' }
  | { kind: 'api_key'; tokenId: string; scopes: import('@evu/kb-core').KbAuthScope[] };

/**
 * Auth is fail-closed by default. Unauthenticated access is allowed only when
 * EVUKB_ALLOW_OPEN_AUTH=true is set explicitly outside production, and an
 * explicit EVUKB_REQUIRE_API_KEY=true always wins over the open-auth opt-in.
 */
export function isHttpAuthRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production' || env.EVUKB_REQUIRE_API_KEY === 'true') {
    return true;
  }
  return env.EVUKB_ALLOW_OPEN_AUTH !== 'true';
}

/**
 * Token hashes are peppered (see token-hash.ts). Running with auth required but
 * an empty pepper would silently weaken stored token hashes, so fail fast.
 */
export function assertTokenPepperConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.EVUKB_TOKEN_PEPPER?.trim()) {
    return;
  }
  throw new Error(
    'EVUKB_TOKEN_PEPPER must be set to a non-empty value when API or MCP auth is required. ' +
      'Set EVUKB_TOKEN_PEPPER, or set EVUKB_ALLOW_OPEN_AUTH=true for open local development.',
  );
}

function parseBearer(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim();
  return bearer && bearer.length > 0 ? bearer : null;
}

function workspacePathSuffix(request: FastifyRequest, workspaceId: string): string {
  const pathname = request.url.split('?')[0] ?? request.url;
  const prefix = `/api/workspaces/${encodeURIComponent(workspaceId)}`;
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length);
  }
  const slugPrefix = `/api/workspaces/${(request.params as { workspaceId?: string }).workspaceId ?? workspaceId}`;
  if (pathname.startsWith(slugPrefix)) {
    return pathname.slice(slugPrefix.length);
  }
  return pathname;
}

export function classifyHttpAccess(method: string, pathSuffix: string): 'read' | 'write' {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS') {
    return 'read';
  }

  if (normalizedMethod === 'POST') {
    for (const suffix of READ_POST_SUFFIXES) {
      if (pathSuffix.endsWith(suffix)) {
        return 'read';
      }
    }
  }

  return 'write';
}

export async function enforceHttpAuth(
  tokenAuth: TokenAuthService,
  workspaceId: string,
  request: FastifyRequest,
): Promise<void> {
  if (!isHttpAuthRequired()) {
    request.evuKbActor = { kind: 'dev' };
    return;
  }

  const bearer = parseBearer(request.headers.authorization);
  if (!bearer) {
    throw ApiError.forbidden('API key is required.');
  }

  if (isOperatorBearer(bearer)) {
    request.evuKbActor = { kind: 'operator' };
    return;
  }

  const authenticated = await tokenAuth.authenticateApiBearer(bearer);
  if (!authenticated) {
    throw ApiError.forbidden(
      isApiKeySecret(bearer) ? 'Invalid or expired API key.' : 'Invalid or missing API key.',
    );
  }

  if (authenticated.workspaceId !== workspaceId) {
    throw ApiError.forbidden('API key workspace does not match request workspace.');
  }

  request.evuKbActor = {
    kind: 'api_key',
    tokenId: authenticated.tokenId,
    scopes: authenticated.scopes,
  };

  if (authenticated.scopes.includes('kb:write')) {
    return;
  }

  const access = classifyHttpAccess(request.method, workspacePathSuffix(request, workspaceId));

  if (access === 'write') {
    throw ApiError.forbidden('API key is missing kb:write scope.');
  }

  if (authenticated.scopes.includes('kb:read')) {
    return;
  }

  if (authenticated.scopes.length === 0) {
    if (access === 'read' && (request.method === 'GET' || request.method === 'HEAD')) {
      return;
    }
    throw ApiError.forbidden('API key is read-only and cannot access this route.');
  }

  throw ApiError.forbidden('API key is missing kb:read scope.');
}
