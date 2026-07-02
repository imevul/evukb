import { markdown } from '@codemirror/lang-markdown';
import { search } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';

import { useColorScheme } from '../theme/ColorSchemeProvider.js';

export type CodeMirrorFileEditorProps = {
  className?: string;
  fileName: string;
  height?: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  value: string;
};

type EditorStatusBar = {
  column: number;
  indent: string;
  language: string;
  line: number;
  lineEnding: string;
  selectedChars: number;
};

function detectLineEnding(text: string): string {
  return text.includes('\r\n') ? 'CRLF' : 'LF';
}

function detectIndentKind(text: string): string {
  const sample = text.split('\n').find((line) => line.trim().length > 0);
  if (!sample) {
    return 'Spaces';
  }
  if (sample.startsWith('\t')) {
    return 'Tabs';
  }
  const match = sample.match(/^ +/);
  if (match && match[0].length >= 2) {
    return `Spaces (${match[0].length})`;
  }
  return 'Spaces';
}

function languageLabel(fileName: string): string {
  return fileName.toLowerCase().endsWith('.md') ? 'Markdown' : 'Plain text';
}

function statusFromView(view: EditorView, fileName: string, text: string): EditorStatusBar {
  const selection = view.state.selection.main;
  const line = view.state.doc.lineAt(selection.head);
  return {
    line: line.number,
    column: selection.head - line.from + 1,
    selectedChars: selection.empty ? 0 : Math.abs(selection.to - selection.from),
    lineEnding: detectLineEnding(text),
    indent: detectIndentKind(text),
    language: languageLabel(fileName),
  };
}

function statusFromFileMeta(
  value: string,
  fileName: string,
): Pick<EditorStatusBar, 'indent' | 'language' | 'lineEnding'> {
  return {
    lineEnding: detectLineEnding(value),
    indent: detectIndentKind(value),
    language: languageLabel(fileName),
  };
}

function editorStatusEqual(left: EditorStatusBar, right: EditorStatusBar): boolean {
  return (
    left.line === right.line &&
    left.column === right.column &&
    left.selectedChars === right.selectedChars &&
    left.lineEnding === right.lineEnding &&
    left.indent === right.indent &&
    left.language === right.language
  );
}

export function CodeMirrorFileEditor({
  fileName,
  value,
  onChange,
  onSave,
  readOnly = false,
  height = '360px',
  className,
}: CodeMirrorFileEditorProps): ReactElement {
  const { effective } = useColorScheme();
  const [status, setStatus] = useState<EditorStatusBar>(() => ({
    line: 1,
    column: 1,
    selectedChars: 0,
    lineEnding: detectLineEnding(value),
    indent: detectIndentKind(value),
    language: languageLabel(fileName),
  }));

  useEffect(() => {
    const nextMeta = statusFromFileMeta(value, fileName);
    setStatus((current) => {
      const next = { ...current, ...nextMeta };
      return editorStatusEqual(current, next) ? current : next;
    });
  }, [value, fileName]);

  useEffect(() => {
    if (!onSave) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSave]);

  const extensions = useMemo<Extension[]>(() => [markdown(), search({ top: true })], []);

  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      if (!update.selectionSet && !update.docChanged) {
        return;
      }
      const next = statusFromView(update.view, fileName, update.view.state.doc.toString());
      setStatus((current) => (editorStatusEqual(current, next) ? current : next));
    },
    [fileName],
  );

  const theme = useMemo(() => (effective === 'dark' ? 'dark' : 'light'), [effective]);

  return (
    <div className={className ? `evukb-cm-editor ${className}` : 'evukb-cm-editor'}>
      <CodeMirror
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
        }}
        editable={!readOnly}
        extensions={extensions}
        height={height}
        onChange={onChange}
        onUpdate={onUpdate}
        theme={theme}
        value={value}
      />
      <div className="evukb-cm-status" aria-live="polite">
        <span>
          Ln {status.line}, Col {status.column}
        </span>
        <span>{status.selectedChars > 0 ? `${status.selectedChars} selected` : '—'}</span>
        <span>{status.indent}</span>
        <span>{status.lineEnding}</span>
        <span>{status.language}</span>
      </div>
    </div>
  );
}
