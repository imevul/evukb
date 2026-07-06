import { describe, expect, it, vi } from 'vitest';

import {
  buildMcpHarnessGuides,
  MCP_TOKEN_PLACEHOLDER,
  resolveMcpServerUrl,
} from '../src/mcp-setup.js';

describe('mcp-setup', () => {
  it('builds harness configs with workspace header and token placeholder', () => {
    const guides = buildMcpHarnessGuides();
    const cursor = guides.find((guide) => guide.id === 'cursor');
    expect(cursor).toBeDefined();
    expect(cursor?.configText).toContain(MCP_TOKEN_PLACEHOLDER);
    expect(cursor?.configText).toContain('x-evukb-workspace-id');
    expect(cursor?.configText).toContain('/mcp');
  });

  it('substitutes a created token into config output', () => {
    const guides = buildMcpHarnessGuides('evukb_mcp_test_token');
    const generic = guides.find((guide) => guide.id === 'generic');
    expect(generic?.configText).toContain('evukb_mcp_test_token');
    expect(generic?.configText).not.toContain(MCP_TOKEN_PLACEHOLDER);
  });

  it('uses runtime MCP base URL when configured', () => {
    vi.stubGlobal('window', {
      __EVUKB_CONFIG__: {
        mcpBaseUrl: 'https://evukb-api.example.com',
      },
      location: {
        protocol: 'https:',
        hostname: 'evukb.example.com',
        port: '',
        origin: 'https://evukb.example.com',
      },
    });

    expect(resolveMcpServerUrl()).toBe('https://evukb-api.example.com/mcp');

    vi.unstubAllGlobals();
  });

  it('derives MCP URL from runtime API base URL', () => {
    vi.stubGlobal('window', {
      __EVUKB_CONFIG__: {
        apiBaseUrl: 'https://evukb-api.example.com',
      },
      location: {
        protocol: 'https:',
        hostname: 'evukb.example.com',
        port: '',
        origin: 'https://evukb.example.com',
      },
    });

    expect(resolveMcpServerUrl()).toBe('https://evukb-api.example.com/mcp');

    vi.unstubAllGlobals();
  });
});
