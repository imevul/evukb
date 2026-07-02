import { Maximize2, Minimize2, TriangleAlert } from 'lucide-react';
import { lazy, type ReactElement, Suspense, useEffect, useMemo, useState } from 'react';

import { AppModal } from '../app-modal.js';
import { ConfirmModal } from '../confirm-modal.js';
import { tabClassName } from '../detail-tab-class.js';
import { Button } from '../primitives.js';
import type { CodeMirrorFileEditorProps } from './CodeMirrorFileEditor.js';
import { FrontmatterPanel } from './FrontmatterPanel.js';
import { mergeMarkdownFrontmatter, splitMarkdownFrontmatter } from './frontmatter-sync.js';

// CodeMirror is by far the heaviest dependency in the UI bundle; load it on
// demand so the main chunk stays small and the editor modal streams it in.
const LazyCodeMirrorFileEditor = lazy(() =>
  import('./CodeMirrorFileEditor.js').then((module) => ({
    default: module.CodeMirrorFileEditor,
  })),
);

function CodeMirrorFileEditor(props: CodeMirrorFileEditorProps): ReactElement {
  return (
    <Suspense fallback={<p className="evukb-muted">Loading editor…</p>}>
      <LazyCodeMirrorFileEditor {...props} />
    </Suspense>
  );
}

export type FileEditorModalProps = {
  dirty?: boolean;
  fileName: string;
  helperText?: string;
  loadPending?: boolean;
  onClose: () => void;
  onFixOkfFrontmatter?: () => void;
  onSave?: () => void;
  onTextChange: (value: string) => void;
  open: boolean;
  readOnly?: boolean;
  readOnlyReason?: string;
  savePending?: boolean;
  textValue: string;
  validationMessages?: string[];
};

type MarkdownEditorTab = 'content' | 'frontmatter' | 'preview' | 'raw';

const MARKDOWN_EDITOR_TABS: { id: MarkdownEditorTab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'frontmatter', label: 'Frontmatter' },
  { id: 'preview', label: 'Preview' },
  { id: 'raw', label: 'Raw' },
];

const LazyMarkdownPreviewPanel = lazy(() =>
  import('./MarkdownPreviewPanel.js').then((module) => ({
    default: module.MarkdownPreviewPanel,
  })),
);

type MarkdownTabbedEditorProps = {
  editorHeight: string;
  editorSaveProps: { onSave: () => void } | Record<string, never>;
  fileName: string;
  onTextChange: (value: string) => void;
  readOnly: boolean;
  split: ReturnType<typeof splitMarkdownFrontmatter>;
  textValue: string;
};

