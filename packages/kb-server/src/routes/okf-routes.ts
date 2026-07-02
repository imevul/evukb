import type { ConvertCorpusToOkfOptions } from '@evu/kb-core';
import type { FastifyPluginAsync } from 'fastify';

import type { OkfService } from '../services/okf-service.js';
import { convertToOkfBodySchema, parseBody } from './body-schemas.js';

export type OkfRoutesOptions = {
  okfService: OkfService;
};

export const okfRoutesPlugin: FastifyPluginAsync<OkfRoutesOptions> = async (server, options) => {
  server.post<{
    Params: { corpusId: string };
    Body: ConvertCorpusToOkfOptions;
  }>('/knowledge-corpora/:corpusId/convert-to-okf', async (request) => {
    parseBody(convertToOkfBodySchema, request.body);
    return options.okfService.convertCorpusToOkf(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      request.body ?? {},
    );
  });

  server.get<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/export-okf',
    async (request, reply) => {
      const exported = await options.okfService.exportCorpusOkfZip(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
      reply.header('content-type', 'application/zip');
      reply.header('content-disposition', `attachment; filename="${exported.fileName}"`);
      return reply.send(exported.zip);
    },
  );
};
