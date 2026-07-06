import { describe, expect, it } from 'vitest';

import {
  bootstrapOperatorApiKeyIfNeeded,
  generateOperatorApiKeySecret,
  isOperatorApiKeyConfigured,
  isOperatorBearer,
} from '../src/auth/operator-auth.js';

describe('operator auth', () => {
  it('generates evukb_ops_ prefixed secrets', () => {
    const secret = generateOperatorApiKeySecret();
    expect(secret.startsWith('evukb_ops_')).toBe(true);
  });

  it('matches configured operator bearer with constant-time compare', () => {
    const env = { EVUKB_OPERATOR_API_KEY: 'evukb_ops_test' };
    expect(isOperatorBearer('evukb_ops_test', env)).toBe(true);
    expect(isOperatorBearer('evukb_ops_other', env)).toBe(false);
  });

  it('bootstraps operator key when auth is required and unset', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    const messages: string[] = [];
    const generated = bootstrapOperatorApiKeyIfNeeded(env, {
      info: (_payload, message) => {
        messages.push(message);
      },
    });
    expect(generated).toMatch(/^evukb_ops_/);
    expect(env.EVUKB_OPERATOR_API_KEY).toBe(generated);
    expect(messages).toHaveLength(1);
    expect(isOperatorApiKeyConfigured(env)).toBe(true);
  });

  it('does not regenerate when operator key is already configured', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      EVUKB_OPERATOR_API_KEY: 'evukb_ops_existing',
    };
    const messages: string[] = [];
    expect(
      bootstrapOperatorApiKeyIfNeeded(env, {
        info: (_payload, message) => {
          messages.push(message);
        },
      }),
    ).toBe('evukb_ops_existing');
    expect(messages).toHaveLength(0);
  });

  it('skips bootstrap when opt-out is set', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      EVUKB_BOOTSTRAP_OPERATOR_API_KEY: 'false',
    };
    expect(bootstrapOperatorApiKeyIfNeeded(env)).toBeNull();
  });
});
