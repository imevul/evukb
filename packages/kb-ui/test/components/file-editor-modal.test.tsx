// @vitest-environment jsdom

import './setup.js';

import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

// CodeMirror is lazy-loaded via dynamic import and does not run in jsdom;
// replace it with a plain textarea that keeps the same value/onChange contract.
vi.mock('../../src/file-manager/CodeMirrorFileEditor.js', () => ({
  CodeMirrorFileEditor: ({
    value,
    onChange,
    readOnly = false,
  }: {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="Code editor"
      onChange={(event) => onChange?.(event.target.value)}
      readOnly={readOnly}
      value={value}
    />
  ),
}));

import { FileEditorModal } from '../../src/file-manager/FileEditorModal.js';

async function findEditor(): Promise<HTMLTextAreaElement> {
  return (await screen.findByLabelText('Code editor')) as HTMLTextAreaElement;
}

function SaveHarness({ onSave }: { onSave: () => void }): ReactElement {
  const initial = 'hello';
  const [value, setValue] = useState(initial);
  return (
    <FileEditorModal
      dirty={value !== initial}
      fileName="notes.txt"
      onClose={vi.fn()}
      onSave={onSave}
      onTextChange={setValue}
      open
      textValue={value}
    />
  );
}

describe('FileEditorModal', () => {
  it('shows the suspense fallback, then the lazily loaded editor', async () => {
    render(
      <FileEditorModal
        fileName="notes.txt"
        onClose={vi.fn()}
        onTextChange={vi.fn()}
        open
        textValue="hello world"
      />,
    );

    expect(screen.getByText('Loading editor…')).toBeTruthy();

    const editor = await findEditor();
    expect(editor.value).toBe('hello world');
    expect(screen.getByText('Edit notes.txt')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('splits markdown files into Content and Raw tabs and keeps frontmatter on edit', async () => {
    const markdown = '---\ntitle: Example\n---\n\n# Heading\n\nBody text.\n';
    const onTextChange = vi.fn();
    render(
      <FileEditorModal
        fileName="notes/example.md"
        onClose={vi.fn()}
        onTextChange={onTextChange}
        open
        textValue={markdown}
      />,
    );

    const contentEditor = await findEditor();
    expect(contentEditor.value).toContain('# Heading');
    expect(contentEditor.value).not.toContain('title: Example');

    fireEvent.change(contentEditor, { target: { value: '# Heading\n\nUpdated body.\n' } });
    const merged = onTextChange.mock.calls.at(-1)?.[0] as string;
    expect(merged).toContain('title: Example');
    expect(merged).toContain('Updated body.');

    fireEvent.click(screen.getByRole('tab', { name: 'Raw' }));
    const rawEditor = await findEditor();
    expect(rawEditor.value).toContain('title: Example');
    expect(rawEditor.value).toContain('# Heading');
  });

  it('shows a read-only preview tab for markdown files', async () => {
    const markdown = '---\ntitle: Example\n---\n\n# Heading\n\nSee [[Other Note]].\n';
    render(
      <FileEditorModal
        fileName="notes/example.md"
        onClose={vi.fn()}
        onTextChange={vi.fn()}
        open
        textValue={markdown}
      />,
    );

    await findEditor();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    const preview = await screen.findByLabelText('Markdown preview');
    expect(preview.innerHTML).toContain('<h1');
    expect(preview.innerHTML).toContain('Heading');
    expect(preview.innerHTML).toContain('evukb-wikilink');
    expect(preview.innerHTML).toContain('Example');
  });

  it('enables Save only when dirty and calls onSave', async () => {
    const onSave = vi.fn();
    render(<SaveHarness onSave={onSave} />);

    const editor = await findEditor();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(editor, { target: { value: 'hello world' } });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before discarding unsaved changes', () => {
    const onClose = vi.fn();
    render(
      <FileEditorModal
        dirty
        fileName="notes.txt"
        onClose={onClose}
        onSave={vi.fn()}
        onTextChange={vi.fn()}
        open
        textValue="changed"
      />,
    );

    // The header X button is also named "Close"; target the footer button text.
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Close'));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately when there are no unsaved changes', () => {
    const onClose = vi.fn();
    render(
      <FileEditorModal
        fileName="notes.txt"
        onClose={onClose}
        onTextChange={vi.fn()}
        open
        textValue="unchanged"
      />,
    );

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  it('renders read-only mode with a reason banner and no Save button', async () => {
    render(
      <FileEditorModal
        fileName="notes.txt"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onTextChange={vi.fn()}
        open
        readOnly
        readOnlyReason="Managed by git sync."
        textValue="content"
      />,
    );

    expect(screen.getByText('View notes.txt')).toBeTruthy();
    expect(screen.getByText('Managed by git sync.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

    const editor = await findEditor();
    expect(editor.readOnly).toBe(true);
  });

  it('deduplicates validation messages and exposes the OKF fix action', () => {
    const onFixOkfFrontmatter = vi.fn();
    render(
      <FileEditorModal
        fileName="doc.md"
        onClose={vi.fn()}
        onFixOkfFrontmatter={onFixOkfFrontmatter}
        onTextChange={vi.fn()}
        open
        textValue="# Doc\n"
        validationMessages={['missing field: okf_type', 'missing field: okf_type']}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Validation issue');
    expect(screen.getAllByText('missing field: okf_type')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add OKF fields' }));
    expect(onFixOkfFrontmatter).toHaveBeenCalledTimes(1);
  });
});