function MarkdownTabbedEditor({
  fileName,
  textValue,
  onTextChange,
  readOnly,
  split,
  editorHeight,
  editorSaveProps,
}: MarkdownTabbedEditorProps): ReactElement {
  const [activeTab, setActiveTab] = useState<MarkdownEditorTab>('content');

  function handleBodyChange(nextBody: string): void {
    onTextChange(mergeMarkdownFrontmatter(split.fields, nextBody));
  }

  return (
    <>
      <div
        aria-label="Editor view"
        className="mb-3 flex flex-wrap gap-6 border-b border-border"
        role="tablist"
      >
        {MARKDOWN_EDITOR_TABS.map((tab) => (
          <button
            key={tab.id}
            aria-selected={activeTab === tab.id}
            className={tabClassName(activeTab === tab.id)}
            id={`file-editor-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'content' ? (
        <div
          aria-labelledby="file-editor-tab-content"
          id="file-editor-panel-content"
          role="tabpanel"
        >
          <CodeMirrorFileEditor
            fileName={fileName}
            height={editorHeight}
            readOnly={readOnly}
            value={split.body}
            onChange={handleBodyChange}
            {...editorSaveProps}
          />
        </div>
      ) : null}
      {activeTab === 'frontmatter' ? (
        <div
          aria-labelledby="file-editor-tab-frontmatter"
          id="file-editor-panel-frontmatter"
          role="tabpanel"
        >
          <FrontmatterPanel
            markdown={textValue}
            onMarkdownChange={onTextChange}
            readOnly={readOnly}
            showHeading={false}
          />
        </div>
      ) : null}
      {activeTab === 'preview' ? (
        <div
          aria-labelledby="file-editor-tab-preview"
          id="file-editor-panel-preview"
          role="tabpanel"
        >
          <Suspense fallback={<p className="evukb-muted">Loading preview…</p>}>
            <LazyMarkdownPreviewPanel height={editorHeight} markdown={textValue} />
          </Suspense>
        </div>
      ) : null}
      {activeTab === 'raw' ? (
        <div aria-labelledby="file-editor-tab-raw" id="file-editor-panel-raw" role="tabpanel">
          <CodeMirrorFileEditor
            fileName={fileName}
            height={editorHeight}
            readOnly={readOnly}
            value={textValue}
            onChange={onTextChange}
            {...editorSaveProps}
          />
        </div>
      ) : null}
    </>
  );
}

const EDITOR_HEIGHT_REGULAR = '420px';
const EDITOR_HEIGHT_FULLSCREEN = 'calc(100dvh - 14rem)';

export function FileEditorModal({
  open,
  onClose,
  fileName,
  textValue,
  onTextChange,
  dirty = false,
  readOnly = false,
  readOnlyReason,
  onSave,
  savePending = false,
  loadPending = false,
  helperText,
  validationMessages,
  onFixOkfFrontmatter,
}: FileEditorModalProps): ReactElement {
  const [fullscreen, setFullscreen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setFullscreen(false);
      setDiscardConfirmOpen(false);
    }
  }, [open]);

  const tryClose = (): void => {
    if (!readOnly && dirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const uniqueValidationMessages = useMemo(() => {
    if (!validationMessages?.length) {
      return [];
    }
    return [...new Set(validationMessages)];
  }, [validationMessages]);

  const titlePrefix = readOnly ? 'View' : 'Edit';
  const title = fileName ? `${titlePrefix} ${fileName}` : `${titlePrefix} file`;
  const readOnlyBannerText =
    readOnlyReason ??
    (readOnly ? 'This file is read-only. You can view but not save changes.' : null);
  const showMarkdownTabs = fileName.toLowerCase().endsWith('.md');
  const split = useMemo(
    () => (showMarkdownTabs ? splitMarkdownFrontmatter(textValue) : null),
    [showMarkdownTabs, textValue],
  );
  const editorHeight = fullscreen ? EDITOR_HEIGHT_FULLSCREEN : EDITOR_HEIGHT_REGULAR;
  const editorSaveProps =
    onSave && !readOnly
      ? {
          onSave: () => {
            if (!dirty || savePending || loadPending) {
              return;
            }
            onSave();
          },
        }
      : {};

  function renderEditor(): ReactElement {
    if (showMarkdownTabs && split) {
      return (
        <MarkdownTabbedEditor
          key={fileName}
          editorHeight={editorHeight}
          editorSaveProps={editorSaveProps}
          fileName={fileName}
          onTextChange={onTextChange}
          readOnly={readOnly}
          split={split}
          textValue={textValue}
        />
      );
    }

    return (
      <CodeMirrorFileEditor
        fileName={fileName}
        height={editorHeight}
        readOnly={readOnly}
        value={textValue}
        onChange={onTextChange}
        {...editorSaveProps}
      />
    );
  }

  return (
    <>
      <AppModal
        footer={
          <>
            <Button onClick={tryClose} type="button" variant="outline">
              Close
            </Button>
            {onSave && !readOnly ? (
              <Button
                disabled={!dirty || savePending || loadPending}
                onClick={onSave}
                type="button"
                variant="primary"
              >
                {savePending ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
          </>
        }
        headerActions={
          <Button
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={fullscreen}
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => setFullscreen((value) => !value)}
            type="button"
            variant="ghost"
          >
            {fullscreen ? (
              <Minimize2 aria-hidden className="h-4 w-4" />
            ) : (
              <Maximize2 aria-hidden className="h-4 w-4" />
            )}
          </Button>
        }
        onClose={tryClose}
        open={open}
        size={fullscreen ? 'fullscreen' : 'xl'}
        title={title}
      >
        {loadPending ? <p className="evukb-muted">Loading file…</p> : null}
        {!loadPending ? (
          <>
            {uniqueValidationMessages.length > 0 ? (
              <div
                role="alert"
                className="mb-3 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5"
              >
                <TriangleAlert
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                    {uniqueValidationMessages.length === 1
                      ? 'Validation issue'
                      : `${uniqueValidationMessages.length} validation issues`}
                  </p>
                  <ul className="mt-1.5 space-y-2">
                    {uniqueValidationMessages.map((message) => (
                      <li
                        key={message}
                        className="border-l-2 border-amber-500/35 pl-2.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-amber-900/90 dark:text-amber-200/85"
                      >
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
                {onFixOkfFrontmatter && !readOnly ? (
                  <Button
                    className="shrink-0 self-center"
                    onClick={onFixOkfFrontmatter}
                    type="button"
                    variant="outline"
                  >
                    Add OKF fields
                  </Button>
                ) : null}
              </div>
            ) : null}
            {readOnly && readOnlyBannerText ? (
              <p
                className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
                role="note"
              >
                {readOnlyBannerText}
              </p>
            ) : null}
            {helperText ? <p className="mb-2 text-xs text-muted-foreground">{helperText}</p> : null}
            {renderEditor()}
          </>
        ) : null}
      </AppModal>

      <ConfirmModal
        confirmLabel="Discard changes"
        description="Unsaved edits in this file will be lost."
        onClose={() => setDiscardConfirmOpen(false)}
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onClose();
        }}
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
      />
    </>
  );
}
