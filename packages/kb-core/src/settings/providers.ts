import type { EffectiveProviderConfig } from './types.js';

export function redactBaseUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) {
    return null;
  }
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

export function buildProviderConfig(input: {
  providerId: string;
  model: string;
  baseUrl?: string | null;
  configured: boolean;
  health: { status: string; message?: string };
}): EffectiveProviderConfig {
  return {
    providerId: input.providerId,
    model: input.model,
    baseUrl: redactBaseUrl(input.baseUrl ?? null),
    configured: input.configured,
    healthStatus:
      input.health.status === 'ok'
        ? 'ok'
        : input.health.status === 'not-configured'
          ? 'not-configured'
          : 'error',
    ...(input.health.message ? { healthMessage: input.health.message } : {}),
  };
}
