import type { CitationItem } from '@evu/kb-ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { appRoutes } from './config.js';

const citationFileLinkClass = 'font-semibold text-primary hover:underline';

/** Only http(s) citation URLs may render as anchors (no javascript:/data: etc). */
export function isSafeCitationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Link to a corpus file in the file manager (`?file=` deep link). */
export function renderCorpusFileLink(corpusId: string, filePath: string): ReactNode {
  return (
    <Link className={citationFileLinkClass} to={appRoutes.corpusFiles(corpusId, filePath)}>
      {filePath}
    </Link>
  );
}

/** Link a citation to the corpus file editor (`?file=` deep link). */
export function renderCitationFileLink(citation: CitationItem, corpusId?: string): ReactNode {
  if (citation.sourceType === 'external-url' && citation.url) {
    if (!isSafeCitationUrl(citation.url)) {
      return <strong className="text-foreground">{citation.filePath}</strong>;
    }
    return (
      <a className={citationFileLinkClass} href={citation.url} rel="noreferrer" target="_blank">
        {citation.filePath}
      </a>
    );
  }

  const targetCorpusId = corpusId ?? citation.corpusId;
  if (!targetCorpusId) {
    return <strong className="text-foreground">{citation.filePath}</strong>;
  }

  return renderCorpusFileLink(targetCorpusId, citation.filePath);
}
