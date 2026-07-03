import { createRankingStrategyRegistry } from '@evu/kb-core';
import { describe, expect, it, vi } from 'vitest';

import type { EvuKbRuntime } from '../src/index.js';
import { handleAskTool, handleSearch } from '../src/services/kb-tool-handlers.js';

function createRuntime(overrides: {
  search?: ReturnType<typeof vi.fn>;
  askCorpora?: ReturnType<typeof vi.fn>;
}): EvuKbRuntime {
  return {
    rankingRegistry: createRankingStrategyRegistry(),
    searchService: {
      search: overrides.search ?? vi.fn().mockResolvedValue([]),
      searchAcrossCorpora: overrides.search ?? vi.fn().mockResolvedValue([]),
    },
    askService: {
      askCorpora:
        overrides.askCorpora ?? vi.fn().mockResolvedValue({ answer: 'ok', citations: [] }),
    },
  } as unknown as EvuKbRuntime;
}

describe('kb-tool-handlers ranking and filter pass-through', () => {
  it('forwards rankingStrategyId, rankingSettings, and v2 filters to search', async () => {
    const search = vi.fn().mockResolvedValue([]);
    const runtime = createRuntime({ search });

    const filters = {
      tags: ['ops'],
      pathAllowlist: ['docs/'],
      frontmatter: { status: 'active' },
      sourceTypes: ['managed' as const],
      indexStatus: ['indexed' as const],
    };

    await handleSearch(runtime, 'workspace-1', {
      action: 'search',
      corpusId: 'corpus-1',
      query: 'hello',
      filters,
      rankingStrategyId: 'recency_boosted',
      rankingSettings: { recencyBoost: 3 },
    });

    expect(search).toHaveBeenCalledWith('workspace-1', 'corpus-1', {
      query: 'hello',
      filters,
      rankingStrategyId: 'recency_boosted',
      rankingSettings: { recencyBoost: 3 },
    });
  });

  it('forwards rankingStrategyId and v2 filters to searchAcrossCorpora for multi-corpus search', async () => {
    const searchAcrossCorpora = vi.fn().mockResolvedValue([]);
    const runtime = createRuntime({ search: searchAcrossCorpora });

    const filters = { pathAllowlist: ['runbooks/'] };

    await handleSearch(runtime, 'workspace-1', {
      action: 'search',
      corpusIds: ['corpus-1', 'corpus-2'],
      query: 'hello',
      filters,
      rankingStrategyId: 'citation_boosted',
    });

    expect(searchAcrossCorpora).toHaveBeenCalledWith('workspace-1', ['corpus-1', 'corpus-2'], {
      query: 'hello',
      filters,
      rankingStrategyId: 'citation_boosted',
    });
  });

  it('forwards rankingStrategyId and v2 filters to askCorpora', async () => {
    const askCorpora = vi.fn().mockResolvedValue({ answer: 'ok', citations: [] });
    const runtime = createRuntime({ askCorpora });

    const filters = {
      tags: ['security'],
      indexStatus: ['indexed' as const],
    };

    await handleAskTool(runtime, 'workspace-1', {
      action: 'ask',
      corpusIds: ['corpus-1'],
      question: 'What is the policy?',
      filters,
      rankingStrategyId: 'keyword_only',
    });

    expect(askCorpora).toHaveBeenCalledWith('workspace-1', {
      question: 'What is the policy?',
      corpusIds: ['corpus-1'],
      filters,
      rankingStrategyId: 'keyword_only',
    });
  });

  it('rejects unknown rankingStrategyId on search', async () => {
    const runtime = createRuntime({});

    await expect(
      handleSearch(runtime, 'workspace-1', {
        action: 'search',
        corpusId: 'corpus-1',
        query: 'hello',
        rankingStrategyId: 'unknown_strategy',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unknown ranking strategy: unknown_strategy',
    });
  });

  it('rejects unknown rankingStrategyId on ask', async () => {
    const runtime = createRuntime({});

    await expect(
      handleAskTool(runtime, 'workspace-1', {
        action: 'ask',
        corpusIds: ['corpus-1'],
        question: 'hello',
        rankingStrategyId: 'unknown_strategy',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unknown ranking strategy: unknown_strategy',
    });
  });
});
