import { describe, expect, it } from 'vitest';

import { assertKbAdminScope } from '../src/auth/kb-admin-auth.js';
import { ApiError } from '../src/errors.js';

function mockRequest(scopes: string[]): {
  evuKbActor: { kind: 'api_key'; tokenId: string; scopes: string[] };
} {
  return {
    evuKbActor: {
      kind: 'api_key',
      tokenId: 'key-1',
      scopes: scopes as never,
    },
  };
}

describe('kb admin auth', () => {
  it('allows kb:admin', () => {
    expect(() => assertKbAdminScope(mockRequest(['kb:admin']) as never)).not.toThrow();
  });

  it('allows operator actor', () => {
    expect(() => assertKbAdminScope({ evuKbActor: { kind: 'operator' } } as never)).not.toThrow();
  });

  it('rejects kb:write without kb:admin', () => {
    expect(() => assertKbAdminScope(mockRequest(['kb:write']) as never)).toThrow(ApiError);
    try {
      assertKbAdminScope(mockRequest(['kb:write']) as never);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toMatch(/kb:admin/);
    }
  });
});
