import { describe, expect, it } from 'vitest';

import { createEvuKbApiProxy, resolveEvuKbApiProxyTarget } from '../vite.config.js';

describe('EvuKB web vite proxy config', () => {
  it('defaults the API proxy target to localhost:4201', () => {
    const previous = process.env.EVUKB_API_PROXY_TARGET;
    delete process.env.EVUKB_API_PROXY_TARGET;
    try {
      expect(resolveEvuKbApiProxyTarget({})).toBe('http://localhost:4201');
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_API_PROXY_TARGET;
      } else {
        process.env.EVUKB_API_PROXY_TARGET = previous;
      }
    }
  });

  it('prefers EVUKB_API_PROXY_TARGET for production preview proxying', () => {
    const previous = process.env.EVUKB_API_PROXY_TARGET;
    process.env.EVUKB_API_PROXY_TARGET = 'http://evukb-api:4201';
    try {
      expect(resolveEvuKbApiProxyTarget({})).toBe('http://evukb-api:4201');
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_API_PROXY_TARGET;
      } else {
        process.env.EVUKB_API_PROXY_TARGET = previous;
      }
    }
  });

  it('creates same-origin /api and /health proxy routes', () => {
    const proxy = createEvuKbApiProxy('http://evukb-api:4201');
    expect(proxy['/api'].target).toBe('http://evukb-api:4201');
    expect(proxy['/health'].target).toBe('http://evukb-api:4201');
  });
});
