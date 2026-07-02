import { GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  type DragEvent as ReactDragEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '../cn.js';
import { Input } from '../form.js';
import { Button } from '../primitives.js';
import { applyFrontmatterEntries, splitMarkdownFrontmatter } from './frontmatter-sync.js';

export type FrontmatterPanelProps = {
  markdown: string;
  onMarkdownChange: (value: string) => void;
  readOnly?: boolean;
  /** When false, omit the panel heading (e.g. inside a tabbed editor). */
  showHeading?: boolean;
};

type FrontmatterRow = {
  key: string;
  rowId: string;
  value: string;
};

const FRONTMATTER_ROW_DRAG_MIME = 'application/x-evukb-frontmatter-row';

function fieldsToRows(fields: Record<string, string>): FrontmatterRow[] {
  return Object.entries(fields).map(([key, value]) => ({
    rowId: key,
    key,
    value,
  }));
}

function createDraftRow(): FrontmatterRow {
  return {
    rowId: `draft-${crypto.randomUUID()}`,
    key: '',
    value: '',
  };
}

function rowsToEntries(rows: FrontmatterRow[]) {
  return rows.map(({ key, value }) => ({ key, value }));
}

function reorderRows(rows: FrontmatterRow[], fromIndex: number, toIndex: number): FrontmatterRow[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return rows;
  }
  const clampedTo = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clampedTo, 0, moved);
  return next;
}

export function FrontmatterPanel({
  markdown,
  onMarkdownChange,
  readOnly = false,
  showHeading = true,
}: FrontmatterPanelProps): ReactElement {
  const split = useMemo(() => splitMarkdownFrontmatter(markdown), [markdown]);
  const lastEmittedMarkdown = useRef(markdown);
  const [rows, setRows] = useState<FrontmatterRow[]>(() => fieldsToRows(split.fields));
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const columnCount = readOnly ? 2 : 4;

  useEffect(() => {
    if (markdown === lastEmittedMarkdown.current) {
      return;
    }
    setRows(fieldsToRows(splitMarkdownFrontmatter(markdown).fields));
    lastEmittedMarkdown.current = markdown;
  }, [markdown]);

  function commitRows(nextRows: FrontmatterRow[]): void {
    setRows(nextRows);
    const nextMarkdown = applyFrontmatterEntries(markdown, rowsToEntries(nextRows));
    lastEmittedMarkdown.current = nextMarkdown;
    onMarkdownChange(nextMarkdown);
  }

  function updateRow(rowId: string, patch: Partial<Pick<FrontmatterRow, 'key' | 'value'>>): void {
    commitRows(rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function removeRow(rowId: string): void {
    commitRows(rows.filter((row) => row.rowId !== rowId));
  }

  function addRow(): void {
    const nextRows = [...rows, createDraftRow()];
    setRows(nextRows);
  }

  function handleDragStart(rowId: string, index: number, event: ReactDragEvent): void {
    event.dataTransfer.setData(FRONTMATTER_ROW_DRAG_MIME, String(index));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingRowId(rowId);
  }

  function handleDragEnd(): void {
    setDraggingRowId(null);
    setDropTargetIndex(null);
  }

  function handleDragOver(index: number, event: ReactDragEvent): void {
    if (!event.dataTransfer.types.includes(FRONTMATTER_ROW_DRAG_MIME)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  }

  function handleDrop(index: number, event: ReactDragEvent): void {
    const rawIndex = event.dataTransfer.getData(FRONTMATTER_ROW_DRAG_MIME);
    if (!rawIndex) {
      return;
    }
    event.preventDefault();
    const fromIndex = Number.parseInt(rawIndex, 10);
    if (Number.isNaN(fromIndex)) {
      return;
    }
    commitRows(reorderRows(rows, fromIndex, index));
    handleDragEnd();
  }

  const panelClassName = showHeading
    ? 'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3'
    : 'flex min-w-0 flex-col gap-3';
  const PanelTag = showHeading ? 'aside' : 'div';
  const hasRows = rows.length > 0;

  return (
    <PanelTag className={panelClassName}>
      {showHeading ? (
        <div>
          <h3 className="text-sm font-medium">Frontmatter</h3>
          <p className="text-xs text-muted-foreground">
            Edit YAML metadata separately from the markdown body.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Edit YAML metadata separately from the markdown body.
        </p>
      )}
      <div className="min-w-0 overflow-hidden rounded-md border border-border">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {!readOnly ? <col style={{ width: '2.25rem' }} /> : null}
            <col style={{ width: '22%' }} />
            <col />
            {!readOnly ? <col style={{ width: '2.75rem' }} /> : null}
          </colgroup>
          <thead className="border-b border-border bg-muted/30 [&_tr]:border-border">
            <tr className="hover:bg-transparent">
              {!readOnly ? (
                <th
                  aria-hidden
                  className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                />
              ) : null}
              <th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Field name
              </th>
              <th className="h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Value
              </th>
              {!readOnly ? (
                <th
                  aria-hidden
                  className="h-10 px-2 text-right align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                />
              ) : null}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {hasRows ? (
              rows.map((row, index) => (
                <tr
                  key={row.rowId}
                  className={cn(
                    'border-b border-border transition-colors hover:bg-muted/50',
                    draggingRowId === row.rowId && 'opacity-50',
                    dropTargetIndex === index && 'bg-muted/60',
                  )}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => handleDragOver(index, event)}
                  onDrop={(event) => handleDrop(index, event)}
                >
                  {!readOnly ? (
                    <td className="px-2 py-2 align-middle">
                      <button
                        aria-label={`Reorder ${row.key || 'field'}`}
                        className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                        draggable
                        onDragStart={(event) => handleDragStart(row.rowId, index, event)}
                        type="button"
                      >
                        <GripVertical aria-hidden className="h-4 w-4" />
                      </button>
                    </td>
                  ) : null}
                  <td className="px-3 py-2 align-middle">
                    <Input
                      aria-label={`Field name for ${row.key || 'new field'}`}
                      className="min-w-0"
                      disabled={readOnly}
                      onChange={(event) => updateRow(row.rowId, { key: event.target.value })}
                      placeholder="field-name"
                      value={row.key}
                    />
                  </td>
                  <td className="min-w-0 px-3 py-2 align-middle">
                    <Input
                      aria-label={`Value for ${row.key || 'new field'}`}
                      className="min-w-0"
                      disabled={readOnly}
                      onChange={(event) => updateRow(row.rowId, { value: event.target.value })}
                      placeholder="value"
                      value={row.value}
                    />
                  </td>
                  {!readOnly ? (
                    <td className="px-2 py-2 text-right align-middle">
                      <Button
                        aria-label={`Remove ${row.key || 'field'}`}
                        className="h-8 w-8 p-0"
                        onClick={() => removeRow(row.rowId)}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr className="hover:bg-transparent">
                <td
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                  colSpan={columnCount}
                >
                  No frontmatter fields yet.
                </td>
              </tr>
            )}
            {!readOnly ? (
              <tr className="hover:bg-transparent">
                <td className="px-3 py-2 align-middle" colSpan={columnCount}>
                  <Button onClick={addRow} type="button" variant="outline">
                    <Plus aria-hidden className="h-4 w-4" />
                    Add field
                  </Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PanelTag>
  );
}
