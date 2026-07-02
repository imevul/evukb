import type { KnowledgeNode } from '@evu/kb-core';
import type { AuditLogRepository } from '@evu/kb-db';

import type { MountWritebackService } from '../mount-writeback-service.js';
import type { FileManagerDeps, FileMutationContext } from './types.js';

export async function recordAudit(
  auditLog: AuditLogRepository | undefined,
  workspaceId: string,
  context: FileMutationContext,
  action: string,
  target: Record<string, unknown>,
): Promise<void> {
  if (!auditLog || !context.auditActor || context.internal) {
    return;
  }
  await auditLog.record({
    workspaceId,
    action,
    actor: context.auditActor,
    target,
  });
}

export async function maybeWritebackManagedFile(
  mountWriteback: MountWritebackService | undefined,
  workspaceId: string,
  corpusId: string,
  node: KnowledgeNode,
  content: Buffer,
): Promise<void> {
  if (!mountWriteback) {
    return;
  }
  await mountWriteback.maybeWritebackManagedFile(workspaceId, corpusId, node, content);
}

export async function maybeDeleteWritebackManagedFile(
  mountWriteback: MountWritebackService | undefined,
  workspaceId: string,
  corpusId: string,
  node: KnowledgeNode,
): Promise<void> {
  if (!mountWriteback) {
    return;
  }
  await mountWriteback.maybeDeleteWritebackManagedFile(workspaceId, corpusId, node);
}

export async function notifyContentChanged(
  onContentChanged: FileManagerDeps['onContentChanged'],
  workspaceId: string,
  corpusId: string,
  nodeId: string,
): Promise<void> {
  if (!onContentChanged) {
    return;
  }
  await onContentChanged({ workspaceId, corpusId, nodeId });
}
