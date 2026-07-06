import type { AskResponseMode, CorpusAskRequest } from '@evu/kb-sdk';
import {
  AskPanel,
  buildKnowledgeFilters,
  emptySearchFilterDraft,
  useAskStream,
  useRankingStrategyOptions,
} from '@evu/kb-ui';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { renderCitationFileLink } from '../citation-links.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export function CorpusAskPage() {
  const { selectedSlug } = useWorkspace();
  const { corpusId } = useParams<{ corpusId: string }>();
  const [question, setQuestion] = useState('');
  const [responseMode, setResponseMode] = useState<AskResponseMode>('concise');
  const [filterDraft, setFilterDraft] = useState(emptySearchFilterDraft);
  const [rankingStrategyId, setRankingStrategyId] = useState('');
  const { strategies, embeddingConfigured } = useRankingStrategyOptions(
    kbClient,
    selectedSlug,
  );

  const askStream = useAskStream<CorpusAskRequest>({
    stream: (request) => kbClient.askStream(selectedSlug, corpusId ?? '', request),
    fallback: (request) => kbClient.ask(selectedSlug, corpusId ?? '', request),
  });

  const filters = useMemo(() => buildKnowledgeFilters(filterDraft), [filterDraft]);

  async function handleAsk(): Promise<void> {
    if (!corpusId || !question.trim()) {
      return;
    }

    await askStream.ask({
      question: question.trim(),
      responseMode,
      ...(filters ? { filters } : {}),
      ...(rankingStrategyId ? { rankingStrategyId } : {}),
    });
  }

  return (
    <section className="evukb-panel">
      <AskPanel
        embeddingConfigured={embeddingConfigured}
        error={askStream.error}
        filterDraft={filterDraft}
        loading={askStream.loading}
        onFilterDraftChange={setFilterDraft}
        onQuestionChange={setQuestion}
        onRankingStrategyIdChange={setRankingStrategyId}
        onResponseModeChange={setResponseMode}
        onSubmit={() => void handleAsk()}
        question={question}
        rankingStrategyId={rankingStrategyId}
        renderCitationFileLink={(citation) => renderCitationFileLink(citation, corpusId)}
        response={askStream.response}
        responseMode={responseMode}
        strategies={strategies}
      />
    </section>
  );
}
