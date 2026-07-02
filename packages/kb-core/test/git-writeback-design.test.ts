import { describe, expect, it } from 'vitest';

import {
  gitWritebackDesignInvariants,
  gitWritebackForbiddenBehaviors,
  gitWritebackRequiredEnv,
} from './fixtures/git-writeback-design-golden.js';

describe('git writeback design golden', () => {
  it('lists required env gates', () => {
    expect(gitWritebackRequiredEnv).toContain('EVUKB_ENABLE_GIT_WRITEBACK');
  });

  it('forbids unsafe git behaviors', () => {
    expect(gitWritebackForbiddenBehaviors).toContain('force_push');
    expect(gitWritebackForbiddenBehaviors).toContain('auto_merge_on_conflict');
    expect(gitWritebackForbiddenBehaviors).toContain('writeback_without_env_gate');
  });

  it('covers SYNC-5 design invariant categories', () => {
    const categories = new Set(gitWritebackDesignInvariants.map((item) => item.category));
    expect(categories.has('env_gate')).toBe(true);
    expect(categories.has('forbidden')).toBe(true);
    expect(categories.has('approval')).toBe(true);
    expect(categories.has('audit')).toBe(true);
    expect(categories.has('conflict')).toBe(true);
    expect(categories.has('scope')).toBe(true);
  });

  it('uses stable invariant ids', () => {
    const ids = gitWritebackDesignInvariants.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('no-force-push');
    expect(ids).toContain('fail-closed-conflicts');
  });
});
