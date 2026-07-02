import type { WorkspaceId } from '../ids.js';

export type AuditLogActorKind = 'mcp_token' | 'api_key' | 'dev' | 'open';

export type AuditLogActor = {
  kind: AuditLogActorKind;
  tokenId?: string;
};

export type AuditLogTarget = {
  corpusId?: string;
  nodeId?: string;
  path?: string;
  deleted?: number;
};

export type AuditLogEntry = {
  id: string;
  workspaceId: WorkspaceId;
  action: string;
  actor: AuditLogActor;
  target: AuditLogTarget | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ListAuditLogQuery = {
  limit?: number;
  action?: string;
};

export const defaultAuditLogLimit = 50;
export const maxAuditLogLimit = 200;
