export type KbAuthScope = 'kb:read' | 'kb:write';

export type McpTokenRecord = {
  id: string;
  workspaceId: string;
  name: string;
  scopes: KbAuthScope[];
  expiresAt: string | null;
  createdAt: string;
};

export type ApiKeyRecord = {
  id: string;
  workspaceId: string;
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
  workspaceId: string;
  scopes: KbAuthScope[];
};

export type CreateAuthCredentialRequest = {
  name: string;
  scopes?: KbAuthScope[];
  expiresAt?: string | null;
};
