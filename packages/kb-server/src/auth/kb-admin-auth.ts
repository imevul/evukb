import type { KbAuthScope } from '@evu/kb-core';
import type { FastifyRequest } from 'fastify';

import { ApiError } from '../errors.js';
import type { HttpAuthActor } from './http-auth.js';

export function readHttpAuthScopes(request: FastifyRequest): KbAuthScope[] {
  const actor = request.evuKbActor as HttpAuthActor | undefined;
  if (!actor) {
    return [];
  }
  if (actor.kind === 'dev' || actor.kind === 'operator') {
    return ['kb:read', 'kb:write', 'kb:admin'];
  }
  if (actor.kind === 'api_key') {
    return actor.scopes;
  }
  return [];
}

export function assertKbAdminScope(request: FastifyRequest): void {
  const scopes = readHttpAuthScopes(request);
  if (scopes.includes('kb:admin')) {
    return;
  }
  if (scopes.includes('kb:write')) {
    throw ApiError.forbidden(
      'Ranking plugin administration requires kb:admin scope, not kb:write.',
    );
  }
  throw ApiError.forbidden('API key is missing kb:admin scope.');
}
