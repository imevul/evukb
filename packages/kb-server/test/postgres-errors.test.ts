import { describe, expect, it } from 'vitest';

import { getPostgresErrorCode, isPostgresUniqueViolation } from '../src/db/postgres-errors.js';

describe('postgres error helpers', () => {
  it('reads postgres codes from nested drizzle causes', () => {
    const error = {
      message: 'Failed query',
      cause: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    };

    expect(getPostgresErrorCode(error)).toBe('23505');
    expect(isPostgresUniqueViolation(error)).toBe(true);
  });

  it('returns undefined for non-postgres errors', () => {
    expect(getPostgresErrorCode(new Error('boom'))).toBeUndefined();
    expect(isPostgresUniqueViolation(new Error('boom'))).toBe(false);
  });
});
