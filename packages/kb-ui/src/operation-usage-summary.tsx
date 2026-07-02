import type { TraceOperationUsage } from './trace-types.js';

export type OperationUsageSummaryProps = {
  usage: TraceOperationUsage;
  className?: string;
};

export function OperationUsageSummary({ usage, className }: OperationUsageSummaryProps) {
  const tokenParts: string[] = [];
  if (usage.inputTokens !== undefined) {
    tokenParts.push(`${usage.inputTokens} in`);
  }
  if (usage.outputTokens !== undefined) {
    tokenParts.push(`${usage.outputTokens} out`);
  }

  return (
    <dl className={className ?? 'grid gap-1 text-xs text-muted-foreground sm:grid-cols-2'}>
      <div>
        <dt className="inline font-medium text-foreground">Operation </dt>
        <dd className="inline">{usage.operationType}</dd>
      </div>
      <div>
        <dt className="inline font-medium text-foreground">Model </dt>
        <dd className="inline">{usage.model}</dd>
      </div>
      {tokenParts.length > 0 ? (
        <div>
          <dt className="inline font-medium text-foreground">Tokens </dt>
          <dd className="inline">{tokenParts.join(' / ')}</dd>
        </div>
      ) : null}
      <div>
        <dt className="inline font-medium text-foreground">Latency </dt>
        <dd className="inline">{usage.latencyMs} ms</dd>
      </div>
      {usage.estimatedCost !== undefined ? (
        <div>
          <dt className="inline font-medium text-foreground">Est. cost </dt>
          <dd className="inline">
            {usage.estimatedCost}
            {usage.currency ? ` ${usage.currency}` : ''}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
