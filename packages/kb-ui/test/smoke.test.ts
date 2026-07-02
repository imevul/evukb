import { describe, expect, it } from 'vitest';

import { evuKbUiPackageName } from '../src/index.js';

describe('kb-ui scaffold', () => {
  it('exports the package identity', () => {
    expect(evuKbUiPackageName).toBe('@evu/kb-ui');
  });
});
