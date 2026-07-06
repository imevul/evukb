import { resolveEvuKbRuntimeConfig } from './runtime-config.js';

export const MCP_TOKEN_PLACEHOLDER = 'YOUR_MCP_TOKEN';

export type McpHarnessId = 'cursor' | 'claude-desktop' | 'windsurf' | 'vscode' | 'generic';

export type McpHarnessGuide = {
  configFilename: string;
  configText: string;
  id: McpHarnessId;
  installHint: string;
  label: string;
};

export function resolveMcpServerUrl(): string {
  const { mcpBaseUrl, apiBaseUrl } = resolveEvuKbRuntimeConfig();
  if (mcpBaseUrl) {
    return mcpBaseUrl.endsWith('/mcp') ? mcpBaseUrl : `${mcpBaseUrl.replace(/\/$/, '')}/mcp`;
  }

  if (apiBaseUrl) {
    const origin = apiBaseUrl.replace(/\/api\/?$/, '');
    return `${origin.replace(/\/$/, '')}/mcp`;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port, origin } = window.location;
    if (port && port !== '4201') {
      return `${protocol}//${hostname}:4201/mcp`;
    }
    return `${origin}/mcp`;
  }

  return 'http://localhost:4201/mcp';
}

function mcpHeaders(token: string, workspaceId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'x-evukb-workspace-id': workspaceId,
  };
}

function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function buildMcpHarnessGuides(
  token = MCP_TOKEN_PLACEHOLDER,
  workspaceId = resolveEvuKbRuntimeConfig().workspaceId,
): McpHarnessGuide[] {
  const mcpUrl = resolveMcpServerUrl();
  const headers = mcpHeaders(token, workspaceId);

  return [
    {
      id: 'cursor',
      label: 'Cursor',
      configFilename: '.cursor/mcp.json',
      installHint:
        'Add this to a project `.cursor/mcp.json` file, or paste into Cursor Settings → MCP → Add server. For agent tool routing, see docs/MCP-AGENT-GUIDE.md (prefer search + list_documents over ask).',
      configText: formatJson({
        mcpServers: {
          evukb: {
            url: mcpUrl,
            headers,
          },
        },
      }),
    },
    {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      configFilename: 'claude_desktop_config.json',
      installHint:
        'Merge into your Claude Desktop config (macOS: ~/Library/Application Support/Claude/claude_desktop_config.json). Restart Claude after saving.',
      configText: formatJson({
        mcpServers: {
          evukb: {
            url: mcpUrl,
            headers,
          },
        },
      }),
    },
    {
      id: 'windsurf',
      label: 'Windsurf',
      configFilename: '.windsurf/mcp.json',
      installHint:
        'Add to `.windsurf/mcp.json` in the project, or configure through Windsurf MCP settings using the same JSON shape as Cursor.',
      configText: formatJson({
        mcpServers: {
          evukb: {
            url: mcpUrl,
            headers,
          },
        },
      }),
    },
    {
      id: 'vscode',
      label: 'VS Code',
      configFilename: '.vscode/mcp.json',
      installHint:
        'Add to `.vscode/mcp.json` when your editor MCP extension supports Streamable HTTP servers.',
      configText: formatJson({
        servers: {
          evukb: {
            type: 'http',
            url: mcpUrl,
            headers,
          },
        },
      }),
    },
    {
      id: 'generic',
      label: 'HTTP client',
      configFilename: 'mcp-config.json',
      installHint:
        'Use any MCP client that supports Streamable HTTP. Send the bearer token and workspace header on every request to POST /mcp.',
      configText: formatJson({
        transport: 'streamable-http',
        url: mcpUrl,
        method: 'POST',
        headers,
      }),
    },
  ];
}
