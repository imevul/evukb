import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import { resolveMaxUploadBytes } from '../limits.js';
import type { PortableService } from '../services/portable-service.js';

export type PortableRoutesOptions = {
  portableService: PortableService;
  maxUploadBytes?: number;
};

export const portableRoutesPlugin: FastifyPluginAsync<PortableRoutesOptions> = async (
  server,
  options,
) => {
  const maxUploadBytes = options.maxUploadBytes ?? resolveMaxUploadBytes();

  server.get<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/export',
    async (request, reply) => {
      const exported = await options.portableService.exportCorpusPortableZip(
        request.evuKbWorkspace.id,
        request.params.corpusId,
      );
      reply.header('content-type', 'application/zip');
      reply.header('content-disposition', `attachment; filename="${exported.fileName}"`);
      return reply.send(exported.zip);
    },
  );

  server.post<{ Params: { corpusId: string } }>(
    '/knowledge-corpora/:corpusId/import',
    async (request) => {
      let zipBuffer: Buffer | null = null;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          if (buffer.byteLength > maxUploadBytes) {
            throw ApiError.payloadTooLarge(maxUploadBytes);
          }
          zipBuffer = buffer;
        }
      }

      if (!zipBuffer) {
        throw ApiError.validation('Archive import requires a zip file upload.');
      }

      return options.portableService.importCorpusArchive(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        zipBuffer,
        { auditActor: request.evuKbActor },
      );
    },
  );
};
