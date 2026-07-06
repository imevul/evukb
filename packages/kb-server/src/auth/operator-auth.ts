import { randomBytes, timingSafeEqual } from 'node:crypto';

import { isHttpAuthRequired } from './http-auth.js';

export function generateOperatorApiKeySecret(): string {
  return `evukb_ops_${randomBytes(32).toString('base64url')}`;
}

export function isOperatorApiKeySecret(value: string): boolean {
  return value.startsWith('evukb_ops_');
}

export function readOperatorApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.EVUKB_OPERATOR_API_KEY?.trim();
  return value || null;
}

export function isOperatorApiKeyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readOperatorApiKeyFromEnv(env) !== null;
}

export function isOperatorBearer(bearer: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = readOperatorApiKeyFromEnv(env);
  if (!configured) {
    return false;
  }
  const left = Buffer.from(bearer);
  const right = Buffer.from(configured);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export type OperatorBootstrapLogger = {
  info: (payload: Record<string, unknown>, message: string) => void;
};

/**
 * When auth is required and no operator key is configured, generate one for this
 * process and log it once so operators can persist it in .env.
 */
export function bootstrapOperatorApiKeyIfNeeded(
  env: NodeJS.ProcessEnv = process.env,
  logger?: OperatorBootstrapLogger,
): string | null {
  if (env.EVUKB_BOOTSTRAP_OPERATOR_API_KEY === 'false') {
    return readOperatorApiKeyFromEnv(env);
  }
  if (!isHttpAuthRequired(env)) {
    return readOperatorApiKeyFromEnv(env);
  }
  const existing = readOperatorApiKeyFromEnv(env);
  if (existing) {
    return existing;
  }

  const generated = generateOperatorApiKeySecret();
  env.EVUKB_OPERATOR_API_KEY = generated;
  const message = `EvuKB operator API key (add to .env as EVUKB_OPERATOR_API_KEY): ${generated}`;
  if (logger) {
    logger.info({ operatorApiKeyGenerated: true }, message);
  } else {
    console.info(message);
  }
  return generated;
}
