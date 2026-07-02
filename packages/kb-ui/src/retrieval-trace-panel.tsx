import { OperationUsageSummary } from './operation-usage-summary.js';
import type { TraceOperationUsage, TraceRetrievalTrace, TraceUsedChunk } from './trace-types.js';

export type RetrievalTracePanelProps = {
  trace: TraceRetrievalTrace;
  model?: string;
  usedChunks?: TraceUsedChunk[];
  operationUsage?: TraceOperationUsage;
  className?: string;
};

function formatComponentScores(scores: Record<string, number>): string {
  return Object.entries(scores)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

export function RetrievalTracePanel({
  trace,
  model,
  usedChunks,
  operationUsage,
  className,
}: RetrievalTracePanelProps) {
  return (
    <details className={className ?? 'rounded-lg border border-border bg-muted/30 px-3 py-2'}>
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Retrieval diagnostics
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline font-medium text-foreground">Query </dt>
            <dd className="inline">{trace.query}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Strategy </dt>
            <dd className="inline">{trace.strategyId}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Candidates </dt>
            <dd className="inline">{trace.candidateCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Selected </dt>
            <dd className="inline">{trace.selectedCount}</dd>
          </div>
          {trace.corpusCount !== undefined ? (
            <div>
              <dt className="inline font-medium text-foreground">Corpora </dt>
              <dd className="inline">{trace.corpusCount}</dd>
            </div>
          ) : null}
          {model ? (
            <div>
              <dt className="inline font-medium text-foreground">Model </dt>
              <dd className="inline">{model}</dd>
            </div>
          ) : null}
        </dl>
        {operationUsage ? (
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Provider usage</p>
            <OperationUsageSummary usage={operationUsage} />
          </div>
        ) : null}
        {usedChunks && usedChunks.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Context chunks</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {usedChunks.map((chunk) => (
                <li key={chunk.chunkId}>
                  <span className="text-foreground">{chunk.filePath}</span>
                  {` · score ${chunk.score.toFixed(3)}`}
                  {chunk.componentScores && Object.keys(chunk.componentScores).length > 0
                    ? ` · ${formatComponentScores(chunk.componentScores)}`
                    : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
