import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveExampleRankingStrategiesModulePath } from '../src/search/load-example-ranking-strategies.js';

describe('resolveExampleRankingStrategiesModulePath', () => {
  it('resolves the example register-dev module from the repository root', () => {
    const resolved = resolveExampleRankingStrategiesModulePath();
    expect(resolved.endsWith('examples/custom-ranking-strategy/src/register-dev.ts')).toBe(true);
    expect(existsSync(resolved)).toBe(true);
  });
});
