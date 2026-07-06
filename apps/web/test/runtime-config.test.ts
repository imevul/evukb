import { describe, expect, it } from 'vitest';

import { resolveEvuKbRuntimeConfig } from '../src/runtime-config.js';

describe('resolveEvuKbRuntimeConfig', () => {
  it('defaults to same-origin api and local-dev workspace', () => {
    expect(resolveEvuKbRuntimeConfig()).toEqual({
      apiBaseUrl: '',
      mcpBaseUrl: '',
      workspaceId: 'local-dev',
    });
  });

  it('prefers runtime config over Vite env', () => {
    expect(
      resolveEvuKbRuntimeConfig({
        runtime: {
          apiBaseUrl: 'https://evukb-api.example.com',
          mcpBaseUrl: 'https://evukb-api.example.com/mcp',
          workspaceId: 'prod',
        },
        viteEnv: {
          VITE_EVUKB_API_BASE_URL: 'https://vite-api.example.com',
          VITE_EVUKB_MCP_BASE_URL: 'https://vite-api.example.com/mcp',
          VITE_EVUKB_WORKSPACE_ID: 'local-dev',
        },
      }),
    ).toEqual({
      apiBaseUrl: 'https://evukb-api.example.com',
      mcpBaseUrl: 'https://evukb-api.example.com/mcp',
      workspaceId: 'prod',
    });
  });

  it('falls back to Vite env when runtime values are empty', () => {
    expect(
      resolveEvuKbRuntimeConfig({
        runtime: {},
        viteEnv: {
          VITE_EVUKB_API_BASE_URL: 'https://evukb-api.example.com',
          VITE_EVUKB_WORKSPACE_ID: 'ops',
        },
      }),
    ).toEqual({
      apiBaseUrl: 'https://evukb-api.example.com',
      mcpBaseUrl: '',
      workspaceId: 'ops',
    });
  });

  it('trims whitespace from runtime and Vite values', () => {
    expect(
      resolveEvuKbRuntimeConfig({
        runtime: {
          apiBaseUrl: '  https://runtime.example.com  ',
        },
        viteEnv: {
          VITE_EVUKB_MCP_BASE_URL: ' https://vite.example.com ',
        },
      }),
    ).toEqual({
      apiBaseUrl: 'https://runtime.example.com',
      mcpBaseUrl: 'https://vite.example.com',
      workspaceId: 'local-dev',
    });
  });
});
