import { describe, expect, it } from 'vitest';

import { workspaces } from '../src/schema/workspaces.js';

describe('kb-db schema', () => {
  it('exports workspace tables', () => {
    expect(workspaces).toBeDefined();
  });
});
