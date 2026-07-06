// VITE_EVUKB_* in .env are read at Vite dev time and at Docker prod container start
// (via /config.js). Empty apiBaseUrl uses same-origin /api through the Vite proxy.
// EVUKB_API_PROXY_TARGET configures the proxy destination (Docker: http://evukb-api:4201).

import { resolveEvuKbRuntimeConfig } from './runtime-config.js';

const runtimeConfig = resolveEvuKbRuntimeConfig();

export const appConfig = {
  apiBaseUrl: runtimeConfig.apiBaseUrl,
  workspaceId: runtimeConfig.workspaceId,
} as const;

export const appRoutes = {
  knowledgeList: '/knowledge',
  workspaceAsk: '/ask',
  workspaceSearch: '/search',
  corpusOverview: (corpusId: string) => `/knowledge/${corpusId}/overview`,
  corpusFiles: (corpusId: string, filePath?: string) =>
    filePath
      ? `/knowledge/${corpusId}/files?file=${encodeURIComponent(filePath)}`
      : `/knowledge/${corpusId}/files`,
  corpusSearch: (corpusId: string) => `/knowledge/${corpusId}/search`,
  corpusLinks: (corpusId: string) => `/knowledge/${corpusId}/links`,
  corpusGraph: (corpusId: string, nodeId?: string) =>
    nodeId
      ? `/knowledge/${corpusId}/graph?nodeId=${encodeURIComponent(nodeId)}`
      : `/knowledge/${corpusId}/graph`,
  corpusAsk: (corpusId: string) => `/knowledge/${corpusId}/ask`,
  mcpTokens: '/settings/mcp-tokens',
  apiKeys: '/settings/api-keys',
  audit: '/settings/audit',
  mutationApprovals: '/settings/approvals',
  settingsWorkspace: '/settings/workspace',
  settingsOverview: '/settings/overview',
  settingsPreferences: '/settings/preferences',
  settingsAi: '/settings/ai',
  settingsRanking: '/settings/ranking',
  diagnostics: '/diagnostics',
  workspaces: '/workspaces',
  settingsSecrets: '/settings/secrets',
  settingsRoot: '/settings',
} as const;
