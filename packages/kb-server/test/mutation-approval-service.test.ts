import type { KbWriteActor, KbWriteToolRequest } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import type { AgentWriteService } from '../src/services/agent-write-service.js';
import { MutationApprovalService } from '../src/services/mutation-approval-service.js';

const actor: KbWriteActor = { kind: 'dev' };
const createRequest: KbWriteToolRequest = {
  action: 'create_document',
  corpusId: 'corpus-1',
  path: 'agent-notes',
  name: 'note.md',
  body: '# Note',
};

function createService(workspaceSettings: Record<string, unknown> = {}) {
  const pendingRecord = {
    id: 'approval-1',
    workspaceId: 'workspace-1',
    corpusId: 'corpus-1',
    status: 'pending' as const,
    action: 'create_document',
    request: createRequest,
    actor,
    preview: {
      corpusId: 'corpus-1',
      action: 'create_document' as const,
      path: 'agent-notes/note.md',
    },
    decidedBy: null,
    decidedAt: null,
    createdAt: '2026-06-30T00:00:00.000Z',
    updatedAt: '2026-06-30T00:00:00.000Z',
  };

  const approvals = {
    createPending: vi.fn().mockResolvedValue(pendingRecord),
    getByIdInWorkspace: vi.fn().mockResolvedValue(pendingRecord),
    listPending: vi.fn().mockResolvedValue([pendingRecord]),
    markApplied: vi.fn().mockResolvedValue({ ...pendingRecord, status: 'applied' }),
    markRejected: vi.fn().mockResolvedValue({ ...pendingRecord, status: 'rejected' }),
  };

  const agentWrite = {
    applyMutation: vi.fn().mockResolvedValue({
      ok: true,
      action: 'create_document',
      nodeId: 'node-1',
      path: 'agent-notes/note.md',
    }),
  } as unknown as AgentWriteService;

  const service = new MutationApprovalService({
    agentWrite,
    approvals: approvals as never,
    auditLog: { record: vi.fn() } as never,
    corpora: {
      getById: vi.fn().mockResolvedValue({ id: 'corpus-1', settings: {} }),
    } as never,
    nodes: { getById: vi.fn() } as never,
    workspaces: {
      getById: vi.fn().mockResolvedValue({ id: 'workspace-1', settings: workspaceSettings }),
    } as never,
  });

  return { service, agentWrite, approvals };
}

describe('MutationApprovalService', () => {
  it('returns null when policy mode is never', async () => {
    const { service, approvals } = createService({
      mutationApprovalPolicy: {
        append: 'never',
        create: 'never',
        update: 'never',
        delete: 'never',
      },
    });

    const result = await service.maybeGateWrite('workspace-1', actor, createRequest);
    expect(result).toBeNull();
    expect(approvals.createPending).not.toHaveBeenCalled();
  });

  it('creates pending approval when policy mode is always', async () => {
    const { service, approvals } = createService({
      mutationApprovalPolicy: {
        append: 'never',
        create: 'always',
        update: 'always',
        delete: 'always',
      },
    });

    const result = await service.maybeGateWrite('workspace-1', actor, createRequest);
    expect(result?.pendingApproval).toBe(true);
    expect(approvals.createPending).toHaveBeenCalledOnce();
  });

  it('approves by applying the stored mutation', async () => {
    const { service, agentWrite } = createService();
    const result = await service.approve('workspace-1', 'approval-1', actor);
    expect(agentWrite.applyMutation).toHaveBeenCalledWith('workspace-1', actor, createRequest);
    expect(result.ok).toBe(true);
  });

  it('rejects without applying the mutation', async () => {
    const { service, agentWrite } = createService();
    const result = await service.reject('workspace-1', 'approval-1', actor);
    expect(agentWrite.applyMutation).not.toHaveBeenCalled();
    expect(result.status).toBe('rejected');
  });
});
