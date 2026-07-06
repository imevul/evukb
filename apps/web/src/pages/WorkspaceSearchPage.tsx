import type { SearchResult } from '@evu/kb-sdk';
import {
  buildKnowledgeFilters,
  EmptyState,
  emptySearchFilterDraft,
  PageHeader,
  SearchPanel,
  SearchResultsSection,
  useRankingStrategyOptions,
  useWorkspaceCorpora,
} from '@evu/kb-ui';
import { useMemo, useState } from 'react';

import { kbClient } from '../api/client.js';
import { renderCorpusFileLink } from '../citation-links.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export function WorkspaceSearchPage() {
  const { selectedSlug } = useWorkspace();
  const corpora = useWorkspaceCorpora(kbClient, selectedSlug);
  const [query, setQuery] = useState('');
  const [filterDraft, setFilterDraft] = useState(emptySearchFilterDraft);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankingStrategyId, setRankingStrategyId] = useState('');
  const { strategies, embeddingConfigured } = useRankingStrategyOptions(kbClient, selectedSlug);

  const corpusNameById = useMemo(
    () => new Map(corpora.availableCorpora.map((corpus) => [corpus.id, corpus.name])),
    [corpora.availableCorpora],
  );

  const filters = useMemo(() => buildKnowledgeFilters(filterDraft), [filterDraft]);

  async function handleSearch(): Promise<void> {
    if (!query.trim() || corpora.corpusIds.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const hits = await kbClient.searchWorkspace(selectedSlug, {
        query: query.trim(),
        corpusIds: corpora.corpusIds,
        ...(filters ? { filters } : {}),
        ...(rankingStrategyId ? { rankingStrategyId } : {}),
      });
      setResults(hits);
      setSearched(true);
    } catch (searchError: unknown) {
      setResults([]);
      setSearched(true);
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Search across corpora" />
      <section className="evukb-panel">
        {corpora.loading ? <p className="evukb-muted">Loading corpora…</p> : null}
        {corpora.error ? <p className="evukb-error">{corpora.error}</p> : null}
        {!corpora.loading && corpora.availableCorpora.length === 0 ? (
          <EmptyState title="No corpora available" hint="Create a corpus before searching." />
        ) : null}
        {!corpora.loading && corpora.availableCorpora.length > 0 ? (
          <SearchPanel
            disabled={corpora.corpusIds.length === 0}
            embeddingConfigured={embeddingConfigured}
            filterDraft={filterDraft}
            layout="workspace"
            loading={loading}
            onFilterDraftChange={setFilterDraft}
            onQueryChange={setQuery}
            onRankingStrategyIdChange={setRankingStrategyId}
            onSubmit={() => void handleSearch()}
            query={query}
            rankingStrategyId={rankingStrategyId}
            strategies={strategies}
            workspaceCorpora={{
              availableCorpora: corpora.availableCorpora,
              corpusIds: corpora.corpusIds,
              onToggle: corpora.toggleCorpus,
              setCorpusIds: corpora.setCorpusIds,
            }}
          />
        ) : null}
        <SearchResultsSection
          corpusNameById={corpusNameById}
          emptyHint="Try different terms or reindex markdown files in the selected corpora."
          error={error}
          renderFileLink={(result) =>
            result.corpusId
              ? renderCorpusFileLink(result.corpusId, result.filePath)
              : result.filePath
          }
          results={results}
          searched={searched}
          showCorpusLabels={corpora.corpusIds.length > 1}
        />
      </section>
    </>
  );
}
