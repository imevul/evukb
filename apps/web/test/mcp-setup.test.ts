import { describe, expect, it } from 'vitest';

import { buildMcpHarnessGuides, MCP_TOKEN_PLACEHOLDER } from '../src/mcp-setup.js';

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
});
