import type { ChatProvider, EmbeddingProvider } from '@evu/kb-core';
import { parseAiProviderSettings } from '@evu/kb-core';

import { OpenAiChatProvider } from './openai-chat.js';
import { OpenAiEmbeddingProvider } from './openai-embedding.js';

export function resolveEmbeddingProviderForWorkspace(
  settings: Record<string, unknown>,
  fallback: EmbeddingProvider | null = null,
): EmbeddingProvider | null {
  const overrides = parseAiProviderSettings(settings).embedding;
  if (!overrides?.model && !overrides?.baseUrl) {
    return fallback;
  }

  return new OpenAiEmbeddingProvider({
    ...(overrides.model ? { model: overrides.model } : {}),
    ...(overrides.baseUrl ? { baseUrl: overrides.baseUrl } : {}),
  });
}

export function resolveChatProviderForWorkspace(
  settings: Record<string, unknown>,
  fallback: ChatProvider | null = null,
): ChatProvider | null {
  const overrides = parseAiProviderSettings(settings).chat;
  if (!overrides?.model && !overrides?.baseUrl) {
    return fallback;
  }

  return new OpenAiChatProvider({
    ...(overrides.model ? { model: overrides.model } : {}),
    ...(overrides.baseUrl ? { baseUrl: overrides.baseUrl } : {}),
  });
}
