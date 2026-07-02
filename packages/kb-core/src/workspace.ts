import type { UserId, WorkspaceId } from './ids.js';
import type { WorkspaceRole } from './runtime.js';

export type Workspace = {
  id: WorkspaceId;
  slug: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: string;
};

export type WorkspaceMember = {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: WorkspaceRole;
  createdAt: string;
};

export type CreateWorkspaceInput = {
  slug: string;
  name: string;
  settings?: Record<string, unknown>;
};
