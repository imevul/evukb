import type { WorkspaceId } from '../ids.js';

export type KbAuthScope = 'kb:read' | 'kb:write' | 'kb:admin';

export const defaultKbReadScopes: KbAuthScope[] = ['kb:read'];

export const allKbAuthScopes: KbAuthScope[] = ['kb:read', 'kb:write', 'kb:admin'];

export type McpTokenRecord = {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  scopes: KbAuthScope[];
  expiresAt: string | null;
  createdAt: string;
};

export type ApiKeyRecord = {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  scopes: KbAuthScope[];
  expiresAt: string | null;
  createdAt: string;
};

export type CreatedMcpToken = McpTokenRecord & {
  token: string;
};

export type CreatedApiKey = ApiKeyRecord & {
  key: string;
};

export type AuthenticatedToken = {
  tokenId: string;
  workspaceId: WorkspaceId;
  scopes: KbAuthScope[];
};
