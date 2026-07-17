import { describe, expect, it } from 'vitest';

import {
  isCorpusGitWritebackActive,
  isGitWritebackDefaultBranchTarget,
  isGitWritebackEnabled,
  resolveGitWritebackBranch,
  resolveGitWritebackFeatureBranch,
  shouldGitWritebackNode,
  validateSyncSettings,
} from '../src/sync/index.js';

describe('git writeback settings', () => {
  it('gates on EVUKB_ENABLE_GIT_WRITEBACK', () => {
    expect(isGitWritebackEnabled({ EVUKB_ENABLE_GIT_WRITEBACK: 'true' })).toBe(true);
    expect(isGitWritebackEnabled({})).toBe(false);
  });

  it('validates gitWritebackEnabled against env and importKind', () => {
    expect(
      validateSyncSettings(
        { importKind: 'git', gitRemoteUrl: 'https://example.com/r.git', gitWritebackEnabled: true },
        { allowGitWriteback: true },
      ),
    ).toBeNull();
    expect(
      validateSyncSettings(
        { importKind: 'git', gitRemoteUrl: 'https://example.com/r.git', gitWritebackEnabled: true },
        { allowGitWriteback: false },
      ),
    ).toContain('EVUKB_ENABLE_GIT_WRITEBACK');
    expect(
      validateSyncSettings(
        { importKind: 'mount', mountPath: '/tmp/v', gitWritebackEnabled: true },
        { allowGitWriteback: true },
      ),
    ).toContain('importKind');
  });

  it('resolves feature and default writeback branches', () => {
    expect(resolveGitWritebackFeatureBranch('corpus-1')).toBe('evukb/writeback/corpus-1');
    expect(
      resolveGitWritebackBranch(
        { gitRef: 'develop', gitWritebackUseFeatureBranch: true },
        'corpus-1',
      ),
    ).toBe('evukb/writeback/corpus-1');
    expect(
      resolveGitWritebackBranch({ gitRef: 'develop', gitWritebackBranch: 'ops' }, 'corpus-1'),
    ).toBe('ops');
    expect(isGitWritebackDefaultBranchTarget({ gitRef: 'main' }, 'c1')).toBe(true);
    expect(
      isGitWritebackDefaultBranchTarget(
        { gitRef: 'main', gitWritebackUseFeatureBranch: true },
        'c1',
      ),
    ).toBe(false);
  });

  it('detects active corpus writeback', () => {
    expect(
      isCorpusGitWritebackActive(
        { importKind: 'git', gitWritebackEnabled: true },
        { EVUKB_ENABLE_GIT_WRITEBACK: 'true' },
      ),
    ).toBe(true);
    expect(
      isCorpusGitWritebackActive(
        { importKind: 'git', gitWritebackEnabled: true },
        { EVUKB_ENABLE_GIT_WRITEBACK: 'false' },
      ),
    ).toBe(false);
    expect(shouldGitWritebackNode({ sourceType: 'git', nodeType: 'file' })).toBe(true);
    expect(shouldGitWritebackNode({ sourceType: 'managed', nodeType: 'file' })).toBe(false);
  });
});
