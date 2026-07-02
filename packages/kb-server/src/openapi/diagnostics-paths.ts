import { errorResponse, jobIdParam, workspaceIdParam } from './shared.js';

export const diagnosticsPaths = {
  '/api/workspaces/{workspaceId}/health/db': {
    get: {
      summary: 'Get database health for diagnostics.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Database health.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/health/blob-store': {
    get: {
      summary: 'Get blob store health for diagnostics.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Blob store health.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/health/providers': {
    get: {
      summary: 'Get AI provider health for diagnostics.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Provider health.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/health/vector-store': {
    get: {
      summary: 'Get vector store health for diagnostics.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Vector store health.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/jobs/failed': {
    get: {
      summary: 'List failed background jobs.',
      parameters: [
        workspaceIdParam,
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
      ],
      responses: {
        '200': { description: 'Failed job list.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/jobs/{jobId}/retry': {
    post: {
      summary: 'Retry a failed background job.',
      parameters: [workspaceIdParam, jobIdParam],
      responses: {
        '200': { description: 'Job retry accepted.' },
        '403': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/jobs/{jobId}': {
    delete: {
      summary: 'Delete a failed background job.',
      parameters: [workspaceIdParam, jobIdParam],
      responses: {
        '200': { description: 'Failed job deleted.' },
        '403': errorResponse,
        '404': errorResponse,
      },
    },
  },
};
