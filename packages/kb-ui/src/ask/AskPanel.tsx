import type { AskResponse, AskResponseMode, RankingStrategySummary } from '@evu/kb-sdk';
import type { FormEvent, ReactNode } from 'react';
import type { CitationItem } from '../citation-list.js';

import type { WorkspaceCorpusOption } from '../hooks/useWorkspaceCorpora.js';
import { Button } from '../primitives.js';
import { CorpusMultiSelect } from '../search/CorpusMultiSelect.js';
import { RankingStrategySelect } from '../search/RankingStrategySelect.js';
import { SearchFiltersFieldset } from '../search/SearchFiltersFieldset.js';
import type { SearchFilterDraft } from '../search/search-filters.js';
import { AskResponseView } from './AskResponseView.js';

export type AskPanelProps = {
  question: string;
  onQuestionChange: (value: string) => void;
  responseMode: AskResponseMode;
  onResponseModeChange: (mode: AskResponseMode) => void;
  filterDraft: SearchFilterDraft;
  onFilterDraftChange: (draft: SearchFilterDraft) => void;
  rankingStrategyId: string;
  onRankingStrategyIdChange: (value: string) => void;
  strategies: RankingStrategySummary[];
  embeddingConfigured: boolean;
  loading: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  response: AskResponse | null;
  error?: string | null;
  layout?: 'corpus' | 'workspace';
  workspaceCorpora?: {
    availableCorpora: WorkspaceCorpusOption[];
    corpusIds: string[];
    onToggle: (corpusId: string) => void;
    setCorpusIds: (ids: string[]) => void;
  };
  leadingContent?: ReactNode;
  renderCitationFileLink?: (citation: CitationItem) => ReactNode;
  showInitialEmpty?: boolean;
  initialEmptyHint?: string;
};

export function AskPanel({
  question,
  onQuestionChange,
  responseMode,
  onResponseModeChange,
  filterDraft,
  onFilterDraftChange,
  rankingStrategyId,
  onRankingStrategyIdChange,
  strategies,
  embeddingConfigured,
  loading,
  disabled = false,
  onSubmit,
  response,
  error,
  layout = 'corpus',
  workspaceCorpora,
  leadingContent,
  renderCitationFileLink,
  showInitialEmpty = true,
  initialEmptyHint,
}: AskPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <form className="evukb-form" onSubmit={handleSubmit}>
        {leadingContent}
        {layout === 'workspace' && workspaceCorpora ? (
          <CorpusMultiSelect
            availableCorpora={workspaceCorpora.availableCorpora}
            corpusIds={workspaceCorpora.corpusIds}
            onToggle={workspaceCorpora.onToggle}
            setCorpusIds={workspaceCorpora.setCorpusIds}
          />
        ) : null}
        <label>
          Response mode
          <select
            onChange={(event) => onResponseModeChange(event.target.value as AskResponseMode)}
            value={responseMode}
          >
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
            <option value="extractive">Extractive</option>
          </select>
        </label>
        <label>
          Question
          <textarea
            onChange={(event) => onQuestionChange(event.target.value)}
            required
            rows={4}
            value={question}
          />
        </label>
        <SearchFiltersFieldset draft={filterDraft} onChange={onFilterDraftChange} />
        <RankingStrategySelect
          embeddingConfigured={embeddingConfigured}
          onChange={onRankingStrategyIdChange}
          strategies={strategies}
          value={rankingStrategyId}
        />
        <Button disabled={loading || disabled} type="submit" variant="primary">
          {loading ? 'Asking…' : 'Ask'}
        </Button>
      </form>
      <AskResponseView
        {...(error !== undefined ? { error } : {})}
        {...(renderCitationFileLink ? { renderCitationFileLink } : {})}
        initialEmptyHint={
          initialEmptyHint ??
          (layout === 'corpus'
            ? 'Answers cite retrieved chunks from this corpus.'
            : 'Answers cite retrieved chunks from the selected corpora.')
        }
        loading={loading}
        response={response}
        showInitialEmpty={showInitialEmpty}
      />
    </>
  );
}
