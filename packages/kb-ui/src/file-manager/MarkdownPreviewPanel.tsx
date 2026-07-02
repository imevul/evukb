import { type ReactElement, useMemo } from 'react';

import { renderObsidianMarkdown } from '../markdown-preview.js';

export type MarkdownPreviewPanelProps = {
  height: string;
  markdown: string;
};

export function MarkdownPreviewPanel({
  markdown,
  height,
}: MarkdownPreviewPanelProps): ReactElement {
  const html = useMemo(() => renderObsidianMarkdown(markdown), [markdown]);

  return (
    <div
      aria-label="Markdown preview"
      className="evukb-md-preview overflow-auto rounded-md border border-border bg-muted/20 px-4 py-3 text-sm leading-relaxed text-foreground"
      // HTML is sanitized in renderObsidianMarkdown before display.
      dangerouslySetInnerHTML={{ __html: html }}
      role="document"
      style={{ maxHeight: height, minHeight: height }}
    />
  );
}
