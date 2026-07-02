import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildOpenApiDocument, createEvuKbServer } from '../packages/kb-server/dist/index.js';

const databaseUrl = process.env.EVUKB_DATABASE_URL;

async function assertMcpRoute(
  server: Awaited<ReturnType<typeof createEvuKbServer>>,
  expectedRegistered: boolean,
): Promise<void> {
  const response = await server.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  });

  if (expectedRegistered) {
    if (response.statusCode === 404) {
      throw new Error('Expected /mcp to be registered when runtime is present.');
    }
    return;
  }

  if (response.statusCode !== 404) {
    throw new Error(`Expected /mcp to return 404 without runtime, received ${response.statusCode}`);
  }
}

async function main(): Promise<void> {
  const blobRoot = mkdtempSync(join(tmpdir(), 'evukb-verify-'));
  try {
    const server = await createEvuKbServer({
      logger: false,
      blobRoot,
      ...(databaseUrl ? { connectionString: databaseUrl } : {}),
    });
    const health = await server.inject('/health');
    if (health.statusCode !== 200) {
      throw new Error(`Expected /health to return 200, received ${health.statusCode}`);
    }

    const version = await server.inject('/version');
    if (version.statusCode !== 200) {
      throw new Error(`Expected /version to return 200, received ${version.statusCode}`);
    }

    await assertMcpRoute(server, Boolean(databaseUrl && blobRoot));

    const openApi = buildOpenApiDocument();
    const paths = Object.keys(openApi.paths);
    if (!paths.some((path) => path.includes('/knowledge-corpora'))) {
      throw new Error('OpenAPI document is missing corpus routes.');
    }
    if (!paths.some((path) => path.endsWith('/search'))) {
      throw new Error('OpenAPI document is missing search routes.');
    }
    if (!paths.some((path) => path.endsWith('/ask'))) {
      throw new Error('OpenAPI document is missing ask routes.');
    }
    if (!paths.some((path) => path.endsWith('/link-graph'))) {
      throw new Error('OpenAPI document is missing link graph routes.');
    }
    if (!paths.some((path) => path.endsWith('/mcp-tokens'))) {
      throw new Error('OpenAPI document is missing MCP token routes.');
    }
    if (!paths.some((path) => path.endsWith('/stats'))) {
      throw new Error('OpenAPI document is missing corpus stats routes.');
    }
    if (!paths.some((path) => path.endsWith('/tools/kb'))) {
      throw new Error('OpenAPI document is missing kb tool routes.');
    }
    if (!paths.some((path) => path.endsWith('/reindex-needing'))) {
      throw new Error('OpenAPI document is missing reindex-needing routes.');
    }
    if (!paths.some((path) => path.endsWith('/convert-to-okf'))) {
      throw new Error('OpenAPI document is missing OKF convert routes.');
    }
    if (!paths.some((path) => path.endsWith('/export-okf'))) {
      throw new Error('OpenAPI document is missing OKF export routes.');
    }
    if (!paths.some((path) => path.endsWith('/validate-citations'))) {
      throw new Error('OpenAPI document is missing citation validation routes.');
    }
    if (!paths.some((path) => path.endsWith('/audit'))) {
      throw new Error('OpenAPI document is missing audit routes.');
    }
    if (!paths.some((path) => path.endsWith('/approvals'))) {
      throw new Error('OpenAPI document is missing mutation approval routes.');
    }
    if (!paths.some((path) => path.endsWith('/health/vector-store'))) {
      throw new Error('OpenAPI document is missing vector store health routes.');
    }

    const kbToolPath = openApi.paths['/api/workspaces/{workspaceId}/tools/kb'];
    const kbToolActions =
      kbToolPath?.post?.requestBody?.content?.['application/json']?.schema?.properties?.action
        ?.enum;
    if (!Array.isArray(kbToolActions) || !kbToolActions.includes('list_corpora')) {
      throw new Error('OpenAPI kb tool route is missing read actions.');
    }
    if (!kbToolActions.includes('search') || !kbToolActions.includes('ask')) {
      throw new Error('OpenAPI kb tool route is missing expected read actions.');
    }

    const searchPath =
      openApi.paths['/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/search'];
    const searchFilters =
      searchPath?.post?.requestBody?.content?.['application/json']?.schema?.properties?.filters;
    if (!searchFilters || typeof searchFilters !== 'object') {
      throw new Error('OpenAPI search route is missing filters (KnowledgeFilters).');
    }
    const filterProperties = (searchFilters as { properties?: Record<string, unknown> }).properties;
    if (!filterProperties?.pathAllowlist) {
      throw new Error('OpenAPI KnowledgeFilters schema is missing pathAllowlist.');
    }

    const corpusSearchPath =
      openApi.paths['/api/workspaces/{workspaceId}/knowledge-corpora/{corpusId}/search'];
    const corpusSearchBody =
      corpusSearchPath?.post?.requestBody?.content?.['application/json']?.schema?.properties;
    if (!corpusSearchBody?.rankingStrategyId) {
      throw new Error('OpenAPI corpus search route is missing rankingStrategyId.');
    }

    const askPath = openApi.paths['/api/workspaces/{workspaceId}/ask'];
    const askBody = askPath?.post?.requestBody?.content?.['application/json']?.schema?.properties;
    if (!askBody?.rankingStrategyId) {
      throw new Error('OpenAPI ask route is missing rankingStrategyId.');
    }

    const kbToolBody =
      kbToolPath?.post?.requestBody?.content?.['application/json']?.schema?.properties;
    if (!kbToolBody?.rankingStrategyId) {
      throw new Error('OpenAPI kb tool route is missing rankingStrategyId.');
    }
    const kbToolFilters = kbToolBody?.filters as
      | { properties?: Record<string, unknown> }
      | undefined;
    const kbToolFilterProperties = kbToolFilters?.properties;
    if (!kbToolFilterProperties?.pathAllowlist) {
      throw new Error('OpenAPI kb tool filters schema is missing pathAllowlist.');
    }
    if (!kbToolFilterProperties?.frontmatter) {
      throw new Error('OpenAPI kb tool filters schema is missing frontmatter.');
    }
    if (!kbToolFilterProperties?.sourceTypes) {
      throw new Error('OpenAPI kb tool filters schema is missing sourceTypes.');
    }
    if (!kbToolFilterProperties?.indexStatus) {
      throw new Error('OpenAPI kb tool filters schema is missing indexStatus.');
    }

    const bootHintProperties = (
      openApi.paths['/api/workspaces/{workspaceId}/settings']?.get?.responses?.['200'] as
        | {
            content?: {
              'application/json'?: {
                schema?: { properties?: { bootHints?: { properties?: Record<string, unknown> } } };
              };
            };
          }
        | undefined
    )?.content?.['application/json']?.schema?.properties?.bootHints?.properties;
    if (!bootHintProperties?.mountAuthoritativeEnabled) {
      throw new Error('OpenAPI settings response is missing bootHints.mountAuthoritativeEnabled.');
    }
    if (!bootHintProperties?.importWritebackEnabled) {
      throw new Error('OpenAPI settings response is missing bootHints.importWritebackEnabled.');
    }

    await server.close();
    console.info('verify-api-smoke: ok');
  } finally {
    rmSync(blobRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
