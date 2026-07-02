import { describe, expect, it } from 'vitest';

import {
  defaultMutationApprovalPolicy,
  parseMutationApprovalPolicy,
  resolveMutationApprovalMode,
} from '../src/agent-write/approval-policy.js';

describe('mutation approval policy', () => {
  it('uses default approval policy', () => {
    expect(defaultMutationApprovalPolicy).toEqual({
      append: 'never',
      create: 'always',
      update: 'always',
      delete: 'always',
    });
  });

  it('merges workspace policy overrides', () => {
    const parsed = parseMutationApprovalPolicy({ append: 'always', create: 'never' });
    expect(parsed.append).toBe('always');
    expect(parsed.create).toBe('never');
    expect(parsed.update).toBe('always');
  });

  it('prefers corpus override over workspace policy', () => {
    const mode = resolveMutationApprovalMode({
      key: 'create',
      workspaceSettings: {
        mutationApprovalPolicy: { create: 'always' },
      },
      corpusSettings: {
        agentMutationApprovalPolicy: { create: 'never' },
      },
    });
    expect(mode).toBe('never');
  });

  it('falls back to workspace when corpus override is inherit', () => {
    const mode = resolveMutationApprovalMode({
      key: 'delete',
      workspaceSettings: {
        mutationApprovalPolicy: { delete: 'always' },
      },
      corpusSettings: {
        agentMutationApprovalPolicy: { delete: 'inherit' },
      },
    });
    expect(mode).toBe('always');
  });
});
