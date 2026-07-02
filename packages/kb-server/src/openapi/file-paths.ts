import { corpusIdParam, errorResponse, jsonBody, nodeIdParam, workspaceIdParam } from './shared.js';

export const filePaths = {
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/nodes': {
    get: {
      summary: 'List nodes.',
      parameters: [
        workspaceIdParam,
        corpusIdParam,
        {
          name: 'format',
          in: 'query',
          schema: { type: 'string', enum: ['flat', 'tree'] },
        },
      ],
      responses: {
        '200': { description: 'Node list.' },
        '404': errorResponse,
      },
    },
    delete: {
      summary: 'Bulk delete nodes.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        nodeIds: { type: 'array', items: { type: 'string' } },
      }),
      responses: {
        '200': { description: 'Delete result.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/folders': {
    post: {
      summary: 'Create a folder.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        path: { type: 'string' },
        name: { type: 'string' },
      }),
      responses: {
        '201': { description: 'Created folder.' },
        '400': errorResponse,
        '404': errorResponse,
        '409': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/files': {
    post: {
      summary: 'Upload or create a managed file.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                name: { type: 'string' },
                content: { type: 'string' },
                mimeType: { type: 'string' },
              },
              required: ['name', 'content'],
            },
          },
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                name: { type: 'string' },
                file: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Created file.' },
        '400': errorResponse,
        '404': errorResponse,
        '409': errorResponse,
        '413': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/nodes/{nodeId}/content': {
    get: {
      summary: 'Read managed file content.',
      parameters: [workspaceIdParam, corpusIdParam, nodeIdParam],
      responses: {
        '200': { description: 'File bytes.' },
        '404': errorResponse,
      },
    },
    put: {
      summary: 'Save managed file content.',
      parameters: [workspaceIdParam, corpusIdParam, nodeIdParam],
      requestBody: {
        required: true,
        content: {
          'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
          'text/plain': { schema: { type: 'string' } },
        },
      },
      responses: {
        '200': { description: 'Updated node metadata.' },
        '404': errorResponse,
        '413': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/nodes/{nodeId}': {
    patch: {
      summary: 'Rename a node.',
      parameters: [workspaceIdParam, corpusIdParam, nodeIdParam],
      requestBody: jsonBody({ name: { type: 'string' } }),
      responses: {
        '200': { description: 'Renamed node.' },
        '404': errorResponse,
        '409': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/nodes/{nodeId}/move': {
    patch: {
      summary: 'Move a node.',
      parameters: [workspaceIdParam, corpusIdParam, nodeIdParam],
      requestBody: jsonBody({ path: { type: 'string' } }),
      responses: {
        '200': { description: 'Moved node.' },
        '404': errorResponse,
        '409': errorResponse,
      },
    },
  },
};
