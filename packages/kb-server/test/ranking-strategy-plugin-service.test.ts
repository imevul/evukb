import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPresetRankingStrategy,
  createRankingStrategyRegistry,
  defaultRankingStrategyId,
} from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';
import { clearExampleRankingStrategyCache } from '../src/search/load-example-ranking-strategies.js';
import { RankingStrategyPluginService } from '../src/services/ranking-strategy-plugin-service.js';

const exampleCustomStrategyPath = fileURLToPath(
  new URL(
    '../../../examples/custom-ranking-strategy/src/strategies/custom-prefer-docs-prefix.ts',
    import.meta.url,
  ),
);
const exampleStrategyAllowlist = path.dirname(path.dirname(exampleCustomStrategyPath));

describe('RankingStrategyPluginService', () => {
  it('registers preset strategies when reload is enabled', async () => {
    const previous = process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD;
    process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD = 'true';
    try {
      const rankingRegistry = createRankingStrategyRegistry();
      const workspaces = {
        getById: vi.fn().mockResolvedValue({
          id: 'ws-1',
          settings: { rankingStrategyId: 'boost_agent_notes_v1' },
        }),
        update: vi.fn().mockResolvedValue({}),
      };
      const corpora = {
        listByWorkspaceAndRankingStrategy: vi
          .fn()
          .mockResolvedValue([{ id: 'c-1', name: 'Notes corpus' }]),
        clearRankingStrategyForWorkspace: vi.fn().mockResolvedValue(1),
      };
      const auditLog = { record: vi.fn().mockResolvedValue(undefined) };
      const service = new RankingStrategyPluginService({
        rankingRegistry,
        workspaces: workspaces as never,
        corpora: corpora as never,
        auditLog: auditLog as never,
      });

      const summary = await service.registerStrategy(
        'ws-1',
        {
          preset: {
            id: 'boost_agent_notes_v1',
            version: '1',
            weights: { pathBoosts: { 'agent-notes/': 2 } },
          },
        },
        { kind: 'dev' },
      );

      expect(summary.id).toBe('boost_agent_notes_v1');
      expect(rankingRegistry.resolve('boost_agent_notes_v1').id).toBe('boost_agent_notes_v1');

      const result = await service.unregisterStrategy(
        'ws-1',
        'boost_agent_notes_v1',
        { confirm: true },
        { kind: 'dev' },
      );

      expect(result.remediatedCorpusCount).toBe(1);
      expect(result.workspaceRemediated).toBe(true);
      expect(workspaces.update).toHaveBeenCalledWith('ws-1', {
        settings: {
          rankingStrategyId: defaultRankingStrategyId,
        },
      });
      expect(() => rankingRegistry.resolve('boost_agent_notes_v1')).toThrow();
    } finally {
      if (previous === undefined) {
        delete process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD;
      } else {
        process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD = previous;
      }
    }
  });

  it('creates preset strategies via kb-core helper', () => {
    const strategy = createPresetRankingStrategy({
      id: 'example_v1',
      version: '1',
      weights: { recencyBoost: 3 },
    });
    expect(strategy.id).toBe('example_v1');
  });

  it('registers example custom strategy via importPath when allowlisted', async () => {
    const previousReload = process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD;
    const previousAllowlist = process.env.EVUKB_RANKING_PLUGIN_ALLOWLIST;
    process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD = 'true';
    process.env.EVUKB_RANKING_PLUGIN_ALLOWLIST = exampleStrategyAllowlist;
    try {
      const rankingRegistry = createRankingStrategyRegistry();
      const workspaces = { getById: vi.fn(), update: vi.fn() };
      const corpora = {
        listByWorkspaceAndRankingStrategy: vi.fn().mockResolvedValue([]),
        clearRankingStrategyForWorkspace: vi.fn(),
      };
      const auditLog = { record: vi.fn().mockResolvedValue(undefined) };
      const service = new RankingStrategyPluginService({
        rankingRegistry,
        workspaces: workspaces as never,
        corpora: corpora as never,
        auditLog: auditLog as never,
      });

      const summary = await service.registerStrategy(
        'ws-1',
        { importPath: exampleCustomStrategyPath },
        { kind: 'dev' },
      );

      expect(summary.id).toBe('prefer_docs_prefix_v1');
      expect(rankingRegistry.resolve('prefer_docs_prefix_v1').id).toBe('prefer_docs_prefix_v1');
    } finally {
      if (previousReload === undefined) {
        delete process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD;
      } else {
        process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD = previousReload;
      }
      if (previousAllowlist === undefined) {
        delete process.env.EVUKB_RANKING_PLUGIN_ALLOWLIST;
      } else {
        process.env.EVUKB_RANKING_PLUGIN_ALLOWLIST = previousAllowlist;
      }
    }
  });

  it('registers bundled example strategies by exampleId', async () => {
    const previousReload = process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD;
    process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD = 'true';
    clearExampleRankingStrategyCache();
    try {
      const rankingRegistry = createRankingStrategyRegistry();
      const workspaces = { getById: vi.fn(), update: vi.fn() };
      const corpora = {
        listByWorkspaceAndRankingStrategy: vi.fn().mockResolvedValue([]),
        clearRankingStrategyForWorkspace: vi.fn(),
      };
      const auditLog = { record: vi.fn().mockResolvedValue(undefined) };
      const service = new RankingStrategyPluginService({
        rankingRegistry,
        workspaces: workspaces as never,
        corpora: corpora as never,
        auditLog: auditLog as never,
      });

      const boostSummary = await service.registerStrategy(
        'ws-1',
        { exampleId: 'boost_agent_notes_v1' },
        { kind: 'dev' },
      );
      const docsSummary = await service.registerStrategy(
        'ws-1',
        { exampleId: 'prefer_docs_prefix_v1' },
        { kind: 'dev' },
      );

      expect(boostSummary.id).toBe('boost_agent_notes_v1');
      expect(docsSummary.id).toBe('prefer_docs_prefix_v1');
      expect(rankingRegistry.resolve('prefer_docs_prefix_v1').id).toBe('prefer_docs_prefix_v1');
    } finally {
      clearExampleRankingStrategyCache();
      if (previousReload === undefined) {
        delete process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD;
      } else {
        process.env.EVUKB_ENABLE_RANKING_PLUGIN_RELOAD = previousReload;
      }
    }
  });
});
