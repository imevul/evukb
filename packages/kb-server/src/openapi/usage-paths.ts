import { errorResponse, workspaceIdParam } from './shared.js';

export const usagePaths = {
  '/api/workspaces/{workspaceId}/usage/recent': {
    get: {
      summary: 'List recent usage records for diagnostics.',
      parameters: [
        workspaceIdParam,
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
        },
      ],
      responses: {
        '200': { description: 'Recent usage records.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/usage/summary': {
    get: {
      summary: 'Aggregate usage totals by operation type.',
      parameters: [
        workspaceIdParam,
        {
          name: 'since',
          in: 'query',
          required: false,
          schema: { type: 'string', format: 'date-time' },
        },
        {
          name: 'until',
          in: 'query',
          required: false,
          schema: { type: 'string', format: 'date-time' },
        },
        {
          name: 'operationType',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['embed', 'ask', 'rerank', 'index'] },
        },
        {
          name: 'groupBy',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['operationType'] },
        },
      ],
      responses: {
        '200': { description: 'Usage aggregate summary.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
};
