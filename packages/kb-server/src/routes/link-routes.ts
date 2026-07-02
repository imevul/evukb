import type { FastifyPluginAsync } from 'fastify';

import type { LinkGraphService } from '../services/link-graph-service.js';

export type LinkRoutesOptions = {
  linkGraphService: LinkGraphService;
};

export const linkRoutesPlugin: FastifyPluginAsync<LinkRoutesOptions> = async (server, options) => {
  server.get<{
    Params: { corpusId: string };
    Querystring: { folderPrefix?: string; limit?: number };
  }>('/knowledge-corpora/:corpusId/link-graph', async (request) => {
    return options.linkGraphService.getCorpusLinkGraph(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      {
        ...(request.query.folderPrefix !== undefined
          ? { folderPrefix: request.query.folderPrefix }
          : {}),
        ...(request.query.limit !== undefined ? { limit: request.query.limit } : {}),
      },
    );
  });

  server.get<{
    Params: { corpusId: string; nodeId: string };
    Querystring: { depth?: number; limit?: number };
  }>('/knowledge-corpora/:corpusId/nodes/:nodeId/graph/neighborhood', async (request) => {
    const depth =
      request.query.depth !== undefined
        ? Number.parseInt(String(request.query.depth), 10)
        : undefined;
    const limit =
      request.query.limit !== undefined
        ? Number.parseInt(String(request.query.limit), 10)
        : undefined;
    return options.linkGraphService.getGraphNeighborhood(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      request.params.nodeId,
      {
        ...(depth !== undefined && Number.isFinite(depth) ? { depth } : {}),
        ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
      },
    );
  });

  server.get<{ Params: { corpusId: string; nodeId: string } }>(
    '/knowledge-corpora/:corpusId/nodes/:nodeId/links',
    async (request) => {
      return options.linkGraphService.getNodeLinks(
        request.evuKbWorkspace.id,
        request.params.corpusId,
        request.params.nodeId,
      );
    },
  );
};
