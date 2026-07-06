export function getPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('code' in current && typeof (current as { code: unknown }).code === 'string') {
      return (current as { code: string }).code;
    }
    current = 'cause' in current ? (current as { cause: unknown }).cause : undefined;
  }

  return undefined;
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return getPostgresErrorCode(error) === '23505';
}
