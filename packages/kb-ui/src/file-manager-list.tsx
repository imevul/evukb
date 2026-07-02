import { RefreshCw } from 'lucide-react';
import type {
  DragEvent as ReactDragEvent,
  ReactElement,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';

import { cn } from './cn.js';
import type { FileTreeBreadcrumb, FileTreeListEntry, FileTreeNode } from './file-manager-types.js';
import { FILE_TREE_NODE_DRAG_MIME } from './file-manager-types.js';
import { formatFileTreeBytes } from './file-manager-utils.js';
import { Button } from './primitives.js';

export type FileManagerListProps = {
  breadcrumbs: FileTreeBreadcrumb[];
  cutIds?: string[] | null;
  dragMimeType?: string;
  dropTargetFolderId?: string | null;
  emptyMessage?: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  listEntries: FileTreeListEntry[];
  onDragStart: (nodeId: string, event: ReactDragEvent) => void;
  onFolderDragLeave: (folderId: string) => void;
  onFolderDragOver: (folderId: string, event: ReactDragEvent) => void;
  onFolderDrop: (folderId: string, event: ReactDragEvent) => void;
  onGoUp: () => void;
  onNavigate: (parentId: string | null) => void;
  onNodeContextMenu: (nodeId: string, x: number, y: number) => void;
  onPaneClick: () => void;
  onPaneContextMenu: (x: number, y: number) => void;
  onPaneDragOver: (event: ReactDragEvent) => void;
  onPaneDrop: (event: ReactDragEvent) => void;
  onRefresh?: () => void;
  onRowClick: (entry: FileTreeListEntry, event: ReactMouseEvent) => void;
  onRowDoubleClick: (entry: FileTreeListEntry) => void;
  renderStatusBadge?: (node: FileTreeNode) => ReactNode;
  selectedIds: Set<string>;
};

const rowGridClass =
  'grid grid-cols-[1.25rem_minmax(0,1fr)_5rem_minmax(6rem,auto)] items-center gap-x-2';

export function FileManagerList({
  breadcrumbs,
  listEntries,
  selectedIds,
  cutIds,
  dropTargetFolderId,
  isLoading = false,
  isRefreshing = false,
  emptyMessage = 'This folder is empty.',
  onNavigate,
  onGoUp,
  onRowClick,
  onRowDoubleClick,
  onNodeContextMenu,
  onPaneContextMenu,
  onPaneClick,
  onDragStart,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  onPaneDragOver,
  onPaneDrop,
  renderStatusBadge,
  dragMimeType = FILE_TREE_NODE_DRAG_MIME,
  onRefresh,
}: FileManagerListProps): ReactElement {
  const cutSet = new Set(cutIds ?? []);

  const trailingCells = (node: FileTreeNode | null): ReactElement => (
    <>
      <span className="shrink-0 text-right tabular-nums text-muted-foreground">
        {node?.nodeType === 'file' ? formatFileTreeBytes(node.sizeBytes) : '—'}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1 overflow-hidden">
        {node ? (renderStatusBadge?.(node) ?? null) : null}
      </span>
    </>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target for file moves
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragOver={onPaneDragOver}
      onDrop={onPaneDrop}
      onContextMenu={(event: ReactMouseEvent) => {
        if ((event.target as HTMLElement).closest('[data-file-manager-row]')) {
          return;
        }
        event.preventDefault();
        onPaneContextMenu(event.clientX, event.clientY);
      }}
    >
      <nav
        aria-label="Folder path"
        className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-2.5"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id ?? 'root'} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-sm text-muted-foreground">/</span> : null}
              <button
                type="button"
                className={cn(
                  'rounded-md border border-border px-2.5 py-0.5 text-sm transition-colors',
                  index === breadcrumbs.length - 1
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
                onClick={() => onNavigate(crumb.id)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
        {onRefresh ? (
          <Button
            aria-label="Refresh folder"
            className="h-8 w-8 shrink-0 p-0"
            disabled={isRefreshing}
            onClick={onRefresh}
            type="button"
            variant="ghost"
          >
            <RefreshCw aria-hidden className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
        ) : null}
      </nav>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: empty pane click clears selection */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: empty pane click clears selection */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('[data-file-manager-row]')) {
            return;
          }
          onPaneClick();
        }}
      >
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : listEntries.length === 0 ? (
          <p className="flex min-h-[240px] items-start px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <>
            <div
              className={cn(
                'sticky top-0 z-10 border-b border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground',
                rowGridClass,
              )}
            >
              <span aria-hidden />
              <span>Name</span>
              <span className="text-right">Size</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="text-sm">
              {listEntries.map((entry) => {
                if (entry.kind === 'parent') {
                  return (
                    <li
                      key="__parent__"
                      data-file-manager-row
                      className={cn(
                        'cursor-default border-b border-border/50 px-4 py-2 hover:bg-muted/50',
                        rowGridClass,
                      )}
                      onDoubleClick={() => onGoUp()}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onPaneContextMenu(event.clientX, event.clientY);
                      }}
                    >
                      <span aria-hidden className="text-center">
                        📁
                      </span>
                      <span className="min-w-0 truncate font-medium">..</span>
                      {trailingCells(null)}
                    </li>
                  );
                }

                const { node } = entry;
                const selected = selectedIds.has(node.id);
                const cut = cutSet.has(node.id);

                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: file manager row uses mouse-driven selection
                  <li
                    key={node.id}
                    data-file-manager-row
                    draggable
                    className={cn(
                      'cursor-default border-b border-border/50 px-4 py-2 last:border-b-0',
                      rowGridClass,
                      selected ? 'bg-primary/10' : 'hover:bg-muted/50',
                      cut && 'opacity-60',
                      node.nodeType === 'folder' &&
                        dropTargetFolderId === node.id &&
                        'bg-primary/20 ring-1 ring-inset ring-primary/40',
                    )}
                    onClick={(event) => onRowClick(entry, event)}
                    onDoubleClick={() => onRowDoubleClick(entry)}
                    onDragStart={(event) => onDragStart(node.id, event)}
                    onDragOver={(event) => {
                      if (node.nodeType !== 'folder') {
                        return;
                      }
                      if (
                        !event.dataTransfer.types.includes(dragMimeType) &&
                        !event.dataTransfer.types.includes('Files')
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      onFolderDragOver(node.id, event);
                    }}
                    onDragLeave={() => onFolderDragLeave(node.id)}
                    onDrop={(event) => {
                      if (node.nodeType === 'folder') {
                        onFolderDrop(node.id, event);
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onNodeContextMenu(node.id, event.clientX, event.clientY);
                    }}
                  >
                    <span aria-hidden className="shrink-0 text-center">
                      {node.nodeType === 'folder' ? '📁' : '📄'}
                    </span>
                    <span className="min-w-0 truncate">{node.name}</span>
                    {trailingCells(node)}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
