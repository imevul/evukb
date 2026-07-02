import {
  errorResponse,
  jsonBody,
  keyIdParam,
  secretIdParam,
  tokenIdParam,
  workspaceIdParam,
} from './shared.js';

export const secretTokenPaths = {
  '/api/workspaces/{workspaceId}/secrets': {
    get: {
      summary: 'List workspace secrets metadata.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Secret metadata list.' },
        '404': errorResponse,
      },
    },
    post: {
      summary: 'Create a workspace secret.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        name: { type: 'string' },
        value: { type: 'string' },
      }),
      responses: {
        '201': { description: 'Created secret with one-time value.' },
        '400': errorResponse,
        '409': errorResponse,
        '503': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/secrets/{secretId}': {
    delete: {
      summary: 'Delete a workspace secret.',
      parameters: [workspaceIdParam, secretIdParam],
      responses: {
        '204': { description: 'Secret deleted.' },
        '404': errorResponse,
      },
    },
    patch: {
      summary: 'Rotate a workspace secret value.',
      parameters: [workspaceIdParam, secretIdParam],
      requestBody: jsonBody({
        value: { type: 'string' },
      }),
      responses: {
        '200': { description: 'Secret metadata after rotation.' },
        '400': errorResponse,
        '404': errorResponse,
        '503': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/mcp-tokens': {
    get: {
      summary: 'List MCP tokens in a workspace.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'MCP token metadata list.' },
        '404': errorResponse,
      },
    },
    post: {
      summary: 'Create an MCP token.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        name: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        expiresAt: { type: 'string', nullable: true },
      }),
      responses: {
        '201': { description: 'Created MCP token with one-time secret.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/mcp-tokens/{tokenId}': {
    delete: {
      summary: 'Revoke an MCP token.',
      parameters: [workspaceIdParam, tokenIdParam],
      responses: {
        '204': { description: 'MCP token revoked.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/mcp-tokens/{tokenId}/rotate': {
    post: {
      summary: 'Rotate an MCP token.',
      parameters: [workspaceIdParam, tokenIdParam],
      responses: {
        '201': { description: 'Rotated MCP token with one-time secret.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/api-keys': {
    get: {
      summary: 'List API keys in a workspace.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'API key metadata list.' },
        '404': errorResponse,
      },
    },
    post: {
      summary: 'Create an API key.',
      parameters: [workspaceIdParam],
      requestBody: jsonBody({
        name: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        expiresAt: { type: 'string', nullable: true },
      }),
      responses: {
        '201': { description: 'Created API key with one-time secret.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/api-keys/{keyId}': {
    delete: {
      summary: 'Revoke an API key.',
      parameters: [workspaceIdParam, keyIdParam],
      responses: {
        '204': { description: 'API key revoked.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/api-keys/{keyId}/rotate': {
    post: {
      summary: 'Rotate an API key.',
      parameters: [workspaceIdParam, keyIdParam],
      responses: {
        '201': { description: 'Rotated API key with one-time secret.' },
        '404': errorResponse,
      },
    },
  },
};
