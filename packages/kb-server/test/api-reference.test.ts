import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveApiReferenceHtmlPath } from '../src/server/api-reference.js';

describe('resolveApiReferenceHtmlPath', () => {
  it('finds the generated API reference in the repo', () => {
    const path = resolveApiReferenceHtmlPath();
    expect(path).not.toBeNull();
    expect(existsSync(path!)).toBe(true);
    expect(path!).toMatch(/docs\/api\/index\.html$/);
  });
});
