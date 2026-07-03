import type { RankingStrategySummary } from '@evu/kb-sdk';

function strategyRequiresEmbedding(strategy: RankingStrategySummary): boolean {
  return strategy.requiresEmbedding === true;
}

function strategyLabel(strategy: RankingStrategySummary): string {
  return strategy.label ?? strategy.id;
}

export type RankingStrategySelectProps = {
  value: string;
  onChange: (value: string) => void;
  strategies: RankingStrategySummary[];
  embeddingConfigured?: boolean;
  disabled?: boolean;
};

export function RankingStrategySelect({
  value,
  onChange,
  strategies,
  embeddingConfigured = true,
  disabled = false,
}: RankingStrategySelectProps) {
  return (
    <label>
      Ranking strategy
      <select disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Inherit (corpus / workspace default)</option>
        {strategies.map((strategy) => (
          <option
            disabled={strategyRequiresEmbedding(strategy) && !embeddingConfigured}
            key={strategy.id}
            value={strategy.id}
          >
            {strategyLabel(strategy)} (v{strategy.version})
          </option>
        ))}
      </select>
    </label>
  );
}

export function resolvedSearchStrategyId(
  results: Array<{ ranking?: { strategyId: string } }>,
): string | null {
  return results[0]?.ranking?.strategyId ?? null;
}
