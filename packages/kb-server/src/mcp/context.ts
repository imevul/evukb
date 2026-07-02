import type { Workspace } from '@evu/kb-core';
import type { WorkspaceRepository } from '@evu/kb-db';
import type { ServerContext } from '@modelcontextprotocol/server';

import { isMcpTokenSecret } from '../auth/token-hash.js';
import { ApiError } from '../errors.js';
import type { TokenAuthService } from '../services/token-auth-service.js';
import { getMcpRequestAuth, type McpRequestAuth } from './request-context.js';

export const EVUKB_WORKSPACE_HEADER = 'x-evukb-workspace-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveMcpHttpAuth(
  tokenAuth: TokenAuthService,
  headers: { authorization?: string | undefined },
): Promise<McpRequestAuth> {
  const authHeader = headers.authorization ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim();

  if (bearer) {
    const authenticated = await tokenAuth.authenticateMcpBearer(bearer);
    if (authenticated) {
      return {
        kind: 'db',
        workspaceId: authenticated.workspaceId,
        scopes: authenticated.scopes,
        tokenId: authenticated.tokenId,
      };
    }

    if (isMcpTokenSecret(bearer)) {
      throw ApiError.forbidden('Invalid or expired MCP bearer token.');
    }
  }

  const devToken = process.env.EVUKB_MCP_DEV_TOKEN;
  if (devToken) {
    if (bearer === devToken) {
      return { kind: 'dev' };
    }
    throw ApiError.forbidden('Invalid or missing MCP bearer token.');
  }

  if (isMcpTokenRequired()) {
    throw ApiError.forbidden('MCP bearer token is required.');
  }

  return { kind: 'open' };
}

/**
 * MCP auth is fail-closed by default; open access requires the explicit
 * EVUKB_ALLOW_OPEN_AUTH=true opt-in outside production.
 */
export function isMcpTokenRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production' || env.EVUKB_MCP_REQUIRE_TOKEN === 'true') {
    return true;
  }
  return env.EVUKB_ALLOW_OPEN_AUTH !== 'true';
}

export function assertMcpRequestAuthorized(): McpRequestAuth {
  const auth = getMcpRequestAuth();
  if (!auth) {
    throw ApiError.forbidden('MCP bearer token is required.');
  }
  return auth;
}

export function assertMcpReadScope(auth: McpRequestAuth): void {
  if (auth.kind === 'open' || auth.kind === 'dev') {
    return;
  }

  const scopes = auth.scopes ?? [];
  if (scopes.length === 0 || scopes.includes('kb:read')) {
    return;
  }

  throw ApiError.forbidden('MCP token is missing kb:read scope.');
}

export function assertMcpWriteScope(auth: McpRequestAuth): void {
  if (auth.kind === 'open' || auth.kind === 'dev') {
    return;
  }

  const scopes = auth.scopes ?? [];
  if (scopes.includes('kb:write')) {
    return;
  }

  throw ApiError.forbidden('MCP token is missing kb:write scope.');
}

/** @deprecated Use resolveMcpHttpAuth and runWithMcpAuth instead. */
export function assertMcpDevAuth(ctx: ServerContext): void {
  const auth = getMcpRequestAuth();
  if (auth) {
    return;
  }

  const expected = process.env.EVUKB_MCP_DEV_TOKEN;
  if (!expected) {
    return;
  }

  const authHeader = ctx.http?.req?.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== expected) {
    throw ApiError.forbidden('Invalid or missing MCP bearer token.');
  }
}

export async function resolveWorkspace(
  workspaces: WorkspaceRepository,
  ctx: ServerContext,
  inputWorkspaceId?: string,
  auth?: McpRequestAuth,
): Promise<Workspace> {
  const effectiveAuth = auth ?? getMcpRequestAuth();

  if (effectiveAuth?.kind === 'db' && effectiveAuth.workspaceId) {
    const tokenWorkspace = await workspaces.getById(effectiveAuth.workspaceId);
    if (!tokenWorkspace) {
      throw ApiError.workspaceNotFound(effectiveAuth.workspaceId);
    }

    const headerValue = ctx.http?.req?.headers.get(EVUKB_WORKSPACE_HEADER)?.trim();
    const candidate = inputWorkspaceId?.trim() || headerValue;
    if (candidate) {
      const byId = UUID_PATTERN.test(candidate) ? await workspaces.getById(candidate) : null;
      const requested = byId ?? (await workspaces.getBySlug(candidate));
      if (!requested || requested.id !== tokenWorkspace.id) {
        throw ApiError.forbidden('Workspace header does not match MCP token workspace.');
      }
    }

    return tokenWorkspace;
  }

  const headerValue = ctx.http?.req?.headers.get(EVUKB_WORKSPACE_HEADER)?.trim();
  const candidate = inputWorkspaceId?.trim() || headerValue || 'local-dev';

  const byId = UUID_PATTERN.test(candidate) ? await workspaces.getById(candidate) : null;
  const workspace = byId ?? (await workspaces.getBySlug(candidate));
  if (!workspace) {
    throw ApiError.workspaceNotFound(candidate);
  }
  return workspace;
}
