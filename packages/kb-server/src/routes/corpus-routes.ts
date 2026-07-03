import {
  asWorkspaceId,
  isImportWritebackEnabled,
  isMountAuthoritativeEnabled,
  type RankingStrategyRegistry,
  validateCorpusSettings,
} from '@evu/kb-core';
import type { CorpusRepository, WorkspaceRepository } from '@evu/kb-db';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import { assertValidRankingStrategyId } from '../search/validate-ranking-strategy.js';
import type { FileManagerService } from '../services/file-manager.js';
import { corpusCreateBodySchema, corpusPatchBodySchema, parseBody } from './body-schemas.js';

export type CorpusRoutesOptions = {
  corpora: CorpusRepository;
  workspaces: WorkspaceRepository;
  fileManager: FileManagerService;
  rankingRegistry: RankingStrategyRegistry;
};

async function assertValidCorpusSettings(
  workspaceId: string,
  workspaces: WorkspaceRepository,
  settings: Record<string, unknown> | undefined,
): Promise<void> {
  if (settings === undefined) {
    return;
  }
  const workspace = await workspaces.getById(workspaceId);
  const error = validateCorpusSettings(settings, {
    allowMountAuthoritative: isMountAuthoritativeEnabled(process.env),
    allowImportWriteback: isImportWritebackEnabled(process.env),
    workspaceSettings: workspace?.settings ?? {},
  });
  if (error) {
    throw ApiError.validation(error);
  }
}

export const corpusRoutesPlugin: FastifyPluginAsync<CorpusRoutesOptions> = async (
  server,
  options,
) => {
  server.get('/knowledge-corpora', async (request) => {
    return options.corpora.listByWorkspace(request.evuKbWorkspace.id);
  });

  server.post<{ Body: { name: string; description?: string; settings?: Record<string, unknown> } }>(
    '/knowledge-corpora',
    async (request, reply) => {
      const { name, description, settings } = parseBody(corpusCreateBodySchema, request.body);
      if (!name.trim()) {
        throw ApiError.validation('Corpus name is required.');
      }
      await assertValidCorpusSettings(request.evuKbWorkspace.id, options.workspaces, settings);

      const corpus = await options.corpora.create({
        workspaceId: asWorkspaceId(request.evuKbWorkspace.id),
        name: name.trim(),
        ...(description !== undefined ? { description } : {}),
        ...(settings !== undefined ? { settings } : {}),
      });
      reply.code(201);
      return corpus;
    },
  );

  server.get<{ Params: { corpusId: string } }>('/knowledge-corpora/:corpusId', async (request) => {
    const corpus = await options.corpora.getById(
      request.evuKbWorkspace.id,
      request.params.corpusId,
    );
    if (!corpus) {
      throw ApiError.corpusNotFound(request.params.corpusId);
    }
    return corpus;
  });

  server.patch<{
    Params: { corpusId: string };
    Body: {
      name?: string;
      description?: string;
      settings?: Record<string, unknown>;
      rankingStrategyId?: string;
    };
  }>('/knowledge-corpora/:corpusId', async (request) => {
    const body = parseBody(corpusPatchBodySchema, request.body);
    await assertValidCorpusSettings(request.evuKbWorkspace.id, options.workspaces, body.settings);
    assertValidRankingStrategyId(options.rankingRegistry, body.rankingStrategyId);

    const updated = await options.corpora.update(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      request.body ?? {},
    );
    if (!updated) {
      throw ApiError.corpusNotFound(request.params.corpusId);
    }
    return updated;
  });

  server.delete<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId',
    async (request, reply) => {
      const corpus = await options.corpora.getById(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
      if (!corpus) {
        throw ApiError.corpusNotFound(request.params.corpusId);
      }

      await options.fileManager.deleteCorpusBlobs(request.evuKbWorkspace.id, corpus.id);
      await options.corpora.delete(request.evuKbWorkspace.id, corpus.id);
      reply.code(204);
      return null;
    },
  );
};
