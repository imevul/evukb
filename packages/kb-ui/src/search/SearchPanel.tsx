import type { RankingStrategySummary } from '@evu/kb-sdk';
import type { FormEvent, ReactNode } from 'react';

import type { WorkspaceCorpusOption } from '../hooks/useWorkspaceCorpora.js';
import { Button } from '../primitives.js';
import { CorpusMultiSelect } from './CorpusMultiSelect.js';
import { RankingStrategySelect } from './RankingStrategySelect.js';
import { SearchFiltersFieldset } from './SearchFiltersFieldset.js';
import type { SearchFilterDraft } from './search-filters.js';

export type SearchPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  filterDraft: SearchFilterDraft;
  onFilterDraftChange: (draft: SearchFilterDraft) => void;
  rankingStrategyId: string;
  onRankingStrategyIdChange: (value: string) => void;
  strategies: RankingStrategySummary[];
  embeddingConfigured: boolean;
  loading: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  layout?: 'corpus' | 'workspace';
  workspaceCorpora?: {
    availableCorpora: WorkspaceCorpusOption[];
    corpusIds: string[];
    onToggle: (corpusId: string) => void;
    setCorpusIds: (ids: string[]) => void;
  };
  leadingContent?: ReactNode;
};

export function SearchPanel({
  query,
  onQueryChange,
  filterDraft,
  onFilterDraftChange,
  rankingStrategyId,
  onRankingStrategyIdChange,
  strategies,
  embeddingConfigured,
  loading,
  disabled = false,
  onSubmit,
  layout = 'corpus',
  workspaceCorpora,
  leadingContent,
}: SearchPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  if (layout === 'corpus') {
    return (
      <form className="evukb-form evukb-search-form" onSubmit={handleSubmit}>
        <div className="evukb-search-form__toolbar">
          <label>
            Query
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} required />
          </label>
          <RankingStrategySelect
            embeddingConfigured={embeddingConfigured}
            onChange={onRankingStrategyIdChange}
            strategies={strategies}
            value={rankingStrategyId}
          />
          <Button disabled={loading || disabled} type="submit" variant="primary">
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </div>
        <SearchFiltersFieldset draft={filterDraft} onChange={onFilterDraftChange} />
      </form>
    );
  }

  return (
    <form className="evukb-form" onSubmit={handleSubmit}>
      {leadingContent}
      {workspaceCorpora ? (
        <CorpusMultiSelect
          availableCorpora={workspaceCorpora.availableCorpora}
          corpusIds={workspaceCorpora.corpusIds}
          onToggle={workspaceCorpora.onToggle}
          setCorpusIds={workspaceCorpora.setCorpusIds}
        />
      ) : null}
      <label>
        Query
        <input onChange={(event) => onQueryChange(event.target.value)} required value={query} />
      </label>
      <SearchFiltersFieldset draft={filterDraft} onChange={onFilterDraftChange} />
      <RankingStrategySelect
        embeddingConfigured={embeddingConfigured}
        onChange={onRankingStrategyIdChange}
        strategies={strategies}
        value={rankingStrategyId}
      />
      <Button disabled={loading || disabled} type="submit" variant="primary">
        {loading ? 'Searching…' : 'Search'}
      </Button>
    </form>
  );
}
