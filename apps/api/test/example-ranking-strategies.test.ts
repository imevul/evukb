import { describe, expect, it } from 'vitest';
import { createExampleRankingStrategyRegistry } from '../../../examples/custom-ranking-strategy/src/register-dev.ts';
import { shouldRegisterExampleRankingStrategies } from '../src/example-ranking-strategies.js';

describe('example ranking strategies bootstrap', () => {
  it('registers by default outside production', () => {
    expect(shouldRegisterExampleRankingStrategies({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldRegisterExampleRankingStrategies({})).toBe(true);
  });

  it('honors explicit env overrides', () => {
    expect(
      shouldRegisterExampleRankingStrategies({
        NODE_ENV: 'development',
        EVUKB_REGISTER_EXAMPLE_RANKING_STRATEGIES: 'false',
      }),
    ).toBe(false);
    expect(
      shouldRegisterExampleRankingStrategies({
        NODE_ENV: 'production',
        EVUKB_REGISTER_EXAMPLE_RANKING_STRATEGIES: 'true',
      }),
    ).toBe(true);
  });

  it('does not register in production by default', () => {
    expect(shouldRegisterExampleRankingStrategies({ NODE_ENV: 'production' })).toBe(false);
  });

  it('loads both example strategies into the registry', () => {
    const registry = createExampleRankingStrategyRegistry();
    expect(registry.resolve('boost_agent_notes_v1').id).toBe('boost_agent_notes_v1');
    expect(registry.resolve('prefer_docs_prefix_v1').id).toBe('prefer_docs_prefix_v1');
    expect(registry.isBuiltin('boost_agent_notes_v1')).toBe(false);
  });
});
