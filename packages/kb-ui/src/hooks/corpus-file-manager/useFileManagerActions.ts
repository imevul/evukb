import type { EvuKbClient, KnowledgeNode } from '@evu/kb-sdk';
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';
import type { FileTreeNode } from '../../file-manager-types.js';
import { isInvalidMoveTarget, nodeFolderPath } from '../../file-manager-utils.js';

export type DeleteNodesConfirmState = {
  nodeIds: string[];
  label: string;
};

export type UseFileManagerActionsOptions = {
  client: EvuKbClient;
  workspaceId: string;
  corpusId: string;
  nodes: KnowledgeNode[];
  treeNodes: FileTreeNode[];
  selectedIds: Set<string>;
  currentFolderPath: string;
  openFileId: string | null;
  setCurrentParentId: Dispatch<SetStateAction<string | null>>;
  clearSelection: () => void;
  closeEditor: () => void;
  openEditorForNode: (nodeId: string, name: string, parentId?: string | null) => void;
  reloadNodes: () => Promise<KnowledgeNode[]>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSuccessMessage?: Dispatch<SetStateAction<string | null>>;
};

export function useFileManagerActions({
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
}: UseFileManagerActionsOptions) {
  const [reindexing, setReindexing] = useState(false);
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createFileError, setCreateFileError] = useState<string | null>(null);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('notes.md');
  const [folderPath, setFolderPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteNodesConfirmState | null>(null);
  const [deletingNodes, setDeletingNodes] = useState(false);
  const [deleteConfirmError, setDeleteConfirmError] = useState<string | null>(null);

  const reindexTargetIds = useMemo(() => {
    const selectedFiles = [...selectedIds]
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is KnowledgeNode => node != null && node.nodeType === 'file')
      .map((node) => node.id);
    if (selectedFiles.length > 0) {
      return selectedFiles;
    }
    return nodes.filter((node) => node.nodeType === 'file').map((node) => node.id);
  }, [nodes, selectedIds]);

  const resetCreateFileForm = useCallback((): void => {
    setFilePath('');
    setFileName('notes.md');
    setCreateFileError(null);
  }, []);

  const resetCreateFolderForm = useCallback((): void => {
    setFolderPath('');
    setFolderName('');
    setCreateFolderError(null);
  }, []);

  const closeCreateFileModal = useCallback((): void => {
    setCreateFileOpen(false);
    resetCreateFileForm();
  }, [resetCreateFileForm]);

  const closeCreateFolderModal = useCallback((): void => {
    setCreateFolderOpen(false);
    resetCreateFolderForm();
  }, [resetCreateFolderForm]);

  const openCreateFileModal = useCallback((): void => {
    resetCreateFileForm();
    setCreateFileOpen(true);
  }, [resetCreateFileForm]);

  const openCreateFolderModal = useCallback((): void => {
    resetCreateFolderForm();
    setCreateFolderOpen(true);
  }, [resetCreateFolderForm]);

  const closeRenameModal = useCallback((): void => {
    setRenameOpen(false);
    setRenameNodeId(null);
    setRenameValue('');
    setRenameError(null);
  }, []);

  const handleCreateFile = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!corpusId || !fileName.trim()) {
        return;
      }

      setCreatingFile(true);
      setCreateFileError(null);
      try {
        const created = await client.createFile(workspaceId, corpusId, {
          path: filePath || currentFolderPath,
          name: fileName.trim(),
          content: '# New note\n',
        });
        await reloadNodes();
        if (created.parentId) {
          setCurrentParentId(created.parentId);
        }
        closeCreateFileModal();
        setSuccessMessage?.(`File “${created.name}” created.`);
        openEditorForNode(created.id, created.name, created.parentId);
      } catch (createError: unknown) {
        setCreateFileError(
          createError instanceof Error ? createError.message : 'Failed to create file.',
        );
      } finally {
        setCreatingFile(false);
      }
    },
    [
      client,
      closeCreateFileModal,
      corpusId,
      currentFolderPath,
      fileName,
      filePath,
      openEditorForNode,
      reloadNodes,
      setCurrentParentId,
      setSuccessMessage,
      workspaceId,
    ],
  );

  const handleCreateFolder = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!corpusId || !folderName.trim()) {
        return;
      }

      setCreatingFolder(true);
      setCreateFolderError(null);
      try {
        await client.createFolder(workspaceId, corpusId, {
          path: folderPath || currentFolderPath,
          name: folderName.trim(),
        });
        closeCreateFolderModal();
        setSuccessMessage?.(`Folder “${folderName.trim()}” created.`);
        await reloadNodes();
      } catch (createError: unknown) {
        setCreateFolderError(
          createError instanceof Error ? createError.message : 'Failed to create folder.',
        );
      } finally {
        setCreatingFolder(false);
      }
    },
    [
      client,
      closeCreateFolderModal,
      corpusId,
      currentFolderPath,
      folderName,
      folderPath,
      reloadNodes,
      setSuccessMessage,
      workspaceId,
    ],
  );

  const handleRename = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!corpusId || !renameNodeId || !renameValue.trim()) {
        return;
      }

      setRenaming(true);
      setRenameError(null);
      try {
        await client.renameNode(workspaceId, corpusId, renameNodeId, renameValue.trim());
        closeRenameModal();
        await reloadNodes();
      } catch (renameErr: unknown) {
        setRenameError(renameErr instanceof Error ? renameErr.message : 'Failed to rename node.');
      } finally {
        setRenaming(false);
      }
    },
    [client, closeRenameModal, corpusId, renameNodeId, renameValue, reloadNodes, workspaceId],
  );

  const handleReindex = useCallback(async (): Promise<void> => {
    if (!corpusId || reindexTargetIds.length === 0) {
      return;
    }

    setReindexing(true);
    try {
      await client.reindexNodes(workspaceId, corpusId, reindexTargetIds);
      await reloadNodes();
      setError(null);
    } catch (reindexError: unknown) {
      setError(reindexError instanceof Error ? reindexError.message : 'Failed to reindex files.');
    } finally {
      setReindexing(false);
    }
  }, [client, corpusId, reindexTargetIds, reloadNodes, setError, workspaceId]);

  const handleDelete = useCallback(
    (nodeIds: string[]): void => {
      if (!corpusId || nodeIds.length === 0) {
        return;
      }
      const label =
        nodeIds.length === 1
          ? (nodes.find((node) => node.id === nodeIds[0])?.name ?? 'item')
          : `${nodeIds.length} items`;
      setDeleteConfirmError(null);
      setDeleteConfirm({ nodeIds, label });
    },
    [corpusId, nodes],
  );

  const cancelDeleteConfirm = useCallback(() => {
    if (deletingNodes) {
      return;
    }
    setDeleteConfirm(null);
    setDeleteConfirmError(null);
  }, [deletingNodes]);

  const confirmDeleteNodes = useCallback(async (): Promise<void> => {
    if (!deleteConfirm || !corpusId) {
      return;
    }
    setDeletingNodes(true);
    setDeleteConfirmError(null);
    try {
      await client.deleteNodes(workspaceId, corpusId, deleteConfirm.nodeIds);
      if (openFileId && deleteConfirm.nodeIds.includes(openFileId)) {
        closeEditor();
      }
      clearSelection();
      await reloadNodes();
      setDeleteConfirm(null);
    } catch (deleteError: unknown) {
      setDeleteConfirmError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete node.',
      );
    } finally {
      setDeletingNodes(false);
    }
  }, [
    clearSelection,
    client,
    closeEditor,
    corpusId,
    deleteConfirm,
    openFileId,
    reloadNodes,
    workspaceId,
  ]);

  const handleMoveNodes = useCallback(
    async (nodeIds: string[], targetParentId: string | null): Promise<void> => {
      if (!corpusId) {
        return;
      }
      for (const nodeId of nodeIds) {
        if (isInvalidMoveTarget(treeNodes, nodeId, targetParentId)) {
          continue;
        }
        const node = nodes.find((entry) => entry.id === nodeId);
        if (!node || node.mutability?.editable === false) {
          continue;
        }
        const targetFolder = targetParentId
          ? nodes.find((entry) => entry.id === targetParentId)
          : null;
        const targetPath = targetFolder ? nodeFolderPath(targetFolder) : '';
        await client.moveNode(workspaceId, corpusId, nodeId, targetPath);
      }
      await reloadNodes();
    },
    [client, corpusId, nodes, reloadNodes, treeNodes, workspaceId],
  );

  const moveDraggedNodes = useCallback(
    (rawIds: string, targetParentId: string | null): void => {
      let nodeIds: string[];
      try {
        nodeIds = JSON.parse(rawIds) as string[];
      } catch {
        nodeIds = rawIds ? [rawIds] : [];
      }
      if (nodeIds.length === 0) {
        return;
      }
      void handleMoveNodes(nodeIds, targetParentId);
    },
    [handleMoveNodes],
  );

  const startRename = useCallback(
    (nodeId: string): void => {
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node) {
        return;
      }
      setRenameNodeId(nodeId);
      setRenameValue(node.name);
      setRenameError(null);
      setRenameOpen(true);
    },
    [nodes],
  );

  return {
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
  };
}

export type UseFileManagerActionsReturn = ReturnType<typeof useFileManagerActions>;
