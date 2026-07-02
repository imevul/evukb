import type { KnowledgeNode } from '@evu/kb-sdk';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileTreeListEntry, FileTreeNode } from '../../file-manager-types.js';
import {
  buildFileTreeBreadcrumbs,
  buildFileTreeListEntries,
  nodeFolderPath,
} from '../../file-manager-utils.js';

export type CorpusFileManagerContextMenuState =
  | { kind: 'node'; nodeId: string; x: number; y: number }
  | { kind: 'pane'; x: number; y: number };

export type UseFileManagerSelectionOptions = {
  nodes: KnowledgeNode[];
};

function toTreeNode(node: KnowledgeNode): FileTreeNode {
  return {
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    path: node.path,
    nodeType: node.nodeType,
    fullPath: nodeFolderPath(node),
    sizeBytes: node.sizeBytes,
  };
}

export function useFileManagerSelection({ nodes }: UseFileManagerSelectionOptions) {
  const finderInputRef = useRef<HTMLInputElement>(null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<CorpusFileManagerContextMenuState | null>(null);

  const treeNodes = useMemo(() => nodes.map(toTreeNode), [nodes]);
  const breadcrumbs = useMemo(
    () => buildFileTreeBreadcrumbs(treeNodes, currentParentId),
    [treeNodes, currentParentId],
  );

  const folderChildren = useMemo(() => {
    const normalized = filterQuery.trim().toLowerCase();
    const base = normalized
      ? treeNodes.filter((node) => node.fullPath.toLowerCase().includes(normalized))
      : treeNodes.filter((node) => node.parentId === currentParentId);
    return base.sort((left, right) => {
      if (left.nodeType !== right.nodeType) {
        return left.nodeType === 'folder' ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [treeNodes, currentParentId, filterQuery]);

  const listEntries = useMemo(
    () =>
      buildFileTreeListEntries({
        folderChildren,
        showParentRow: !filterQuery.trim() && currentParentId !== null,
      }),
    [folderChildren, currentParentId, filterQuery],
  );

  const currentFolderPath = useMemo(() => {
    if (!currentParentId) {
      return '';
    }
    const folder = nodes.find((node) => node.id === currentParentId);
    return folder ? nodeFolderPath(folder) : '';
  }, [currentParentId, nodes]);

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
    setAnchorIndex(null);
  }, []);

  useEffect(() => {
    const closeMenu = (): void => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const dragNodeIds = useCallback(
    (nodeId: string): string[] => {
      if (selectedIds.has(nodeId) && selectedIds.size > 0) {
        return [...selectedIds];
      }
      return [nodeId];
    },
    [selectedIds],
  );

  const openFolder = useCallback(
    (folderId: string): void => {
      setCurrentParentId(folderId);
      clearSelection();
      setFilterQuery('');
    },
    [clearSelection],
  );

  const goUp = useCallback((): void => {
    if (!currentParentId) {
      return;
    }
    const current = nodes.find((node) => node.id === currentParentId);
    setCurrentParentId(current?.parentId ?? null);
    clearSelection();
  }, [clearSelection, currentParentId, nodes]);

  const handleRowClick = useCallback(
    (entry: FileTreeListEntry, event: MouseEvent): void => {
      if (entry.kind === 'parent') {
        return;
      }
      const { node, selectableIndex } = entry;
      if (event.shiftKey && anchorIndex !== null) {
        const start = Math.min(anchorIndex, selectableIndex);
        const end = Math.max(anchorIndex, selectableIndex);
        const rangeIds = folderChildren.slice(start, end + 1).map((item) => item.id);
        setSelectedIds(new Set(rangeIds));
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
        setAnchorIndex(selectableIndex);
        return;
      }
      setSelectedIds(new Set([node.id]));
      setAnchorIndex(selectableIndex);
    },
    [anchorIndex, folderChildren],
  );

  const contextNode =
    contextMenu?.kind === 'node' ? nodes.find((node) => node.id === contextMenu.nodeId) : null;

  const contextNodeIds =
    contextNode && selectedIds.has(contextNode.id)
      ? [...selectedIds]
      : contextNode
        ? [contextNode.id]
        : [];

  return {
    anchorIndex,
    breadcrumbs,
    clearSelection,
    contextMenu,
    contextNode,
    contextNodeIds,
    currentFolderPath,
    currentParentId,
    dragNodeIds,
    dropTargetFolderId,
    filterQuery,
    finderInputRef,
    folderChildren,
    goUp,
    handleRowClick,
    listEntries,
    openFolder,
    selectedIds,
    setAnchorIndex,
    setContextMenu,
    setCurrentParentId,
    setDropTargetFolderId,
    setFilterQuery,
    setSelectedIds,
    treeNodes,
  };
}

export type UseFileManagerSelectionReturn = ReturnType<typeof useFileManagerSelection>;
