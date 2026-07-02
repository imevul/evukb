function normalizeComparable(value: string): string {
  return value.trim().toLowerCase();
}

export function hasGlobWildcards(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?');
}

function escapeRegexLiteral(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function globPatternToRegExp(pattern: string): RegExp {
  let source = '^';
  for (const char of pattern) {
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else {
      source += escapeRegexLiteral(char);
    }
  }
  source += '$';
  return new RegExp(source, 'i');
}

/** Convert a `?` / `*` glob into a PostgreSQL ILIKE pattern. */
export function globPatternToSqlLike(pattern: string): string {
  let result = '';
  for (const char of pattern) {
    if (char === '*') {
      result += '%';
    } else if (char === '?') {
      result += '_';
    } else if (char === '%' || char === '_' || char === '\\') {
      result += `\\${char}`;
    } else {
      result += char;
    }
  }
  return result;
}

export function matchesGlobPattern(actual: string, pattern: string): boolean {
  if (!hasGlobWildcards(pattern)) {
    return normalizeComparable(actual) === normalizeComparable(pattern);
  }
  return globPatternToRegExp(pattern).test(actual);
}
