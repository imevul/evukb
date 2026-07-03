// VITE_EVUKB_WORKSPACE_ID defaults to the dev bootstrap slug.
// VITE_EVUKB_API_BASE_URL empty uses same-origin /api (Vite dev/preview proxy).
// VITE_EVUKB_API_PROXY_TARGET or EVUKB_API_PROXY_TARGET configures the proxy destination
// (Docker dev: http://evukb-api:4201). For split-host production builds, set
// VITE_EVUKB_API_BASE_URL at image build time instead of relying on runtime env.

export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_EVUKB_API_BASE_URL ?? '',
  workspaceId: import.meta.env.VITE_EVUKB_WORKSPACE_ID ?? 'local-dev',
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
  settingsPreferences: '/settings/preferences',
  settingsAi: '/settings/ai',
  settingsRanking: '/settings/ranking',
  diagnostics: '/diagnostics',
  settingsSecrets: '/settings/secrets',
  settingsRoot: '/settings',
} as const;
