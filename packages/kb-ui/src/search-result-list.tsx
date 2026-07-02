import type { ReactNode } from 'react';

import { OperationUsageSummary } from './operation-usage-summary.js';
import type { TraceSearchRanking } from './trace-types.js';

export type SearchResultItem = {
  chunkId: string;
  corpusId?: string;
  filePath: string;
  headingPath: string[];
  bodyPreview: string;
  score: number;
  matchKind: string;
  corpusLabel?: string;
  ranking?: TraceSearchRanking;
};

export type SearchResultListProps = {
  results: SearchResultItem[];
  /** App-provided link to the corpus file editor (e.g. React Router deep link). */
  renderFileLink?: (result: SearchResultItem) => ReactNode;
};

function formatComponentScores(scores: Record<string, number>): string {
  return Object.entries(scores)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

export function SearchResultList({ results, renderFileLink }: SearchResultListProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-border">
      {results.map((result) => (
        <li key={result.chunkId} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
          <div className="text-sm text-muted-foreground">
            {renderFileLink && result.corpusId ? (
              renderFileLink(result)
            ) : (
              <strong className="text-foreground">{result.filePath}</strong>
            )}
            {result.corpusLabel ? <span>{` · ${result.corpusLabel}`}</span> : null}
            {result.headingPath.length > 0 ? (
              <span>{` — ${result.headingPath.join(' > ')}`}</span>
            ) : null}
            <span>{` · ${result.matchKind} · ${result.score.toFixed(3)}`}</span>
          </div>
          <p className="text-sm leading-relaxed">{result.bodyPreview}</p>
          {result.ranking ? (
            <details className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
              <summary className="cursor-pointer text-xs font-medium text-foreground">
                Ranking trace ({result.ranking.strategyId} v{result.ranking.strategyVersion})
              </summary>
              <div className="mt-2 space-y-2">
                {Object.keys(result.ranking.componentScores).length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatComponentScores(result.ranking.componentScores)}
                  </p>
                ) : null}
                {result.ranking.operationUsage ? (
                  <OperationUsageSummary usage={result.ranking.operationUsage} />
                ) : null}
              </div>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
