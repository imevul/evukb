import type { CorpusId, WorkspaceId } from './ids.js';

export type KnowledgeWorkspaceScope = {
  workspaceId: WorkspaceId;
  corpusId?: CorpusId;
};

export function describeKnowledgeScope(scope: KnowledgeWorkspaceScope): string {
  return scope.corpusId ? `${scope.workspaceId}/${scope.corpusId}` : scope.workspaceId;
}

export function assertWorkspaceScope(
  expectedWorkspaceId: WorkspaceId,
  actualWorkspaceId: WorkspaceId,
): void {
  if (expectedWorkspaceId !== actualWorkspaceId) {
    throw new Error('Cross-workspace access is not allowed.');
  }
}
