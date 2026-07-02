import { knowledgeFiltersSchema, rankingSettingsSchema } from './schemas.js';
import { errorResponse, jsonBody, workspaceIdParam } from './shared.js';

export const kbToolPaths = {
  '/api/workspaces/{workspaceId}/tools/kb': {
    post: {
      summary: 'Execute a kb read or write tool action.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        action: {
          type: 'string',
          enum: [
            'list_corpora',
            'search',
            'read_chunk',
            'list_documents',
            'get_document',
            'follow_links',
            'read_index',
            'list_concepts',
            'ask',
            'append_document',
            'create_document',
            'update_document',
            'delete_document',
          ],
        },
        corpusId: { type: 'string' },
        corpusIds: { type: 'array', items: { type: 'string' } },
        query: {
          type: 'string',
          description: 'Optional when filters or pathPrefix scope metadata-only search.',
        },
        pathPrefix: { type: 'string' },
        limit: { type: 'integer' },
        fields: { type: 'array', items: { type: 'string' } },
        includeFrontmatter: { type: 'boolean' },
        filters: knowledgeFiltersSchema,
        rankingStrategyId: { type: 'string' },
        rankingSettings: rankingSettingsSchema,
        chunkId: { type: 'string' },
        nodeId: { type: 'string' },
        documentPath: { type: 'string' },
        conceptType: { type: 'string' },
        tag: { type: 'string' },
        offset: { type: 'integer' },
        question: { type: 'string' },
        maxContextChunks: { type: 'integer' },
        responseMode: { type: 'string', enum: ['concise', 'detailed', 'extractive'] },
        stream: {
          type: 'boolean',
          description: 'Stream ask tokens over SSE when action is ask.',
        },
        path: { type: 'string' },
        name: { type: 'string' },
        body: { type: 'string' },
      }),
      responses: {
        '200': { description: 'Tool execution result.' },
        '400': errorResponse,
        '403': errorResponse,
        '404': errorResponse,
        '409': errorResponse,
      },
    },
  },
};
