import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { HttpAuthActor } from '../auth/http-auth.js';
import { assertKbAdminScope } from '../auth/kb-admin-auth.js';
import { ApiError } from '../errors.js';
import { parseBody } from '../routes/body-schemas.js';
import type { RankingStrategyPluginService } from '../services/ranking-strategy-plugin-service.js';

export type RankingStrategyRoutesOptions = {
  rankingPlugins: RankingStrategyPluginService;
};

const presetSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  retrieval: z
    .object({
      keyword: z.boolean(),
      semantic: z.boolean(),
    })
    .optional(),
  weights: z.record(z.string(), z.unknown()).optional(),
  postRank: z.string().optional(),
});

const registerBodySchema = z.object({
  preset: presetSchema.optional(),
  importPath: z.string().min(1).optional(),
  exampleId: z.string().min(1).optional(),
  force: z.boolean().optional(),
});

const unregisterBodySchema = z.object({
  confirm: z.literal(true),
});

function readActor(request: {
  evuKbActor: HttpAuthActor;
}): { kind: 'api_key'; tokenId: string } | { kind: 'dev' } {
  const actor = request.evuKbActor;
  if (actor.kind === 'api_key') {
    return actor;
  }
  return { kind: 'dev' };
}

export const rankingStrategyRoutesPlugin: FastifyPluginAsync<RankingStrategyRoutesOptions> = async (
  server,
  options,
) => {
  server.get('/settings/ranking/strategies', async (_request) => {
    return {
      strategies: options.rankingPlugins.listStrategies(),
    };
  });

  server.get<{ Params: { strategyId: string } }>(
    '/settings/ranking/strategies/:strategyId/usage',
    async (request) => {
      assertKbAdminScope(request);
      return options.rankingPlugins.getUsage(request.evuKbWorkspace.id, request.params.strategyId);
    },
  );

  server.post<{ Body: z.infer<typeof registerBodySchema> }>(
    '/settings/ranking/strategies',
    async (request) => {
      assertKbAdminScope(request);
      const body = parseBody(registerBodySchema, request.body);
      if (!body.preset && !body.importPath && !body.exampleId) {
        throw ApiError.validation('preset, importPath, or exampleId is required.');
      }
      const preset = body.preset
        ? {
            id: body.preset.id,
            version: body.preset.version,
            ...(body.preset.label !== undefined ? { label: body.preset.label } : {}),
            ...(body.preset.description !== undefined
              ? { description: body.preset.description }
              : {}),
            ...(body.preset.retrieval !== undefined ? { retrieval: body.preset.retrieval } : {}),
            ...(body.preset.weights !== undefined
              ? { weights: body.preset.weights as import('@evu/kb-core').HybridRankingWeights }
              : {}),
            ...(body.preset.postRank !== undefined ? { postRank: body.preset.postRank } : {}),
          }
        : undefined;
      const summary = await options.rankingPlugins.registerStrategy(
        request.evuKbWorkspace.id,
        {
          ...(preset ? { preset } : {}),
          ...(body.importPath ? { importPath: body.importPath } : {}),
          ...(body.exampleId ? { exampleId: body.exampleId } : {}),
          ...(body.force ? { force: body.force } : {}),
        },
        readActor(request),
      );
      return { strategy: summary };
    },
  );

  server.delete<{ Params: { strategyId: string }; Body: z.infer<typeof unregisterBodySchema> }>(
    '/settings/ranking/strategies/:strategyId',
    async (request) => {
      assertKbAdminScope(request);
      const body = parseBody(unregisterBodySchema, request.body ?? {});
      return options.rankingPlugins.unregisterStrategy(
        request.evuKbWorkspace.id,
        request.params.strategyId,
        { confirm: body.confirm },
        readActor(request),
      );
    },
  );
};
