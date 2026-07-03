import {
  type ApiKeyRecord,
  type AuthenticatedToken,
  allKbAuthScopes,
  type CreatedApiKey,
  type CreatedMcpToken,
  defaultKbReadScopes,
  type KbAuthScope,
  type McpTokenRecord,
  parseAgentWritePathPrefixes,
  validateCredentialWritePathPrefixes,
  workspaceAgentWritePathPrefixes,
} from '@evu/kb-core';
import type { ApiKeyRepository, McpTokenRepository, WorkspaceRepository } from '@evu/kb-db';
import {
  generateApiKeySecret,
  generateMcpTokenSecret,
  hashTokenSecret,
} from '../auth/token-hash.js';
import { ApiError } from '../errors.js';

export type CreateTokenInput = {
  workspaceId: string;
  name: string;
  scopes?: KbAuthScope[];
  writePathPrefixes?: string[] | null;
  expiresAt?: string | null;
};

function normalizeScopes(scopes?: KbAuthScope[]): KbAuthScope[] {
  if (!scopes || scopes.length === 0) {
    return [...defaultKbReadScopes];
  }

  for (const scope of scopes) {
    if (!allKbAuthScopes.includes(scope)) {
      throw ApiError.validation(`Invalid scope: ${scope}`);
    }
  }

  return scopes;
}

function normalizeWritePathPrefixes(raw: string[] | null | undefined): string[] | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const parsed = parseAgentWritePathPrefixes(raw);
  return parsed ?? null;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() <= Date.now();
}

function toAuthenticatedToken(record: McpTokenRecord | ApiKeyRecord): AuthenticatedToken | null {
  if (isExpired(record.expiresAt)) {
    return null;
  }

  return {
    tokenId: record.id,
    workspaceId: record.workspaceId,
    scopes: record.scopes,
  };
}

export class TokenAuthService {
  readonly #mcpTokens: McpTokenRepository;
  readonly #apiKeys: ApiKeyRepository;
  readonly #workspaces: WorkspaceRepository;

  constructor(
    mcpTokens: McpTokenRepository,
    apiKeys: ApiKeyRepository,
    workspaces: WorkspaceRepository,
  ) {
    this.#mcpTokens = mcpTokens;
    this.#apiKeys = apiKeys;
    this.#workspaces = workspaces;
  }

  async #assertValidWritePathPrefixes(
    workspaceId: string,
    writePathPrefixes: string[] | null | undefined,
  ): Promise<string[] | null> {
    if (writePathPrefixes === undefined || writePathPrefixes === null) {
      return null;
    }
    const workspace = await this.#workspaces.getById(workspaceId);
    if (!workspace) {
      throw ApiError.notFound(`Workspace not found: ${workspaceId}`);
    }
    const error = validateCredentialWritePathPrefixes(
      writePathPrefixes,
      workspaceAgentWritePathPrefixes(workspace.settings),
    );
    if (error) {
      throw ApiError.validation(error);
    }
    return normalizeWritePathPrefixes(writePathPrefixes);
  }

  async createMcpToken(input: CreateTokenInput): Promise<CreatedMcpToken> {
    const name = input.name.trim();
    if (!name) {
      throw ApiError.validation('Token name is required.');
    }

    const writePathPrefixes = await this.#assertValidWritePathPrefixes(
      input.workspaceId,
      input.writePathPrefixes,
    );

    const token = generateMcpTokenSecret();
    const record = await this.#mcpTokens.create({
      workspaceId: input.workspaceId,
      name,
      hash: hashTokenSecret(token),
      scopes: normalizeScopes(input.scopes),
      writePathPrefixes,
      expiresAt: input.expiresAt ?? null,
    });

    return { ...record, token };
  }

  async listMcpTokens(workspaceId: string): Promise<McpTokenRecord[]> {
    return this.#mcpTokens.listByWorkspace(workspaceId);
  }

  async revokeMcpToken(workspaceId: string, tokenId: string): Promise<void> {
    const revoked = await this.#mcpTokens.revoke(workspaceId, tokenId);
    if (!revoked) {
      throw ApiError.notFound(`MCP token not found: ${tokenId}`);
    }
  }

  async rotateMcpToken(workspaceId: string, tokenId: string): Promise<CreatedMcpToken> {
    const existing = await this.#mcpTokens.getById(workspaceId, tokenId);
    if (!existing) {
      throw ApiError.notFound(`MCP token not found: ${tokenId}`);
    }

    const token = generateMcpTokenSecret();
    const record = await this.#mcpTokens.create({
      workspaceId,
      name: existing.name,
      hash: hashTokenSecret(token),
      scopes: existing.scopes,
      writePathPrefixes: existing.writePathPrefixes,
      expiresAt: existing.expiresAt,
    });

    const revoked = await this.#mcpTokens.revoke(workspaceId, tokenId);
    if (!revoked) {
      await this.#mcpTokens.revoke(workspaceId, record.id);
      throw ApiError.notFound(`MCP token not found: ${tokenId}`);
    }

    return { ...record, token };
  }

  async createApiKey(input: CreateTokenInput): Promise<CreatedApiKey> {
    const name = input.name.trim();
    if (!name) {
      throw ApiError.validation('API key name is required.');
    }

    const writePathPrefixes = await this.#assertValidWritePathPrefixes(
      input.workspaceId,
      input.writePathPrefixes,
    );

    const key = generateApiKeySecret();
    const record = await this.#apiKeys.create({
      workspaceId: input.workspaceId,
      name,
      hash: hashTokenSecret(key),
      scopes: normalizeScopes(input.scopes),
      writePathPrefixes,
      expiresAt: input.expiresAt ?? null,
    });

    return { ...record, key };
  }

  async listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]> {
    return this.#apiKeys.listByWorkspace(workspaceId);
  }

  async revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
    const revoked = await this.#apiKeys.revoke(workspaceId, keyId);
    if (!revoked) {
      throw ApiError.notFound(`API key not found: ${keyId}`);
    }
  }

  async rotateApiKey(workspaceId: string, keyId: string): Promise<CreatedApiKey> {
    const existing = await this.#apiKeys.getById(workspaceId, keyId);
    if (!existing) {
      throw ApiError.notFound(`API key not found: ${keyId}`);
    }

    const key = generateApiKeySecret();
    const record = await this.#apiKeys.create({
      workspaceId,
      name: existing.name,
      hash: hashTokenSecret(key),
      scopes: existing.scopes,
      writePathPrefixes: existing.writePathPrefixes,
      expiresAt: existing.expiresAt,
    });

    const revoked = await this.#apiKeys.revoke(workspaceId, keyId);
    if (!revoked) {
      await this.#apiKeys.revoke(workspaceId, record.id);
      throw ApiError.notFound(`API key not found: ${keyId}`);
    }

    return { ...record, key };
  }

  async authenticateMcpBearer(plaintext: string): Promise<AuthenticatedToken | null> {
    const record = await this.#mcpTokens.findByHash(hashTokenSecret(plaintext));
    return record ? toAuthenticatedToken(record) : null;
  }

  async authenticateApiBearer(plaintext: string): Promise<AuthenticatedToken | null> {
    const record = await this.#apiKeys.findByHash(hashTokenSecret(plaintext));
    return record ? toAuthenticatedToken(record) : null;
  }
}
