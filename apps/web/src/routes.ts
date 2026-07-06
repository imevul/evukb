export type AppRoute = {
  path: string;
  purpose: string;
};

export const appRouteTable: AppRoute[] = [
  { path: '/workspaces', purpose: 'workspace list and selection' },
  { path: '/knowledge', purpose: 'corpus list' },
  { path: '/knowledge/:corpusId/overview', purpose: 'corpus stats and warnings' },
  { path: '/knowledge/:corpusId/files', purpose: 'file manager and editor' },
  { path: '/knowledge/:corpusId/search', purpose: 'hybrid search' },
  { path: '/knowledge/:corpusId/links', purpose: 'link graph table' },
  { path: '/knowledge/:corpusId/graph', purpose: 'link graph neighborhood view' },
  { path: '/knowledge/:corpusId/ask', purpose: 'ask with citations' },
  { path: '/ask', purpose: 'workspace ask across corpora' },
  { path: '/search', purpose: 'workspace search across corpora' },
  { path: '/diagnostics', purpose: 'health and failed jobs' },
  { path: '/settings/overview', purpose: 'workspace overview and boot hints' },
  { path: '/settings/workspace', purpose: 'workspace settings' },
  { path: '/settings/ai', purpose: 'AI provider settings' },
  { path: '/settings/ranking', purpose: 'ranking preferences' },
  { path: '/settings/secrets', purpose: 'encrypted secrets' },
  { path: '/settings/mcp-tokens', purpose: 'MCP token management' },
  { path: '/settings/api-keys', purpose: 'API key management' },
  { path: '/settings/audit', purpose: 'workspace audit trail' },
];

/** True for any corpus detail tab (overview, files, search, links, graph, ask). */
export function isCorpusDetailPath(pathname: string): boolean {
  return /^\/knowledge\/[^/]+\//.test(pathname);
}
