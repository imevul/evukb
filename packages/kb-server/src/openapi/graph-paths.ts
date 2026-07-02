import { corpusIdParam, errorResponse, nodeIdParam, workspaceIdParam } from './shared.js';

export const graphPaths = {
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/link-graph': {
    get: {
      summary: 'Get corpus link graph nodes and edges.',
      parameters: [
        workspaceIdParam,
        corpusIdParam,
        {
          name: 'folderPrefix',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': { description: 'Link graph.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/nodes/{nodeId}/graph/neighborhood': {
    get: {
      summary: 'Get link graph neighborhood around a node.',
      parameters: [
        workspaceIdParam,
        corpusIdParam,
        nodeIdParam,
        {
          name: 'depth',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 4 },
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer' },
        },
      ],
      responses: {
        '200': { description: 'Graph neighborhood.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/nodes/{nodeId}/links': {
    get: {
      summary: 'List outbound links from a node.',
      parameters: [workspaceIdParam, corpusIdParam, nodeIdParam],
      responses: {
        '200': { description: 'Node links.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/stats': {
    get: {
      summary: 'Get corpus indexing and link diagnostics.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': { description: 'Corpus stats.' },
        '404': errorResponse,
      },
    },
  },
};
