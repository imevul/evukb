import { indexEnqueueResponseSchema } from './schemas.js';
import { corpusIdParam, errorResponse, jsonBody, workspaceIdParam } from './shared.js';

export const indexPaths = {
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/index-events': {
    get: {
      summary: 'Subscribe to corpus index status events (SSE).',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Server-sent index status events for file nodes in the corpus.',
          content: {
            'text/event-stream': {
              schema: { type: 'string' },
            },
          },
        },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/reindex': {
    post: {
      summary: 'Reindex selected nodes.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        nodeIds: { type: 'array', items: { type: 'string' } },
      }),
      responses: {
        '200': {
          description: 'Index jobs enqueued.',
          content: {
            'application/json': {
              schema: indexEnqueueResponseSchema,
            },
          },
        },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/reindex-all': {
    post: {
      summary: 'Reindex all markdown files in a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Index jobs enqueued.',
          content: {
            'application/json': {
              schema: indexEnqueueResponseSchema,
            },
          },
        },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/reindex-needing': {
    post: {
      summary: 'Reindex markdown files with pending, stale, or failed index status.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Index jobs enqueued.',
          content: {
            'application/json': {
              schema: indexEnqueueResponseSchema,
            },
          },
        },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/validate-citations': {
    post: {
      summary: 'Enqueue OKF citation URL validation jobs for a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Citation validation jobs enqueued.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enqueued: { type: 'integer' },
                },
              },
            },
          },
        },
        '404': errorResponse,
      },
    },
  },
};
