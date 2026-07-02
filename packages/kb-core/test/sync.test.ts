import { describe, expect, it } from 'vitest';
import {
  resolveGitSourceType,
  resolveNodeMutability,
  resolveSyncedSourceType,
} from '../src/sync/mutability.js';
import {
  isPathWithinRoot,
  parseMountAllowlist,
  resolveAllowedMountPath,
  splitRelativeFilePath,
} from '../src/sync/paths.js';
import {
  parseCorpusSyncSettings,
  resolveGitRef,
  resolveImportKind,
  validateSyncSettings,
} from '../src/sync/settings.js';

describe('sync settings', () => {
  it('parses mount and git corpus settings', () => {
    const parsed = parseCorpusSyncSettings({
      importKind: 'git',
      gitRemoteUrl: 'https://example.com/repo.git',
      gitRef: 'main',
      syncStatus: { lastSyncStatus: 'success', lastSyncAt: '2026-06-30T00:00:00.000Z' },
    });
    expect(parsed.importKind).toBe('git');
    expect(parsed.gitRemoteUrl).toBe('https://example.com/repo.git');
    expect(parsed.syncStatus?.lastSyncStatus).toBe('success');
  });

  it('validates importKind and required fields', () => {
    expect(validateSyncSettings({ importKind: 'mount', mountPath: '/data/vault' })).toBeNull();
    expect(validateSyncSettings({ importKind: 'mount', mountPath: '' })).toContain('mountPath');
    expect(validateSyncSettings({ importKind: 'invalid' })).toContain('importKind');
  });

  it('resolves defaults', () => {
    expect(resolveImportKind({})).toBe('managed');
    expect(resolveImportKind({ importKind: 'mount' })).toBe('mount');
    expect(resolveGitRef({})).toBe('main');
    expect(resolveGitRef({ gitRef: 'develop' })).toBe('develop');
  });
});

describe('sync mutability', () => {
  it('marks managed nodes editable and synced nodes read-only', () => {
    expect(resolveNodeMutability({ sourceType: 'managed', nodeType: 'file' }).editable).toBe(true);
    expect(resolveNodeMutability({ sourceType: 'shared_mount', nodeType: 'file' }).editable).toBe(
      false,
    );
    expect(resolveNodeMutability({ sourceType: 'git', nodeType: 'file' }).reason).toContain('git');
    expect(resolveNodeMutability({ sourceType: 'reference', nodeType: 'file' }).reason).toContain(
      'reference',
    );
  });

  it('classifies references paths', () => {
    expect(resolveSyncedSourceType('references/paper.pdf')).toBe('reference');
    expect(resolveSyncedSourceType('concepts/alpha.md')).toBe('shared_mount');
    expect(resolveGitSourceType('references/paper.pdf')).toBe('reference');
    expect(resolveGitSourceType('concepts/alpha.md')).toBe('git');
  });
});

describe('sync paths', () => {
  it('parses mount allowlist and checks containment', () => {
    const allowlist = parseMountAllowlist('/tmp/evukb,/var/data');
    expect(allowlist.length).toBe(2);
    expect(isPathWithinRoot('/tmp/evukb', '/tmp/evukb/docs')).toBe(true);
    expect(isPathWithinRoot('/tmp/evukb', '/tmp/other')).toBe(false);
  });

  it('rejects mount paths outside allowlist', () => {
    const allowlist = parseMountAllowlist('/tmp/evukb');
    const result = resolveAllowedMountPath('/etc/passwd', allowlist);
    expect('error' in result).toBe(true);
  });

  it('accepts mount paths under allowlist', () => {
    const allowlist = parseMountAllowlist('/tmp/evukb');
    const result = resolveAllowedMountPath('/tmp/evukb/vault', allowlist);
    expect('resolved' in result).toBe(true);
  });

  it('splits relative file paths', () => {
    expect(splitRelativeFilePath('docs/alpha.md')).toEqual({
      parentPath: 'docs',
      name: 'alpha.md',
    });
    expect(splitRelativeFilePath('alpha.md')).toEqual({ parentPath: '', name: 'alpha.md' });
  });
});
