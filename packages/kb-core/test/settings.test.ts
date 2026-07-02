import { describe, expect, it } from 'vitest';

import {
  aiProviderSource,
  embeddingChunkingStrategySource,
  embeddingMaxChunkTokensSource,
  mergeAiProviderSettings,
  parseAiProviderSettings,
  resolveEmbeddingChunkingStrategyFromSettings,
  resolveMaxChunkTokensFromSettings,
  validateAiProviderSettings,
} from '../src/settings/ai-providers.js';
import { parseRankingSettings, validateRankingSettings } from '../src/settings/ranking.js';
import { resolveRankingStrategyIdSetting, resolveSetting } from '../src/settings/resolve.js';
import { isSyncDue, resolveSyncIntervalMinutes } from '../src/settings/schedule.js';
import { validateSyncSettings } from '../src/sync/settings.js';

describe('settings ranking', () => {
  it('parses and validates ranking settings', () => {
    const parsed = parseRankingSettings({
      rankingSettings: {
        keywordWeight: 0.5,
        semanticWeight: 1.2,
        pathBoosts: { '/docs': 2 },
      },
    });
    expect(parsed.keywordWeight).toBe(0.5);
    expect(parsed.pathBoosts).toEqual({ '/docs': 2 });
    expect(validateRankingSettings({ rankingSettings: parsed })).toBeNull();
    expect(validateRankingSettings({ rankingSettings: 'bad' })).toContain('object');
  });
});

describe('settings ai providers', () => {
  it('parses, merges, and validates ai provider overrides', () => {
    const parsed = parseAiProviderSettings({
      aiProviders: {
        embedding: { model: 'text-embedding-3-large' },
        chat: { baseUrl: 'https://example.com/v1' },
      },
    });
    expect(parsed.embedding?.model).toBe('text-embedding-3-large');
    expect(parsed.chat?.baseUrl).toBe('https://example.com/v1');
    expect(aiProviderSource({ aiProviders: parsed }, 'embedding')).toBe('database');
    expect(aiProviderSource({}, 'chat')).toBe('env');

    const merged = mergeAiProviderSettings(
      { aiProviders: { chat: { model: 'gpt-4o' } } },
      { embedding: { model: 'custom-embed' } },
    );
    expect(parseAiProviderSettings(merged).chat?.model).toBe('gpt-4o');
    expect(parseAiProviderSettings(merged).embedding?.model).toBe('custom-embed');

    const cleared = mergeAiProviderSettings(merged, { embedding: null });
    expect(parseAiProviderSettings(cleared).embedding).toBeUndefined();

    expect(validateAiProviderSettings({ embedding: { model: 'ok' } })).toBeNull();
    expect(validateAiProviderSettings({ embedding: null })).toBeNull();
    expect(validateAiProviderSettings({ embedding: { apiKey: 'secret' } })).toContain('API keys');
  });

  it('parses, validates, and resolves embedding chunking settings', () => {
    const parsed = parseAiProviderSettings({
      aiProviders: {
        embedding: {
          chunkingStrategy: 'headings_subsplit_capped',
          maxChunkTokens: 256,
        },
      },
    });
    expect(parsed.embedding?.chunkingStrategy).toBe('headings_subsplit_capped');
    expect(parsed.embedding?.maxChunkTokens).toBe(256);
    expect(embeddingChunkingStrategySource({ aiProviders: parsed })).toBe('database');
    expect(embeddingMaxChunkTokensSource({ aiProviders: parsed })).toBe('database');

    expect(
      validateAiProviderSettings({
        embedding: { chunkingStrategy: 'invalid' },
      }),
    ).toContain('chunkingStrategy');
    expect(
      validateAiProviderSettings({
        embedding: { maxChunkTokens: 10 },
      }),
    ).toContain('maxChunkTokens');
    expect(
      validateAiProviderSettings({
        chat: { chunkingStrategy: 'headings' },
      }),
    ).toContain('chat.chunkingStrategy');

    const merged = mergeAiProviderSettings(
      { aiProviders: { embedding: { model: 'embed-model' } } },
      { embedding: { chunkingStrategy: 'headings_subsplit', maxChunkTokens: 512 } },
    );
    expect(parseAiProviderSettings(merged).embedding).toMatchObject({
      model: 'embed-model',
      chunkingStrategy: 'headings_subsplit',
      maxChunkTokens: 512,
    });

    const env = {
      EVUKB_CHUNKING_STRATEGY: 'headings_subsplit_capped',
      EVUKB_CHUNK_MAX_TOKENS: '384',
    } as NodeJS.ProcessEnv;
    expect(resolveEmbeddingChunkingStrategyFromSettings({}, env)).toEqual({
      value: 'headings_subsplit_capped',
      source: 'env',
    });
    expect(resolveMaxChunkTokensFromSettings({}, env)).toEqual({
      value: 384,
      source: 'env',
    });
    expect(resolveEmbeddingChunkingStrategyFromSettings({}, {})).toEqual({
      value: 'headings',
      source: 'default',
    });
  });
});

