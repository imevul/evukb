import type { FastifyPluginAsync } from 'fastify';

import type { CitationValidateService } from '../services/citation-validate-service.js';

export type CitationRoutesOptions = {
  citationValidateService: CitationValidateService;
};

export const citationRoutesPlugin: FastifyPluginAsync<CitationRoutesOptions> = async (
  server,
  options,
) => {
  server.post<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/validate-citations',
    async (request) => {
      return options.citationValidateService.validateCorpusCitations(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
    },
  );
};
