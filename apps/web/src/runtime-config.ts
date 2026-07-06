export type EvuKbRuntimeConfig = {
  apiBaseUrl: string;
  mcpBaseUrl: string;
  workspaceId: string;
};

export type EvuKbViteEnv = {
  VITE_EVUKB_API_BASE_URL?: string;
  VITE_EVUKB_MCP_BASE_URL?: string;
  VITE_EVUKB_WORKSPACE_ID?: string;
};

declare global {
  interface Window {
    __EVUKB_CONFIG__?: Partial<EvuKbRuntimeConfig>;
  }
}

function trimOptional(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function resolveEvuKbRuntimeConfig(
  options: { runtime?: Partial<EvuKbRuntimeConfig>; viteEnv?: EvuKbViteEnv } = {},
): EvuKbRuntimeConfig {
  const runtime =
    options.runtime ?? (typeof window !== 'undefined' ? window.__EVUKB_CONFIG__ : undefined);
  const viteEnv = options.viteEnv ?? import.meta.env;

  const apiBaseUrl =
    trimOptional(runtime?.apiBaseUrl) || trimOptional(viteEnv.VITE_EVUKB_API_BASE_URL) || '';

  const mcpBaseUrl =
    trimOptional(runtime?.mcpBaseUrl) || trimOptional(viteEnv.VITE_EVUKB_MCP_BASE_URL) || '';

  const workspaceId =
    trimOptional(runtime?.workspaceId) ||
    trimOptional(viteEnv.VITE_EVUKB_WORKSPACE_ID) ||
    'local-dev';

  return { apiBaseUrl, mcpBaseUrl, workspaceId };
}
