import type { FastifyPluginAsync } from 'fastify';

import type { CorpusStatsService } from '../services/corpus-stats-service.js';

export type StatsRoutesOptions = {
  corpusStatsService: CorpusStatsService;
};

export const statsRoutesPlugin: FastifyPluginAsync<StatsRoutesOptions> = async (
  server,
  options,
) => {
  server.get<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/stats',
    async (request) => {
      return options.corpusStatsService.getCorpusStats(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
    },
  );
};
