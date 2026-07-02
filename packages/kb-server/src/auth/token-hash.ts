import { createHash, randomBytes } from 'node:crypto';

export function hashTokenSecret(plaintext: string): string {
  const pepper = process.env.EVUKB_TOKEN_PEPPER ?? '';
  return createHash('sha256').update(`${pepper}${plaintext}`).digest('hex');
}

export function generateMcpTokenSecret(): string {
  return `evukb_mcp_${randomBytes(32).toString('base64url')}`;
}

export function generateApiKeySecret(): string {
  return `evukb_api_${randomBytes(32).toString('base64url')}`;
}

export function isMcpTokenSecret(value: string): boolean {
  return value.startsWith('evukb_mcp_');
}

export function isApiKeySecret(value: string): boolean {
  return value.startsWith('evukb_api_');
}
