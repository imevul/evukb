import type { AskResponseMode, WorkspaceAskRequest } from '@evu/kb-sdk';
import {
  AskPanel,
  buildKnowledgeFilters,
  EmptyState,
  emptySearchFilterDraft,
  PageHeader,
  useAskStream,
  useRankingStrategyOptions,
  useWorkspaceCorpora,
} from '@evu/kb-ui';
import { useMemo, useState } from 'react';

import { kbClient } from '../api/client.js';
import { renderCitationFileLink } from '../citation-links.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export function WorkspaceAskPage() {
  const { selectedSlug } = useWorkspace();
  const corpora = useWorkspaceCorpora(kbClient, selectedSlug);
  const [question, setQuestion] = useState('');
  const [responseMode, setResponseMode] = useState<AskResponseMode>('concise');
  const [filterDraft, setFilterDraft] = useState(emptySearchFilterDraft);
  const [rankingStrategyId, setRankingStrategyId] = useState('');
  const { strategies, embeddingConfigured } = useRankingStrategyOptions(kbClient, selectedSlug);

  const askStream = useAskStream<WorkspaceAskRequest>({
    stream: (request) => kbClient.askWorkspaceStream(selectedSlug, request),
    fallback: (request) => kbClient.askWorkspace(selectedSlug, request),
  });

  const filters = useMemo(() => buildKnowledgeFilters(filterDraft), [filterDraft]);

  async function handleAsk(): Promise<void> {
    if (!question.trim() || corpora.corpusIds.length === 0) {
      return;
    }

    await askStream.ask({
      question: question.trim(),
      corpusIds: corpora.corpusIds,
      responseMode,
      ...(filters ? { filters } : {}),
      ...(rankingStrategyId ? { rankingStrategyId } : {}),
    });
  }

  return (
    <>
      <PageHeader title="Ask across corpora" />
      <section className="evukb-panel">
        {corpora.loading ? <p className="evukb-muted">Loading corpora…</p> : null}
        {corpora.error ? <p className="evukb-error">{corpora.error}</p> : null}
        {!corpora.loading && corpora.availableCorpora.length === 0 ? (
          <EmptyState
            title="No corpora available"
            hint="Create a corpus before asking questions."
          />
        ) : null}
        {!corpora.loading && corpora.availableCorpora.length > 0 ? (
          <AskPanel
            disabled={corpora.corpusIds.length === 0}
            embeddingConfigured={embeddingConfigured}
            error={askStream.error}
            filterDraft={filterDraft}
            layout="workspace"
            loading={askStream.loading}
            onFilterDraftChange={setFilterDraft}
            onQuestionChange={setQuestion}
            onRankingStrategyIdChange={setRankingStrategyId}
            onResponseModeChange={setResponseMode}
            onSubmit={() => void handleAsk()}
            question={question}
            rankingStrategyId={rankingStrategyId}
            renderCitationFileLink={renderCitationFileLink}
            response={askStream.response}
            responseMode={responseMode}
            showInitialEmpty={false}
            strategies={strategies}
            workspaceCorpora={{
              availableCorpora: corpora.availableCorpora,
              corpusIds: corpora.corpusIds,
              onToggle: corpora.toggleCorpus,
              setCorpusIds: corpora.setCorpusIds,
            }}
          />
        ) : null}
      </section>
    </>
  );
}
