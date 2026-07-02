/** Machine-readable SYNC-5 design checklist — docs-only until SYNC-6 implements writeback. */

export type GitWritebackDesignInvariant = {
  id: string;
  description: string;
  category: 'env_gate' | 'forbidden' | 'approval' | 'audit' | 'conflict' | 'scope';
};

export const gitWritebackRequiredEnv = ['EVUKB_ENABLE_GIT_WRITEBACK'] as const;

export const gitWritebackForbiddenBehaviors = [
  'force_push',
  'cross_workspace_git_cache',
  'cross_workspace_credential_use',
  'auto_merge_on_conflict',
  'writeback_without_env_gate',
] as const;

export const gitWritebackDesignInvariants: GitWritebackDesignInvariant[] = [
  {
    id: 'env-gate-required',
    category: 'env_gate',
    description: 'Git writeback requires EVUKB_ENABLE_GIT_WRITEBACK=true',
  },
  {
    id: 'git-corpus-only',
    category: 'scope',
    description: 'Writeback applies only to corpora with importKind git, not mount writeback',
  },
  {
    id: 'no-force-push',
    category: 'forbidden',
    description: 'Force-push to remote is forbidden',
  },
  {
    id: 'no-cross-workspace-cache',
    category: 'forbidden',
    description: 'Git cache directories are workspace-scoped',
  },
  {
    id: 'fail-closed-conflicts',
    category: 'conflict',
    description: 'Diverged history blocks writeback; no auto-merge in v1',
  },
  {
    id: 'protected-branch-block',
    category: 'forbidden',
    description: 'Push to protected branches is blocked with operator-visible error',
  },
  {
    id: 'agent-approval-respected',
    category: 'approval',
    description: 'Agent-triggered writeback respects mutation approval policy',
  },
  {
    id: 'audit-commit-push',
    category: 'audit',
    description: 'Commit and push attempts emit audit records without secret values',
  },
];