describe('layered setting resolver', () => {
  it('applies request -> database -> env -> default precedence', () => {
    expect(
      resolveRankingStrategyIdSetting(
        {
          requestStrategyId: 'req_v1',
          corpusStrategyId: 'corpus_v1',
          workspaceSettings: { rankingStrategyId: 'ws_v1' },
          envStrategyId: 'env_v1',
        },
        'default_v1',
      ),
    ).toEqual({ value: 'req_v1', source: 'request' });

    expect(
      resolveRankingStrategyIdSetting(
        {
          corpusStrategyId: 'corpus_v1',
          workspaceSettings: { rankingStrategyId: 'ws_v1' },
          envStrategyId: 'env_v1',
        },
        'default_v1',
      ),
    ).toEqual({ value: 'corpus_v1', source: 'database' });

    expect(
      resolveRankingStrategyIdSetting(
        {
          workspaceSettings: { rankingStrategyId: 'ws_v1' },
          envStrategyId: 'env_v1',
        },
        'default_v1',
      ),
    ).toEqual({ value: 'ws_v1', source: 'database' });

    expect(resolveRankingStrategyIdSetting({ envStrategyId: 'env_v1' }, 'default_v1')).toEqual({
      value: 'env_v1',
      source: 'env',
    });

    expect(resolveRankingStrategyIdSetting({}, 'default_v1')).toEqual({
      value: 'default_v1',
      source: 'default',
    });
  });

  it('ignores blank layer values', () => {
    expect(
      resolveRankingStrategyIdSetting(
        { requestStrategyId: '  ', corpusStrategyId: null, envStrategyId: '' },
        'default_v1',
      ),
    ).toEqual({ value: 'default_v1', source: 'default' });
  });

  it('exposes the generic resolver for other settings', () => {
    expect(
      resolveSetting(
        [
          { source: 'request', value: undefined },
          { source: 'env', value: 'debug' },
        ],
        'info',
      ),
    ).toEqual({ value: 'debug', source: 'env' });
  });
});

describe('sync schedule', () => {
  it('resolves sync interval minutes', () => {
    expect(resolveSyncIntervalMinutes({ syncIntervalMinutes: 15 })).toBe(15);
    expect(resolveSyncIntervalMinutes({ syncIntervalMinutes: 0 })).toBeNull();
    expect(resolveSyncIntervalMinutes({})).toBeNull();
  });

  it('detects due sync corpora', () => {
    const now = Date.parse('2026-06-30T01:00:00.000Z');
    expect(
      isSyncDue(
        {
          importKind: 'mount',
          mountPath: '/data/vault',
          syncIntervalMinutes: 30,
          syncStatus: { lastSyncAt: '2026-06-30T00:00:00.000Z', lastSyncStatus: 'success' },
        },
        now,
      ),
    ).toBe(true);
    expect(
      isSyncDue(
        {
          importKind: 'mount',
          mountPath: '/data/vault',
          syncIntervalMinutes: 30,
          syncStatus: { lastSyncAt: '2026-06-30T00:45:00.000Z', lastSyncStatus: 'success' },
        },
        now,
      ),
    ).toBe(false);
    expect(
      isSyncDue(
        {
          importKind: 'mount',
          mountPath: '/data/vault',
          syncIntervalMinutes: 30,
          syncStatus: { lastSyncStatus: 'running' },
        },
        now,
      ),
    ).toBe(false);
  });

  it('validates sync interval on corpus settings', () => {
    expect(
      validateSyncSettings({
        importKind: 'git',
        gitRemoteUrl: 'https://example.com/repo.git',
        syncIntervalMinutes: 60,
      }),
    ).toBeNull();
    expect(
      validateSyncSettings({
        importKind: 'git',
        gitRemoteUrl: 'https://example.com/repo.git',
        syncIntervalMinutes: -1,
      }),
    ).toContain('syncIntervalMinutes');
  });
});
