import type { CreatedSecret, SecretRecord } from '@evu/kb-core';
import type { SecretRepository } from '@evu/kb-db';

import { encryptSecretValue } from '../auth/secret-crypto.js';
import { ApiError } from '../errors.js';

export type SecretServiceDeps = {
  secrets: SecretRepository;
};

export class SecretService {
  readonly #secrets: SecretRepository;

  constructor(deps: SecretServiceDeps) {
    this.#secrets = deps.secrets;
  }

  async listSecrets(workspaceId: string): Promise<SecretRecord[]> {
    return this.#secrets.listByWorkspace(workspaceId);
  }

  async createSecret(
    workspaceId: string,
    input: { name: string; value: string },
  ): Promise<CreatedSecret> {
    const name = input.name.trim();
    if (!name) {
      throw ApiError.validation('Secret name is required.');
    }
    if (!input.value) {
      throw ApiError.validation('Secret value is required.');
    }

    const existing = await this.#secrets.getByName(workspaceId, name);
    if (existing) {
      throw ApiError.conflict(`Secret already exists: ${name}`);
    }

    let encrypted: { ciphertext: Buffer; nonce: Buffer };
    try {
      encrypted = encryptSecretValue(input.value);
    } catch {
      throw ApiError.serviceUnavailable(
        'Secrets storage is unavailable: EVUKB_SECRETS_KEY is not configured.',
      );
    }

    const created = await this.#secrets.create({
      workspaceId,
      name,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
    });

    return {
      ...created,
      value: input.value,
    };
  }

  async deleteSecret(workspaceId: string, secretId: string): Promise<void> {
    const deleted = await this.#secrets.delete(workspaceId, secretId);
    if (!deleted) {
      throw ApiError.notFound(`Secret not found: ${secretId}`);
    }
  }

  async rotateSecret(
    workspaceId: string,
    secretId: string,
    input: { value: string },
  ): Promise<SecretRecord> {
    if (!input.value) {
      throw ApiError.validation('Secret value is required.');
    }

    let encrypted: { ciphertext: Buffer; nonce: Buffer };
    try {
      encrypted = encryptSecretValue(input.value);
    } catch {
      throw ApiError.serviceUnavailable(
        'Secrets storage is unavailable: EVUKB_SECRETS_KEY is not configured.',
      );
    }

    const updated = await this.#secrets.update(workspaceId, secretId, {
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
    });
    if (!updated) {
      throw ApiError.notFound(`Secret not found: ${secretId}`);
    }

    return updated;
  }
}
