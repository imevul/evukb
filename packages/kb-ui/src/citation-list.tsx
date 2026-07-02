import type { ReactNode } from 'react';

export type CitationItem = {
  citationId: string;
  corpusId?: string;
  filePath: string;
  headingPath?: string[];
  chunkId?: string;
  sourceType?: string;
  url?: string;
};

export type CitationListProps = {
  citations: CitationItem[];
  /** App-provided link for the cited file (e.g. React Router `Link` to the file editor). */
  renderFileLink?: (citation: CitationItem) => ReactNode;
};

export function CitationList({ citations, renderFileLink }: CitationListProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-border">
      {citations.map((citation) => (
        <li
          key={citation.citationId}
          className="py-3 text-sm text-muted-foreground first:pt-0 last:pb-0"
        >
          {renderFileLink ? (
            renderFileLink(citation)
          ) : (
            <strong className="text-foreground">{citation.filePath}</strong>
          )}
          {citation.headingPath && citation.headingPath.length > 0 ? (
            <span>{` — ${citation.headingPath.join(' > ')}`}</span>
          ) : null}
          {citation.chunkId ? <span>{` (${citation.chunkId})`}</span> : null}
        </li>
      ))}
    </ul>
  );
}
