import { describe, expect, it } from 'vitest';

import {
  decryptStoredSecret,
  encryptSecretValue,
  isSecretsKeyConfigured,
} from '../src/auth/secret-crypto.js';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('secret crypto', () => {
  it('encrypts and decrypts round-trip when key is configured', () => {
    const previous = process.env.EVUKB_SECRETS_KEY;
    process.env.EVUKB_SECRETS_KEY = TEST_KEY;
    try {
      expect(isSecretsKeyConfigured()).toBe(true);
      const encrypted = encryptSecretValue('pat-token-value');
      const decrypted = decryptStoredSecret({
        id: 'secret-id',
        workspaceId: 'workspace-id',
        name: 'git-token',
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        createdAt: new Date().toISOString(),
      });
      expect(decrypted).toBe('pat-token-value');
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_SECRETS_KEY;
      } else {
        process.env.EVUKB_SECRETS_KEY = previous;
      }
    }
  });

  it('fails closed when secrets key is missing', () => {
    const previous = process.env.EVUKB_SECRETS_KEY;
    delete process.env.EVUKB_SECRETS_KEY;
    try {
      expect(isSecretsKeyConfigured()).toBe(false);
      expect(() => encryptSecretValue('value')).toThrow(/EVUKB_SECRETS_KEY/);
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_SECRETS_KEY;
      } else {
        process.env.EVUKB_SECRETS_KEY = previous;
      }
    }
  });
});
