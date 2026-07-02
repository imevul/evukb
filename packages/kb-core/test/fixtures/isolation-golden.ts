export type IsolationSurface =
  | 'http_file_read'
  | 'http_search'
  | 'http_ask'
  | 'http_workspace_search'
  | 'http_workspace_ask'
  | 'http_corpus_get'
  | 'http_link_graph'
  | 'mcp_search'
  | 'mcp_ask'
  | 'tools_kb_search'
  | 'blob_storage_key'
  | 'workspace_scope_assert';

export type IsolationDenialExpectation = {
  httpStatus?: number;
  errorCode?: string;
  throws?: boolean;
};

export type IsolationGoldenCase = {
  id: string;
  surface: IsolationSurface;
  description: string;
  crossWorkspace: true;
  expected: IsolationDenialExpectation;
};

/** Golden matrix for cross-workspace denial expectations used by integration tests. */
export const isolationGoldenCases: IsolationGoldenCase[] = [
  {
    id: 'http-file-read-wrong-workspace',
    surface: 'http_file_read',
    description: 'Node content read with wrong workspace path returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'http-search-wrong-workspace',
    surface: 'http_search',
    description: 'Corpus search with wrong workspace path returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'http-ask-wrong-workspace',
    surface: 'http_ask',
    description: 'Corpus ask with wrong workspace path returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'http-workspace-search-wrong-workspace',
    surface: 'http_workspace_search',
    description: 'Workspace search scoped to unknown workspace returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'http-workspace-ask-wrong-workspace',
    surface: 'http_workspace_ask',
    description: 'Workspace ask scoped to unknown workspace returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'http-corpus-get-wrong-workspace',
    surface: 'http_corpus_get',
    description: 'Corpus get with wrong workspace returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'http-link-graph-wrong-workspace',
    surface: 'http_link_graph',
    description: 'Link graph with wrong workspace returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'mcp-search-wrong-workspace-header',
    surface: 'mcp_search',
    description: 'MCP search with unknown workspace header returns workspace_not_found',
    crossWorkspace: true,
    expected: { errorCode: 'workspace_not_found' },
  },
  {
    id: 'mcp-ask-wrong-workspace-header',
    surface: 'mcp_ask',
    description: 'MCP ask with unknown workspace header returns workspace_not_found',
    crossWorkspace: true,
    expected: { errorCode: 'workspace_not_found' },
  },
  {
    id: 'tools-kb-search-wrong-workspace',
    surface: 'tools_kb_search',
    description: 'POST /tools/kb search from wrong workspace URL returns 404',
    crossWorkspace: true,
    expected: { httpStatus: 404 },
  },
  {
    id: 'blob-storage-key-isolation',
    surface: 'blob_storage_key',
    description: 'Blob storage keys include workspace segment and differ across workspaces',
    crossWorkspace: true,
    expected: {},
  },
  {
    id: 'workspace-scope-assert',
    surface: 'workspace_scope_assert',
    description: 'assertWorkspaceScope rejects mismatched workspace ids',
    crossWorkspace: true,
    expected: { throws: true },
  },
];

export function isolationCasesForSurface(surface: IsolationSurface): IsolationGoldenCase[] {
  return isolationGoldenCases.filter((entry) => entry.surface === surface);
}
