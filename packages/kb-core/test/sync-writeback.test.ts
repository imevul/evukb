import { describe, expect, it } from 'vitest';

import {
  formatWritebackDriftSummary,
  formatWritebackDriftWarning,
  importWritebackConflictPolicyV1,
  isImportWritebackEnabled,
  mountContentMatchesKb,
  resolveManagedMountRelativePath,
  shouldWritebackManagedNode,
  validateSyncSettings,
} from '../src/sync/index.js';

describe('import writeback settings', () => {
  it('documents v1 conflict policy', () => {
    expect(importWritebackConflictPolicyV1.save).toBe('kb_wins_overwrite_mount');
    expect(importWritebackConflictPolicyV1.delete).toBe('kb_wins_unlink_mount');
    expect(importWritebackConflictPolicyV1.externalMountEdit).toBe('not_reconciled_v1');
  });

  it('selects managed file nodes for writeback', () => {
    expect(shouldWritebackManagedNode({ sourceType: 'managed', nodeType: 'file' })).toBe(true);
    expect(shouldWritebackManagedNode({ sourceType: 'shared_mount', nodeType: 'file' })).toBe(
      false,
    );
    expect(shouldWritebackManagedNode({ sourceType: 'managed', nodeType: 'folder' })).toBe(false);
  });
  it('gates import_writeback on env flag', () => {
    expect(isImportWritebackEnabled({ EVUKB_ENABLE_IMPORT_WRITEBACK: 'true' })).toBe(true);
    expect(isImportWritebackEnabled({})).toBe(false);
  });

  it('validates import_writeback mount mode when env is enabled', () => {
    expect(
      validateSyncSettings(
        { importKind: 'mount', mountPath: '/tmp/vault', mountMode: 'import_writeback' },
        { allowImportWriteback: true },
      ),
    ).toBeNull();
    expect(
      validateSyncSettings(
        { importKind: 'mount', mountPath: '/tmp/vault', mountMode: 'import_writeback' },
        { allowImportWriteback: false },
      ),
    ).toContain('EVUKB_ENABLE_IMPORT_WRITEBACK');
  });

  it('resolves managed mount relative paths', () => {
    expect(resolveManagedMountRelativePath({ path: 'docs', name: 'note.md' })).toBe('docs/note.md');
    expect(resolveManagedMountRelativePath({ path: '', name: 'note.md' })).toBe('note.md');
  });

  it('compares mount and KB content hashes for drift detection', () => {
    expect(mountContentMatchesKb('abc123', 'abc123')).toBe(true);
    expect(mountContentMatchesKb('abc123', 'def456')).toBe(false);
    expect(mountContentMatchesKb(null, 'abc123')).toBe(true);
  });

  it('formats writeback drift warnings', () => {
    expect(formatWritebackDriftWarning('docs/note.md')).toContain('docs/note.md');
    expect(formatWritebackDriftSummary(2, ['a.md', 'b.md'])).toContain('2 managed file(s)');
  });
});
