import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import type { StoredSecret } from '@evu/kb-db';

function resolveSecretsKey(): Buffer | null {
  const raw = process.env.EVUKB_SECRETS_KEY?.trim();
  if (!raw) {
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) {
    return decoded;
  }
  return createHash('sha256').update(raw).digest();
}

export function isSecretsKeyConfigured(): boolean {
  return resolveSecretsKey() !== null;
}

export function encryptSecretValue(plaintext: string): { ciphertext: Buffer; nonce: Buffer } {
  const key = resolveSecretsKey();
  if (!key) {
    throw new Error('EVUKB_SECRETS_KEY is not configured.');
  }

  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]),
    nonce,
  };
}

export function decryptStoredSecret(secret: StoredSecret): string | null {
  const key = resolveSecretsKey();
  if (!key) {
    return null;
  }

  try {
    const authTagLength = 16;
    if (secret.ciphertext.length <= authTagLength) {
      return null;
    }
    const authTag = secret.ciphertext.subarray(secret.ciphertext.length - authTagLength);
    const encrypted = secret.ciphertext.subarray(0, secret.ciphertext.length - authTagLength);
    const decipher = createDecipheriv('aes-256-gcm', key, secret.nonce);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    return null;
  }
}
