import { corpusArchiveImportResultSchema } from './schemas.js';
import { corpusIdParam, errorResponse, jsonBody, workspaceIdParam } from './shared.js';

export const syncPortablePaths = {
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/sync-mount': {
    post: {
      summary: 'Enqueue mount sync import for a mount corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Mount sync job enqueued.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enqueued: { type: 'boolean' },
                  jobId: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/sync-git': {
    post: {
      summary: 'Enqueue git sync import for a git corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Git sync job enqueued.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enqueued: { type: 'boolean' },
                  jobId: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/convert-to-okf': {
    post: {
      summary: 'Convert a corpus to OKF by injecting concept types and setting format profile.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: jsonBody({
        dryRun: { type: 'boolean' },
        synthesizeIndex: { type: 'boolean' },
      }),
      responses: {
        '200': { description: 'Convert result summary.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/export-okf': {
    get: {
      summary: 'Export an OKF corpus as a directory-shaped zip archive.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'OKF zip archive.',
          content: {
            'application/zip': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/export': {
    get: {
      summary: 'Export a corpus as an EvuKB portable zip archive.',
      parameters: [workspaceIdParam, corpusIdParam],
      responses: {
        '200': {
          description: 'Portable EvuKB zip archive.',
          content: {
            'application/zip': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/import': {
    post: {
      summary: 'Import a portable EvuKB archive or generic zip archive into a corpus.',
      parameters: [workspaceIdParam, corpusIdParam],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                archive: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Archive import result summary.',
          content: {
            'application/json': {
              schema: corpusArchiveImportResultSchema,
            },
          },
        },
        '400': errorResponse,
        '404': errorResponse,
        '413': errorResponse,
      },
    },
  },
};
