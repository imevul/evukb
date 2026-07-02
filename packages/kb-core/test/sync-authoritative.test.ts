import { describe, expect, it } from 'vitest';

import { isMountAuthoritativeEnabled, shouldDeleteManagedPath } from '../src/sync/authoritative.js';
import { validateSyncSettings } from '../src/sync/settings.js';

describe('mount authoritative helpers', () => {
  it('detects env flag', () => {
    expect(isMountAuthoritativeEnabled({ EVUKB_ENABLE_MOUNT_AUTHORITATIVE: 'true' })).toBe(true);
    expect(isMountAuthoritativeEnabled({})).toBe(false);
  });

  it('flags managed paths missing from keep set', () => {
    const keep = new Set(['docs/alpha.md']);
    expect(shouldDeleteManagedPath('docs/beta.md', keep)).toBe(true);
    expect(shouldDeleteManagedPath('docs/alpha.md', keep)).toBe(false);
  });

  it('requires env flag for mount_authoritative mode', () => {
    expect(
      validateSyncSettings({ importKind: 'mount', mountMode: 'mount_authoritative' }),
    ).toContain('EVUKB_ENABLE_MOUNT_AUTHORITATIVE');
    expect(
      validateSyncSettings(
        { importKind: 'mount', mountMode: 'mount_authoritative' },
        { allowMountAuthoritative: true },
      ),
    ).toBeNull();
  });
});
