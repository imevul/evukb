import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsService } from '../src/services/settings-service.js';

function createWorkspaceRepository(settings: Record<string, unknown>) {
  return {
    getById: vi.fn().mockResolvedValue({
      id: 'workspace-1',
      slug: 'local-dev',
      name: 'Local Development',
      settings,
    }),
    update: vi.fn(),
  };
}

describe('SettingsService AI providers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports workspace model/base URL overrides as not configured without env API keys', async () => {
    vi.stubEnv('EVUKB_EMBEDDING_API_KEY', '');
    vi.stubEnv('EVUKB_CHAT_API_KEY', '');

    const service = new SettingsService({
      workspaces: createWorkspaceRepository({
        aiProviders: {
          embedding: {
            model: 'text-embedding-3-small',
            baseUrl: 'https://api.openai.com/v1',
          },
          chat: {
            model: 'gpt-4o-mini',
            baseUrl: 'https://api.openai.com/v1',
          },
        },
      }) as never,
      embeddingProvider: null,
      chatProvider: null,
    });

    const providers = await service.getAiProviders('workspace-1');

    expect(providers.embedding).toMatchObject({
      configured: false,
      healthStatus: 'not-configured',
      source: 'database',
      baseUrl: 'https://api.openai.com/v1',
    });
    expect(providers.chat).toMatchObject({
      configured: false,
      healthStatus: 'not-configured',
      source: 'database',
      baseUrl: 'https://api.openai.com/v1',
    });
  });

  it('marks workspace overrides healthy when env API keys are present', async () => {
    vi.stubEnv('EVUKB_EMBEDDING_API_KEY', 'embedding-key');
    vi.stubEnv('EVUKB_CHAT_API_KEY', 'chat-key');

    const service = new SettingsService({
      workspaces: createWorkspaceRepository({
        aiProviders: {
          embedding: {
            model: 'custom-embedding',
            baseUrl: 'https://embedding.example/v1',
          },
          chat: {
            model: 'custom-chat',
            baseUrl: 'https://chat.example/v1',
          },
        },
      }) as never,
      embeddingProvider: null,
      chatProvider: null,
    });

    const providers = await service.getAiProviders('workspace-1');

    expect(providers.embedding).toMatchObject({
      model: 'custom-embedding',
      baseUrl: 'https://embedding.example/v1',
      configured: true,
      healthStatus: 'ok',
      source: 'database',
    });
    expect(providers.chat).toMatchObject({
      model: 'custom-chat',
      baseUrl: 'https://chat.example/v1',
      configured: true,
      healthStatus: 'ok',
      source: 'database',
    });
  });

  it('exposes effective embedding chunking settings with source metadata', async () => {
    vi.stubEnv('EVUKB_CHUNKING_STRATEGY', 'headings_subsplit');
    vi.stubEnv('EVUKB_CHUNK_MAX_TOKENS', '640');

    const service = new SettingsService({
      workspaces: createWorkspaceRepository({
        aiProviders: {
          embedding: {
            chunkingStrategy: 'headings_subsplit_capped',
            maxChunkTokens: 256,
          },
        },
      }) as never,
      embeddingProvider: null,
      chatProvider: null,
    });

    const providers = await service.getAiProviders('workspace-1');

    expect(providers.embedding.chunkingStrategy).toEqual({
      value: 'headings_subsplit_capped',
      source: 'database',
    });
    expect(providers.embedding.maxChunkTokens).toEqual({
      value: 256,
      source: 'database',
    });
  });

  it('falls back to env chunking settings when workspace values are unset', async () => {
    vi.stubEnv('EVUKB_CHUNKING_STRATEGY', 'headings_subsplit_capped');
    vi.stubEnv('EVUKB_CHUNK_MAX_TOKENS', '384');

    const service = new SettingsService({
      workspaces: createWorkspaceRepository({}) as never,
      embeddingProvider: null,
      chatProvider: null,
    });

    const providers = await service.getAiProviders('workspace-1');

    expect(providers.embedding.chunkingStrategy).toEqual({
      value: 'headings_subsplit_capped',
      source: 'env',
    });
    expect(providers.embedding.maxChunkTokens).toEqual({
      value: 384,
      source: 'env',
    });
  });
});
