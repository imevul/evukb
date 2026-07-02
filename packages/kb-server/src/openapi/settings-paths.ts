import { aiProviderOverridePatchSchema, settingsResponseSchema } from './schemas.js';
import { errorResponse, jsonBody, workspaceIdParam } from './shared.js';

export const settingsPaths = {
  '/api/workspaces/{workspaceId}/settings': {
    get: {
      summary: 'Get workspace settings.',
      parameters: [workspaceIdParam],
      responses: {
        '200': {
          description: 'Workspace settings view.',
          content: {
            'application/json': {
              schema: settingsResponseSchema,
            },
          },
        },
        '404': errorResponse,
      },
    },
    patch: {
      summary: 'Update workspace settings.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        name: { type: 'string' },
        settings: { type: 'object', additionalProperties: true },
      }),
      responses: {
        '200': {
          description: 'Updated workspace settings.',
          content: {
            'application/json': {
              schema: settingsResponseSchema,
            },
          },
        },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/ai/providers': {
    get: {
      summary: 'Get effective AI provider configuration.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'AI provider configuration and health.' },
        '404': errorResponse,
      },
    },
    patch: {
      summary: 'Update workspace AI provider overrides (model and base URL only).',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        embedding: aiProviderOverridePatchSchema,
        chat: aiProviderOverridePatchSchema,
      }),
      responses: {
        '200': { description: 'Updated AI provider configuration.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
};
