import { describe, expect, it } from 'vitest';

import {
  globPatternToSqlLike,
  hasGlobWildcards,
  matchesGlobPattern,
} from '../src/search/glob-match.js';

describe('glob-match', () => {
  it('detects wildcard characters', () => {
    expect(hasGlobWildcards('active')).toBe(false);
    expect(hasGlobWildcards('New*')).toBe(true);
    expect(hasGlobWildcards('a?c')).toBe(true);
  });

  it('matches exact values case-insensitively without wildcards', () => {
    expect(matchesGlobPattern('Active', 'active')).toBe(true);
    expect(matchesGlobPattern('draft', 'active')).toBe(false);
  });

  it('matches * as any suffix/prefix/infix sequence', () => {
    expect(matchesGlobPattern('New note', 'New*')).toBe(true);
    expect(matchesGlobPattern('Brand new', '*new')).toBe(true);
    expect(matchesGlobPattern('alpha-beta', 'a*ta')).toBe(true);
    expect(matchesGlobPattern('New', 'News*')).toBe(false);
  });

  it('matches ? as a single character', () => {
    expect(matchesGlobPattern('New1', 'New?')).toBe(true);
    expect(matchesGlobPattern('New', 'New?')).toBe(false);
    expect(matchesGlobPattern('New12', 'New?')).toBe(false);
  });

  it('escapes literal % and _ for SQL ILIKE', () => {
    expect(globPatternToSqlLike('100%')).toBe('100\\%');
    expect(globPatternToSqlLike('a*_?')).toBe('a%\\__');
  });
});
