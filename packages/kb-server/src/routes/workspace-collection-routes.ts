import type { Workspace } from '@evu/kb-core';
import type { CorpusRepository, WorkspaceRepository } from '@evu/kb-db';
import type { FastifyPluginAsync } from 'fastify';

import {
  enforceCollectionAuth,
  isCollectionAdmin,
  requireCollectionAdmin,
} from '../auth/collection-auth.js';
import { isPostgresUniqueViolation } from '../db/postgres-errors.js';
import { ApiError } from '../errors.js';
import type { TokenAuthService } from '../services/token-auth-service.js';
import { parseBody, workspaceCreateBodySchema } from './body-schemas.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceCollectionRoutesOptions = {
  corpora: CorpusRepository;
  tokenAuth: TokenAuthService;
  workspaces: WorkspaceRepository;
};

async function resolveWorkspaceParam(
  workspaces: WorkspaceRepository,
  workspaceParam: string,
): Promise<Workspace> {
  const byId = UUID_PATTERN.test(workspaceParam) ? await workspaces.getById(workspaceParam) : null;
  const workspace = byId ?? (await workspaces.getBySlug(workspaceParam));
  if (!workspace) {
    throw ApiError.workspaceNotFound(workspaceParam);
  }
  return workspace;
}

function filterWorkspacesForActor(
  all: Workspace[],
  actor: Awaited<ReturnType<typeof enforceCollectionAuth>>,
): Workspace[] {
  if (actor.kind === 'dev' || isCollectionAdmin(actor)) {
    return all;
  }
  if (actor.kind === 'api_key') {
    return all.filter((workspace) => workspace.id === actor.workspaceId);
  }
  return all;
}

export const workspaceCollectionRoutesPlugin: FastifyPluginAsync<
  WorkspaceCollectionRoutesOptions
> = async (server, options) => {
  server.get('/workspaces', async (request) => {
    const actor = await enforceCollectionAuth(options.tokenAuth, request);
    const all = await options.workspaces.list();
    return filterWorkspacesForActor(all, actor);
  });

  server.post('/workspaces', async (request) => {
    const actor = await enforceCollectionAuth(options.tokenAuth, request);
    requireCollectionAdmin(actor);
    const body = parseBody(workspaceCreateBodySchema, request.body);
    try {
      return await options.workspaces.create({
        slug: body.slug,
        name: body.name,
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw ApiError.conflict(`Workspace slug already exists: ${body.slug}`);
      }
      throw error;
    }
  });

  server.delete<{ Params: { workspaceId: string } }>(
    '/workspaces/:workspaceId',
    async (request) => {
      const actor = await enforceCollectionAuth(options.tokenAuth, request);
      requireCollectionAdmin(actor);
      const workspace = await resolveWorkspaceParam(options.workspaces, request.params.workspaceId);
      const corpora = await options.corpora.listByWorkspace(workspace.id);
      if (corpora.length > 0) {
        throw ApiError.conflict(
          'Workspace cannot be deleted while it still has corpora. Remove all corpora first.',
        );
      }
      const deleted = await options.workspaces.delete(workspace.id);
      if (!deleted) {
        throw ApiError.workspaceNotFound(workspace.id);
      }
      return { deleted: true, id: workspace.id, slug: workspace.slug };
    },
  );
};
