import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/errors.js';
import {
  corpusCreateBodySchema,
  parseBody,
  tokenCreateBodySchema,
  workspaceAskBodySchema,
  workspaceSearchBodySchema,
} from '../src/routes/body-schemas.js';

describe('HTTP body schemas', () => {
  it('accepts valid corpus create bodies', () => {
    expect(parseBody(corpusCreateBodySchema, { name: 'Docs' })).toEqual({ name: 'Docs' });
  });

  it('rejects wrong types with a 400 ApiError naming the field', () => {
    try {
      parseBody(corpusCreateBodySchema, { name: 42 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toContain('name');
    }
  });

  it('validates search bodies including nested filters', () => {
    expect(() =>
      parseBody(workspaceSearchBodySchema, {
        corpusIds: ['c1'],
        query: 'hello',
        filters: { tags: ['a'] },
        rankingSettings: { keywordWeight: 0.5 },
      }),
    ).not.toThrow();

    expect(() =>
      parseBody(workspaceSearchBodySchema, {
        corpusIds: ['c1'],
        filters: { tags: 'not-an-array' },
      }),
    ).toThrow(ApiError);

    expect(() => parseBody(workspaceSearchBodySchema, { corpusIds: ['c1'], limit: -5 })).toThrow(
      ApiError,
    );
  });

  it('validates ask bodies', () => {
    expect(() =>
      parseBody(workspaceAskBodySchema, { question: 'What?', responseMode: 'concise' }),
    ).not.toThrow();
    expect(() =>
      parseBody(workspaceAskBodySchema, { question: 'What?', responseMode: 'verbose' }),
    ).toThrow(ApiError);
    expect(() => parseBody(workspaceAskBodySchema, {})).toThrow(ApiError);
  });

  it('validates token create scopes', () => {
    expect(() =>
      parseBody(tokenCreateBodySchema, { name: 'ci', scopes: ['kb:read'] }),
    ).not.toThrow();
    expect(() =>
      parseBody(tokenCreateBodySchema, { name: 'ci', scopes: ['kb:admin'] }),
    ).not.toThrow();
    expect(() =>
      parseBody(tokenCreateBodySchema, { name: 'ci', scopes: ['kb:superuser'] }),
    ).toThrow(ApiError);
  });
});
