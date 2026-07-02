import { afterEach, describe, expect, it } from 'vitest';

import { resolveMcpEnableAsk } from '../src/mcp/config.js';

describe('resolveMcpEnableAsk', () => {
  const original = process.env.EVUKB_MCP_ENABLE_ASK;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EVUKB_MCP_ENABLE_ASK;
    } else {
      process.env.EVUKB_MCP_ENABLE_ASK = original;
    }
  });

  it('defaults to false', () => {
    delete process.env.EVUKB_MCP_ENABLE_ASK;
    expect(resolveMcpEnableAsk()).toBe(false);
  });

  it('enables ask when env is true', () => {
    process.env.EVUKB_MCP_ENABLE_ASK = 'true';
    expect(resolveMcpEnableAsk()).toBe(true);
  });
});
