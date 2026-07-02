import { corpusSettingsSchema } from './schemas.js';
import { corpusIdParam, errorResponse, jsonBody, workspaceIdParam } from './shared.js';

export const corpusPaths = {
  '/api/workspaces/{workspaceId}/knowledge-corpora': {
    get: {
      summary: 'List corpora in a workspace.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Corpus list.' },
        '404': { description: 'Workspace not found.', ...errorResponse },
      },
    },
    post: {
      summary: 'Create a corpus.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        name: { type: 'string' },
        description: { type: 'string' },
        settings: corpusSettingsSchema,
      }),
      responses: {
        '201': { description: 'Created corpus.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}': {
    get: {
      summary: 'Get a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': { description: 'Corpus details.' },
        '404': errorResponse,
      },
    },
    patch: {
      summary: 'Update a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        name: { type: 'string' },
        description: { type: 'string' },
        settings: corpusSettingsSchema,
        rankingStrategyId: { type: 'string' },
      }),
      responses: {
        '200': { description: 'Updated corpus.' },
        '404': errorResponse,
      },
    },
    delete: {
      summary: 'Delete a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '204': { description: 'Corpus deleted.' },
        '404': errorResponse,
      },
    },
  },
};
