import type { AskResponse } from '@evu/kb-sdk';
import type { ReactNode } from 'react';

import { mapOperationUsage, mapUsedChunks } from '../ask/ask-trace.js';
import type { CitationItem } from '../citation-list.js';
import { CitationList } from '../citation-list.js';
import { EmptyState } from '../empty-state.js';
import { RetrievalTracePanel } from '../retrieval-trace-panel.js';
import { StatusPill } from '../shell.js';

export type AskResponseViewProps = {
  error?: string | null;
  loading?: boolean;
  renderCitationFileLink?: (citation: CitationItem) => ReactNode;
  response: AskResponse | null;
  showInitialEmpty?: boolean;
  initialEmptyHint?: string;
  initialEmptyTitle?: string;
};

export function AskResponseView({
  response,
  loading = false,
  error,
  renderCitationFileLink,
  showInitialEmpty = true,
  initialEmptyTitle = 'Ask a question',
  initialEmptyHint = 'Answers cite retrieved chunks from the knowledge base.',
}: AskResponseViewProps) {
  const askOperationUsage = response ? mapOperationUsage(response.operationUsage) : undefined;

  return (
    <>
      {error ? <p className="evukb-error">{error}</p> : null}
      {!response && !error && showInitialEmpty ? (
        <EmptyState title={initialEmptyTitle} hint={initialEmptyHint} />
      ) : null}
      {response ? (
        <article className="evukb-ask-response">
          <h2 className="text-base font-semibold">Answer</h2>
          <p>{response.answer || (loading ? 'Generating answer…' : '')}</p>
          {response.warnings.length > 0 ? (
            <div className="evukb-warnings">
              {response.warnings.map((warning) => (
                <p key={warning}>
                  <StatusPill tone="warning">{warning}</StatusPill>
                </p>
              ))}
            </div>
          ) : null}
          <h2 className="text-base font-semibold">Citations</h2>
          <CitationList
            citations={response.citations.map((citation) => ({
              citationId: citation.citationId,
              corpusId: citation.corpusId,
              filePath: citation.filePath,
              sourceType: citation.sourceType,
              ...(citation.url ? { url: citation.url } : {}),
              ...(citation.headingPath ? { headingPath: citation.headingPath } : {}),
              ...(citation.chunkId ? { chunkId: citation.chunkId } : {}),
            }))}
            {...(renderCitationFileLink ? { renderFileLink: renderCitationFileLink } : {})}
          />
          <RetrievalTracePanel
            className="mt-4"
            model={response.model}
            trace={response.retrievalTrace}
            usedChunks={mapUsedChunks(response.usedChunks)}
            {...(askOperationUsage ? { operationUsage: askOperationUsage } : {})}
          />
        </article>
      ) : null}
    </>
  );
}
