import {
  buildMutationApprovalPreview,
  type KbToolPendingApprovalResponse,
  type KbWriteActor,
  type KbWriteToolRequest,
  type KbWriteToolResponse,
  type MutationApprovalRecord,
  mutationApprovalKey,
  resolveMutationApprovalMode,
} from '@evu/kb-core';
import type {
  AuditLogRepository,
  CorpusRepository,
  MutationApprovalRepository,
  NodeRepository,
  WorkspaceRepository,
} from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { AgentWriteService } from './agent-write-service.js';

export type MutationApprovalServiceDeps = {
  agentWrite: AgentWriteService;
  approvals: MutationApprovalRepository;
  auditLog: AuditLogRepository;
  corpora: CorpusRepository;
  nodes: NodeRepository;
  workspaces: WorkspaceRepository;
};

export class MutationApprovalService {
  readonly #agentWrite: AgentWriteService;
  readonly #approvals: MutationApprovalRepository;
  readonly #auditLog: AuditLogRepository;
  readonly #corpora: CorpusRepository;
  readonly #nodes: NodeRepository;
  readonly #workspaces: WorkspaceRepository;

  constructor(deps: MutationApprovalServiceDeps) {
    this.#agentWrite = deps.agentWrite;
    this.#approvals = deps.approvals;
    this.#auditLog = deps.auditLog;
    this.#corpora = deps.corpora;
    this.#nodes = deps.nodes;
    this.#workspaces = deps.workspaces;
  }

  async maybeGateWrite(
    workspaceId: string,
    actor: KbWriteActor,
    request: KbWriteToolRequest,
  ): Promise<KbToolPendingApprovalResponse | null> {
    const corpus = await this.#corpora.getById(workspaceId, request.corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(request.corpusId);
    }

    const workspace = await this.#workspaces.getById(workspaceId);
    const key = mutationApprovalKey(request.action);
    const mode = resolveMutationApprovalMode({
      key,
      workspaceSettings: workspace?.settings ?? {},
      corpusSettings: corpus.settings,
    });

    if (mode === 'never') {
      return null;
    }

    const preview = await this.#buildPreview(workspaceId, request);
    const record = await this.#approvals.createPending({
      workspaceId,
      corpusId: request.corpusId,
      action: request.action,
      request,
      actor,
      preview,
    });

    await this.#auditLog.record({
      workspaceId,
      action: 'mutation.approval.requested',
      actor,
      target: {
        corpusId: request.corpusId,
        path: preview.path,
        nodeId: preview.nodeId,
      },
      metadata: {
        approvalId: record.id,
        knowledgeAction: request.action,
      },
    });

    return {
      ok: false,
      pendingApproval: true,
      approvalId: record.id,
      preview,
    };
  }

  async listPending(workspaceId: string, limit?: number): Promise<MutationApprovalRecord[]> {
    return this.#approvals.listPending(workspaceId, limit);
  }

  async approve(
    workspaceId: string,
    approvalId: string,
    decider: KbWriteActor,
  ): Promise<KbWriteToolResponse> {
    const existing = await this.#approvals.getByIdInWorkspace(workspaceId, approvalId);
    if (!existing) {
      throw ApiError.notFound('Approval request not found.');
    }
    if (existing.status !== 'pending') {
      throw ApiError.validation('Approval request is no longer pending.');
    }

    const result = await this.#agentWrite.applyMutation(
      workspaceId,
      existing.actor,
      existing.request,
    );

    const updated = await this.#approvals.markApplied(workspaceId, approvalId, decider);
    if (!updated) {
      throw ApiError.validation('Approval request is no longer pending.');
    }

    await this.#auditLog.record({
      workspaceId,
      action: 'mutation.approval.applied',
      actor: decider,
      target: {
        corpusId: existing.corpusId,
        path: existing.preview.path,
        nodeId: existing.preview.nodeId,
      },
      metadata: {
        approvalId,
        knowledgeAction: existing.action,
      },
    });

    return result;
  }

  async reject(
    workspaceId: string,
    approvalId: string,
    decider: KbWriteActor,
  ): Promise<MutationApprovalRecord> {
    const existing = await this.#approvals.getByIdInWorkspace(workspaceId, approvalId);
    if (!existing) {
      throw ApiError.notFound('Approval request not found.');
    }
    if (existing.status !== 'pending') {
      throw ApiError.validation('Approval request is no longer pending.');
    }

    const updated = await this.#approvals.markRejected(workspaceId, approvalId, decider);
    if (!updated) {
      throw ApiError.validation('Approval request is no longer pending.');
    }

    await this.#auditLog.record({
      workspaceId,
      action: 'mutation.approval.rejected',
      actor: decider,
      target: {
        corpusId: existing.corpusId,
        path: existing.preview.path,
        nodeId: existing.preview.nodeId,
      },
      metadata: {
        approvalId,
        knowledgeAction: existing.action,
      },
    });

    return updated;
  }

  async #buildPreview(workspaceId: string, request: KbWriteToolRequest) {
    if (request.action === 'update_document' || request.action === 'delete_document') {
      const node = await this.#nodes.getById(workspaceId, request.corpusId, request.nodeId);
      const path = node ? (node.path ? `${node.path}/${node.name}` : node.name) : undefined;
      return buildMutationApprovalPreview(request, path);
    }

    if (request.action === 'create_document') {
      const path = request.path
        ? `${request.path}/${request.name}`.replace(/^\/+/, '')
        : request.name;
      return buildMutationApprovalPreview(request, path);
    }

    return buildMutationApprovalPreview(request);
  }
}
