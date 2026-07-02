import type { DragEvent, MouseEvent, ReactNode } from 'react';

import type { FileTreeBreadcrumb } from './file-manager-types.js';

export type FileBreadcrumbsProps = {
  crumbs: FileTreeBreadcrumb[];
  onNavigate: (parentId: string | null) => void;
};

export function FileBreadcrumbs({ crumbs, onNavigate }: FileBreadcrumbsProps) {
  return (
    <nav className="evukb-file-breadcrumbs" aria-label="Folder path">
      {crumbs.map((crumb, index) => (
        <span key={crumb.id ?? 'root'}>
          {index > 0 ? <span className="evukb-muted"> / </span> : null}
          <button type="button" onClick={() => onNavigate(crumb.id)}>
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export type FileTreeRowProps = {
  active?: boolean;
  dropTarget?: boolean;
  isFolder?: boolean;
  label: string;
  meta?: ReactNode;
  onClick: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDoubleClick?: () => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
};

export function FileTreeRow({
  label,
  meta,
  active,
  dropTarget,
  isFolder,
  onClick,
  onContextMenu,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileTreeRowProps) {
  const classes = ['evukb-file-tree__row'];
  if (active) {
    classes.push('is-active');
  }
  if (isFolder) {
    classes.push('is-folder');
  }
  if (dropTarget) {
    classes.push('is-drop-target');
  }

  return (
    <button
      className={classes.join(' ')}
      draggable={Boolean(onDragStart)}
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
    >
      <span>{label}</span>
      {meta ? <span>{meta}</span> : null}
    </button>
  );
}

export type FileTreePaneProps = {
  breadcrumbs: ReactNode;
  children: ReactNode;
  filter?: ReactNode;
};

export function FileTreePane({ breadcrumbs, filter, children }: FileTreePaneProps) {
  return (
    <div className="evukb-file-tree">
      <div className="evukb-file-tree__toolbar">
        {breadcrumbs}
        {filter}
      </div>
      <div className="evukb-file-tree__list">{children}</div>
    </div>
  );
}

export type ContextMenuItem = {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
};

export type ContextMenuProps = {
  items: ContextMenuItem[];
  x: number;
  y: number;
};

export function ContextMenu({ x, y, items }: ContextMenuProps) {
  return (
    <div
      className="evukb-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          disabled={item.disabled}
          role="menuitem"
          type="button"
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
