import type { SearchResult } from '@evu/kb-sdk';
import type { ReactNode } from 'react';
import { firstRerankUsage, mapOperationUsage } from '../ask/ask-trace.js';
import { EmptyState } from '../empty-state.js';
import { OperationUsageSummary } from '../operation-usage-summary.js';
import type { SearchResultItem } from '../search-result-list.js';
import { SearchResultList } from '../search-result-list.js';
import { resolvedSearchStrategyId } from './RankingStrategySelect.js';

export type SearchResultsSectionProps = {
  corpusNameById?: Map<string, string>;
  emptyHint?: string;
  error?: string | null;
  renderFileLink?: (result: SearchResultItem) => ReactNode;
  results: SearchResult[];
  searched: boolean;
  showCorpusLabels?: boolean;
};

function mapSearchResults(
  results: SearchResult[],
  showCorpusLabels: boolean,
  corpusNameById?: Map<string, string>,
): SearchResultItem[] {
  return results.map((result) => ({
    chunkId: result.chunkId,
    corpusId: result.corpusId,
    filePath: result.filePath,
    headingPath: result.headingPath,
    bodyPreview: result.bodyPreview,
    score: result.score,
    matchKind: result.matchKind,
    ranking: result.ranking,
    ...(showCorpusLabels
      ? { corpusLabel: corpusNameById?.get(result.corpusId) ?? result.corpusId }
      : {}),
  }));
}

export function SearchResultsSection({
  results,
  searched,
  error,
  emptyHint = 'Try different terms or reindex markdown files.',
  renderFileLink,
  showCorpusLabels = false,
  corpusNameById,
}: SearchResultsSectionProps) {
  const rerankUsage = searched ? mapOperationUsage(firstRerankUsage(results)) : undefined;

  return (
    <>
      {error ? <p className="evukb-error">{error}</p> : null}
      {searched && results.length === 0 && !error ? (
        <EmptyState title="No results" hint={emptyHint} />
      ) : null}
      {searched && results.length > 0 && resolvedSearchStrategyId(results) ? (
        <p className="evukb-muted">Ranking strategy: {resolvedSearchStrategyId(results)}</p>
      ) : null}
      {searched && rerankUsage ? (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="mb-2 text-sm font-medium">LLM rerank usage</p>
          <OperationUsageSummary usage={rerankUsage} />
        </div>
      ) : null}
      <SearchResultList
        results={mapSearchResults(results, showCorpusLabels, corpusNameById)}
        {...(renderFileLink ? { renderFileLink } : {})}
      />
    </>
  );
}
