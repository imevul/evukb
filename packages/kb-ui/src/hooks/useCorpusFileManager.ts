import type { EvuKbClient } from '@evu/kb-sdk';
import { useCallback, useEffect, useState } from 'react';
import type { FileTreeListEntry } from '../file-manager-types.js';
import { useFileManagerActions } from './corpus-file-manager/useFileManagerActions.js';
import { useFileManagerData } from './corpus-file-manager/useFileManagerData.js';
import { useFileManagerEditor } from './corpus-file-manager/useFileManagerEditor.js';
import { useFileManagerSelection } from './corpus-file-manager/useFileManagerSelection.js';

export type { DeleteNodesConfirmState } from './corpus-file-manager/useFileManagerActions.js';
export type { CorpusFileManagerContextMenuState } from './corpus-file-manager/useFileManagerSelection.js';

export type UseCorpusFileManagerOptions = {
  client: EvuKbClient;
  workspaceId: string;
  corpusId: string;
};

export function useCorpusFileManager({
  client,
  workspaceId,
  corpusId,
}: UseCorpusFileManagerOptions) {
  const { corpusSettings, error, loading, nodes, refreshing, reloadNodes, setError } =
    useFileManagerData({ client, workspaceId, corpusId });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
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
  } = useFileManagerSelection({ nodes });

  const {
    closeEditor,
    editorOpen,
    editorValidationMessages,
    editorValue,
    handleFixOkfFrontmatter,
    handleSave,
    isDirty,
    isOkfCorpus,
    isReadOnly,
    loadingContent,
    openEditorForNode,
    openFileId,
    openFileName,
    openNode,
    savedValue,
    saving,
    setEditorValue,
  } = useFileManagerEditor({
    client,
    workspaceId,
    corpusId,
    nodes,
    corpusSettings,
    reloadNodes,
    setError,
    setCurrentParentId,
    setSuccessMessage,
  });

  const {
    cancelDeleteConfirm,
    closeCreateFileModal,
    closeCreateFolderModal,
    closeRenameModal,
    confirmDeleteNodes,
    createFileError,
    createFileOpen,
    createFolderError,
    createFolderOpen,
    creatingFile,
    creatingFolder,
    deleteConfirm,
    deleteConfirmError,
    deletingNodes,
    fileName,
    filePath,
    folderName,
    folderPath,
    handleCreateFile,
    handleCreateFolder,
    handleDelete,
    handleReindex,
    handleRename,
    moveDraggedNodes,
    openCreateFileModal,
    openCreateFolderModal,
    reindexTargetIds,
    reindexing,
    renameError,
    renameOpen,
    renameValue,
    renaming,
    setFileName,
    setFilePath,
    setFolderName,
    setFolderPath,
    setRenameValue,
    startRename,
  } = useFileManagerActions({
    client,
    workspaceId,
    corpusId,
    nodes,
    treeNodes,
    selectedIds,
    currentFolderPath,
    openFileId,
    setCurrentParentId,
    clearSelection,
    closeEditor,
    openEditorForNode,
    reloadNodes,
    setError,
    setSuccessMessage,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (editorOpen) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        finderInputRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        finderInputRef.current?.focus();
        finderInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen, finderInputRef]);

  const handleRowDoubleClick = useCallback(
    (entry: FileTreeListEntry): void => {
      if (entry.kind === 'parent') {
        goUp();
        return;
      }
      if (entry.node.nodeType === 'folder') {
        openFolder(entry.node.id);
        return;
      }
      openEditorForNode(entry.node.id, entry.node.name);
    },
    [goUp, openEditorForNode, openFolder],
  );

  return {
    anchorIndex,
    breadcrumbs,
    clearSelection,
    closeCreateFileModal,
    closeCreateFolderModal,
    closeEditor,
    closeRenameModal,
    contextMenu,
    contextNode,
    contextNodeIds,
    corpusSettings,
    createFileError,
    createFileOpen,
    createFolderError,
    createFolderOpen,
    creatingFile,
    creatingFolder,
    cancelDeleteConfirm,
    confirmDeleteNodes,
    currentFolderPath,
    currentParentId,
    deleteConfirm,
    deleteConfirmError,
    deletingNodes,
    dragNodeIds,
    dropTargetFolderId,
    editorOpen,
    editorValidationMessages,
    editorValue,
    error,
    fileName,
    filePath,
    filterQuery,
    finderInputRef,
    folderChildren,
    folderName,
    folderPath,
    goUp,
    handleCreateFile,
    handleCreateFolder,
    handleDelete,
    handleFixOkfFrontmatter,
    handleReindex,
    handleRename,
    handleRowClick,
    handleRowDoubleClick,
    handleSave,
    isDirty,
    isOkfCorpus,
    isReadOnly,
    listEntries,
    loading,
    loadingContent,
    moveDraggedNodes,
    nodes,
    openCreateFileModal,
    openCreateFolderModal,
    openEditorForNode,
    openFileId,
    openFileName,
    openFolder,
    openNode,
    reindexTargetIds,
    reindexing,
    refreshing,
    reloadNodes,
    renameError,
    renameOpen,
    renameValue,
    renaming,
    savedValue,
    saving,
    selectedIds,
    setContextMenu,
    setCurrentParentId,
    setDropTargetFolderId,
    setEditorValue,
    setFilterQuery,
    setFileName,
    setFilePath,
    setFolderName,
    setFolderPath,
    setRenameValue,
    setSelectedIds,
    setAnchorIndex,
    setSuccessMessage,
    startRename,
    successMessage,
    treeNodes,
  };
}

export type UseCorpusFileManagerReturn = ReturnType<typeof useCorpusFileManager>;
