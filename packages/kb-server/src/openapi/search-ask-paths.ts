import { askRequestFields, searchRequestFields } from './schemas.js';
import { corpusIdParam, errorResponse, jsonBody, workspaceIdParam } from './shared.js';

export const searchAskPaths = {
  '/api/workspaces/{workspaceId}/search': {
    post: {
      summary: 'Search indexed chunks across one or more corpora.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        corpusIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        ...searchRequestFields,
      }),
      responses: {
        '200': { description: 'Search results.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/search': {
    post: {
      summary: 'Search indexed chunks in a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        ...searchRequestFields,
      }),
      responses: {
        '200': { description: 'Search results.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/ask': {
    post: {
      summary: 'Ask a question across one or more corpora with citations.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        corpusIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        ...askRequestFields,
      }),
      responses: {
        '200': { description: 'Ask response with citations.' },
        '400': errorResponse,
        '404': errorResponse,
        '503': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/ask': {
    post: {
      summary: 'Ask a question over indexed corpus content with citations.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        ...askRequestFields,
      }),
      responses: {
        '200': { description: 'Ask response with citations.' },
        '400': errorResponse,
        '404': errorResponse,
        '503': errorResponse,
      },
    },
  },
};
