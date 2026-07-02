import {
  allowsMetadataOnlySearch,
  type SearchRequest,
  type WorkspaceSearchRequest,
} from '@evu/kb-core';
import type { FastifyPluginAsync } from 'fastify';

import { ApiError } from '../errors.js';
import type { SearchService } from '../services/search-service.js';
import { corpusSearchBodySchema, parseBody, workspaceSearchBodySchema } from './body-schemas.js';

export type SearchRoutesOptions = {
  searchService: SearchService;
};

export const searchRoutesPlugin: FastifyPluginAsync<SearchRoutesOptions> = async (
  server,
  options,
) => {
  server.post<{ Body: WorkspaceSearchRequest }>('/search', async (request) => {
    parseBody(workspaceSearchBodySchema, request.body);
    if (!request.body?.query?.trim() && !allowsMetadataOnlySearch(request.body ?? {})) {
      throw ApiError.validation(
        'Search query is required unless filters or pathPrefix scope the request.',
      );
    }
    if (!request.body.corpusIds || request.body.corpusIds.length === 0) {
      throw ApiError.validation('At least one corpusId is required.');
    }
    return options.searchService.searchAcrossCorpora(
      request.evuKbWorkspace.id,
      request.body.corpusIds,
      {
        ...(request.body.query !== undefined ? { query: request.body.query } : {}),
        ...(request.body.pathPrefix !== undefined ? { pathPrefix: request.body.pathPrefix } : {}),
        ...(request.body.limit !== undefined ? { limit: request.body.limit } : {}),
        ...(request.body.filters !== undefined ? { filters: request.body.filters } : {}),
        ...(request.body.rankingSettings !== undefined
          ? { rankingSettings: request.body.rankingSettings }
          : {}),
        ...(request.body.rankingStrategyId !== undefined
          ? { rankingStrategyId: request.body.rankingStrategyId }
          : {}),
      },
    );
  });

  server.post<{
    Params: { corpusId: string };
    Body: SearchRequest;
  }>('/knowledge-corpora/:corpusId/search', async (request) => {
    parseBody(corpusSearchBodySchema, request.body);
    if (!request.body?.query?.trim() && !allowsMetadataOnlySearch(request.body ?? {})) {
      throw ApiError.validation(
        'Search query is required unless filters or pathPrefix scope the request.',
      );
    }
    return options.searchService.search(
      request.evuKbWorkspace.id,
      request.params.corpusId,
      request.body,
    );
  });
};
