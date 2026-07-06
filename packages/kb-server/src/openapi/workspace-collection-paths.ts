import { errorResponse, jsonBody } from './shared.js';

export const workspaceSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string' },
    name: { type: 'string' },
    settings: { type: 'object', additionalProperties: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'slug', 'name', 'settings', 'createdAt'],
};

export const workspaceCollectionPaths = {
  '/api/workspaces': {
    get: {
      summary: 'List workspaces visible to the caller.',
      responses: {
        '200': {
          description: 'Workspace list.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: workspaceSummarySchema,
              },
            },
          },
        },
        '403': errorResponse,
      },
    },
    post: {
      summary: 'Create a workspace.',
      requestBody: jsonBody({
        slug: { type: 'string' },
        name: { type: 'string' },
      }),
      responses: {
        '200': {
          description: 'Created workspace.',
          content: {
            'application/json': {
              schema: workspaceSummarySchema,
            },
          },
        },
        '400': errorResponse,
        '403': errorResponse,
        '409': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}': {
    delete: {
      summary: 'Delete an empty workspace (no corpora).',
      parameters: [
        {
          name: 'workspaceId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Workspace deleted.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  deleted: { type: 'boolean' },
                  id: { type: 'string', format: 'uuid' },
                  slug: { type: 'string' },
                },
                required: ['deleted', 'id', 'slug'],
              },
            },
          },
        },
        '403': errorResponse,
        '404': errorResponse,
        '409': errorResponse,
      },
    },
  },
};
