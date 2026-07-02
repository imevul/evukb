import { describe, expect, it } from 'vitest';

import {
  assertTokenPepperConfigured,
  classifyHttpAccess,
  isHttpAuthRequired,
} from '../src/auth/http-auth.js';

describe('http auth', () => {
  it('is fail-closed by default and only opens with the explicit opt-in', () => {
    expect(isHttpAuthRequired({ NODE_ENV: 'production' })).toBe(true);
    expect(isHttpAuthRequired({ EVUKB_REQUIRE_API_KEY: 'true', NODE_ENV: 'development' })).toBe(
      true,
    );
    // No opt-in: auth is required even outside production.
    expect(isHttpAuthRequired({ NODE_ENV: 'development' })).toBe(true);
    expect(isHttpAuthRequired({})).toBe(true);
    // Explicit opt-in opens auth outside production only.
    expect(isHttpAuthRequired({ EVUKB_ALLOW_OPEN_AUTH: 'true', NODE_ENV: 'development' })).toBe(
      false,
    );
    expect(isHttpAuthRequired({ EVUKB_ALLOW_OPEN_AUTH: 'true', NODE_ENV: 'production' })).toBe(
      true,
    );
    // Explicit require wins over the opt-in.
    expect(
      isHttpAuthRequired({
        EVUKB_ALLOW_OPEN_AUTH: 'true',
        EVUKB_REQUIRE_API_KEY: 'true',
        NODE_ENV: 'development',
      }),
    ).toBe(true);
  });

  it('requires a non-empty token pepper', () => {
    expect(() => assertTokenPepperConfigured({})).toThrow(/EVUKB_TOKEN_PEPPER/);
    expect(() => assertTokenPepperConfigured({ EVUKB_TOKEN_PEPPER: '   ' })).toThrow(
      /EVUKB_TOKEN_PEPPER/,
    );
    expect(() => assertTokenPepperConfigured({ EVUKB_TOKEN_PEPPER: 'pepper' })).not.toThrow();
  });

  it('classifies read vs write routes', () => {
    expect(classifyHttpAccess('GET', '/knowledge-corpora/c1/nodes')).toBe('read');
    expect(classifyHttpAccess('POST', '/knowledge-corpora/c1/search')).toBe('read');
    expect(classifyHttpAccess('POST', '/knowledge-corpora/c1/ask')).toBe('read');
    expect(classifyHttpAccess('POST', '/knowledge-corpora/c1/files')).toBe('write');
    expect(classifyHttpAccess('PUT', '/knowledge-corpora/c1/nodes/n1/content')).toBe('write');
    expect(classifyHttpAccess('PATCH', '/settings')).toBe('write');
  });
});
