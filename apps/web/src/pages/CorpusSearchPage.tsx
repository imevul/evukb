import type { SearchResult } from '@evu/kb-sdk';
import {
  buildKnowledgeFilters,
  emptySearchFilterDraft,
  SearchPanel,
  SearchResultsSection,
  useRankingStrategyOptions,
} from '@evu/kb-ui';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { renderCorpusFileLink } from '../citation-links.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export function CorpusSearchPage() {
  const { selectedSlug } = useWorkspace();
  const { corpusId } = useParams<{ corpusId: string }>();
  const [query, setQuery] = useState('');
  const [filterDraft, setFilterDraft] = useState(emptySearchFilterDraft);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankingStrategyId, setRankingStrategyId] = useState('');
  const { strategies, embeddingConfigured } = useRankingStrategyOptions(kbClient, selectedSlug);

  const filters = useMemo(() => buildKnowledgeFilters(filterDraft), [filterDraft]);

  async function handleSearch(): Promise<void> {
    if (!corpusId || !query.trim()) {
      return;
    }

    setLoading(true);
    try {
      const hits = await kbClient.search(selectedSlug, corpusId, {
        query: query.trim(),
        ...(filters ? { filters } : {}),
        ...(rankingStrategyId ? { rankingStrategyId } : {}),
      });
      setResults(hits);
      setSearched(true);
      setError(null);
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="evukb-panel">
      <SearchPanel
        embeddingConfigured={embeddingConfigured}
        filterDraft={filterDraft}
        loading={loading}
        onFilterDraftChange={setFilterDraft}
        onQueryChange={setQuery}
        onRankingStrategyIdChange={setRankingStrategyId}
        onSubmit={() => void handleSearch()}
        query={query}
        rankingStrategyId={rankingStrategyId}
        strategies={strategies}
      />
      <SearchResultsSection
        error={error}
        renderFileLink={(result) =>
          result.corpusId ? renderCorpusFileLink(result.corpusId, result.filePath) : result.filePath
        }
        results={results}
        searched={searched}
      />
    </section>
  );
}
