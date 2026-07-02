import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import type { ReactElement } from 'react';

import { Alert } from '../alert.js';
import { StatusBadge } from '../badge.js';
import { ConfirmModal } from '../confirm-modal.js';
import { EmptyState } from '../empty-state.js';
import { FileManagerList } from '../file-manager-list.js';
import { FILE_TREE_NODE_DRAG_MIME, type FileTreeNode } from '../file-manager-types.js';
import { ContextMenu } from '../file-tree.js';
import { Input } from '../form.js';
import type { UseCorpusFileManagerReturn } from '../hooks/useCorpusFileManager.js';
import { Button, Card, CardContent, CardHeader, Field } from '../primitives.js';
import { FileCreateFolderModal, FileCreateModal } from './FileCreateModal.js';
import { FileEditorModal } from './FileEditorModal.js';
import { FileRenameModal } from './FileRenameModal.js';

export type CorpusFileManagerPanelProps = UseCorpusFileManagerReturn;

export function CorpusFileManagerPanel({
  breadcrumbs,
  cancelDeleteConfirm,
  clearSelection,
  closeCreateFileModal,
  closeCreateFolderModal,
  closeEditor,
  closeRenameModal,
  confirmDeleteNodes,
  contextMenu,
  contextNode,
  contextNodeIds,
  createFileError,
  createFileOpen,
  createFolderError,
  createFolderOpen,
  creatingFile,
  creatingFolder,
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
}: CorpusFileManagerPanelProps): ReactElement {
  function renderStatusBadge(node: FileTreeNode) {
    if (node.nodeType !== 'file') {
      return null;
    }
    const fullNode = nodes.find((entry) => entry.id === node.id);
    if (!fullNode) {
      return null;
    }
    return <StatusBadge status={fullNode.indexStatus} />;
  }

  return (
    <Card className="evukb-viewport-panel flex flex-col overflow-hidden p-0">
      <CardHeader className="shrink-0 space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold leading-none">File manager</h2>
          <Button
            disabled={reindexing || reindexTargetIds.length === 0}
            onClick={() => void handleReindex()}
            title={
              selectedIds.size > 0
                ? 'Re-index selected markdown files'
                : 'Re-index all files in this corpus'
            }
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            {reindexing ? 'Reindexing…' : 'Reindex'}
          </Button>
        </div>
        <Field>
          <label className="evukb-muted" htmlFor="file-filter">
            Filter
          </label>
          <Input
            ref={finderInputRef}
            id="file-filter"
            placeholder="Name or path — press / or Ctrl+F to focus"
            value={filterQuery}
            onChange={(event) => setFilterQuery(event.target.value)}
          />
        </Field>
        {error ? <p className="evukb-error">{error}</p> : null}
        {successMessage ? (
          <Alert
            onDismiss={() => setSuccessMessage(null)}
            title={successMessage}
            variant="success"
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreateFolderModal} type="button" variant="outline">
            <FolderPlus aria-hidden className="h-3.5 w-3.5" />
            New folder
          </Button>
          <Button onClick={openCreateFileModal} type="button" variant="primary">
            <FilePlus aria-hidden className="h-3.5 w-3.5" />
            New file
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {!loading && listEntries.length === 0 && folderChildren.length === 0 ? (
          <div className="m-4">
            <EmptyState
              hint="Create a folder or markdown file with New folder / New file."
              title="No files here"
            />
          </div>
        ) : (
          <FileManagerList
            breadcrumbs={breadcrumbs}
            dropTargetFolderId={dropTargetFolderId}
            emptyMessage={
              filterQuery.trim() ? 'No files match this filter.' : 'This folder is empty.'
            }
            isLoading={loading}
            isRefreshing={refreshing}
            listEntries={listEntries}
            selectedIds={selectedIds}
            onDragStart={(nodeId, event) => {
              const ids = dragNodeIds(nodeId);
              event.dataTransfer.setData(FILE_TREE_NODE_DRAG_MIME, JSON.stringify(ids));
              event.dataTransfer.effectAllowed = 'move';
            }}
            onFolderDragLeave={(folderId) => {
              if (dropTargetFolderId === folderId) {
                setDropTargetFolderId(null);
              }
            }}
            onFolderDragOver={(folderId, event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropTargetFolderId(folderId);
            }}
            onFolderDrop={(folderId, event) => {
              event.preventDefault();
              event.stopPropagation();
              setDropTargetFolderId(null);
              const raw = event.dataTransfer.getData(FILE_TREE_NODE_DRAG_MIME);
              if (raw) {
                moveDraggedNodes(raw, folderId);
              }
            }}
            onGoUp={goUp}
            onNavigate={(parentId) => {
              setCurrentParentId(parentId);
              clearSelection();
            }}
            onNodeContextMenu={(nodeId, x, y) => {
              const entry = listEntries.find(
                (item) => item.kind === 'node' && item.node.id === nodeId,
              );
              if (entry?.kind === 'node' && !selectedIds.has(nodeId)) {
                setSelectedIds(new Set([nodeId]));
                setAnchorIndex(entry.selectableIndex);
              }
              setContextMenu({ kind: 'node', nodeId, x, y });
            }}
            onPaneClick={clearSelection}
            onPaneContextMenu={(x, y) => setContextMenu({ kind: 'pane', x, y })}
            onPaneDragOver={(event) => {
              if (event.dataTransfer.types.includes(FILE_TREE_NODE_DRAG_MIME)) {
                event.preventDefault();
              }
            }}
            onPaneDrop={(event) => {
              event.preventDefault();
              setDropTargetFolderId(null);
              const raw = event.dataTransfer.getData(FILE_TREE_NODE_DRAG_MIME);
              if (raw) {
                moveDraggedNodes(raw, currentParentId);
              }
            }}
            onRefresh={() => void reloadNodes()}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            renderStatusBadge={renderStatusBadge}
          />
        )}
      </CardContent>

      {contextMenu ? (
        <ContextMenu
          items={
            contextMenu.kind === 'pane'
              ? [
                  { label: 'New folder', onSelect: openCreateFolderModal },
                  { label: 'New file', onSelect: openCreateFileModal },
                ]
              : [
                  {
                    label: 'Open',
                    onSelect: () => {
                      if (!contextNode) {
                        return;
                      }
                      if (contextNode.nodeType === 'folder') {
                        openFolder(contextNode.id);
                        return;
                      }
                      openEditorForNode(contextNode.id, contextNode.name);
                    },
                  },
                  {
                    label: 'Rename',
                    disabled: contextNode?.mutability?.editable === false,
                    onSelect: () => {
                      if (contextNode) {
                        startRename(contextNode.id);
                      }
                    },
                  },
                  {
                    label: 'Delete',
                    disabled:
                      contextNodeIds.length === 0 ||
                      contextNodeIds.some(
                        (id) =>
                          nodes.find((node) => node.id === id)?.mutability?.editable === false,
                      ),
                    onSelect: () => void handleDelete(contextNodeIds),
                  },
                ]
          }
          x={contextMenu.x}
          y={contextMenu.y}
        />
      ) : null}

      <FileEditorModal
        dirty={isDirty}
        fileName={openFileName}
        helperText={
          isReadOnly
            ? (openNode?.mutability?.reason ?? 'This file is read-only.')
            : `Save writes to corpus storage. Indexing runs in the background.${
                isDirty ? ' (unsaved changes)' : ''
              }`
        }
        loadPending={loadingContent}
        open={editorOpen}
        readOnly={isReadOnly}
        {...(openNode?.mutability?.reason ? { readOnlyReason: openNode.mutability.reason } : {})}
        savePending={saving}
        textValue={editorValue}
        validationMessages={editorValidationMessages}
        onClose={closeEditor}
        onSave={() => void handleSave()}
        onTextChange={setEditorValue}
        {...(isOkfCorpus && !isReadOnly ? { onFixOkfFrontmatter: handleFixOkfFrontmatter } : {})}
      />

      <FileCreateModal
        currentFolderPath={currentFolderPath}
        error={createFileError}
        fileName={fileName}
        filePath={filePath}
        open={createFileOpen}
        pending={creatingFile}
        onClose={closeCreateFileModal}
        onFileNameChange={setFileName}
        onFilePathChange={setFilePath}
        onSubmit={handleCreateFile}
      />

      <FileCreateFolderModal
        currentFolderPath={currentFolderPath}
        error={createFolderError}
        folderName={folderName}
        folderPath={folderPath}
        open={createFolderOpen}
        pending={creatingFolder}
        onClose={closeCreateFolderModal}
        onFolderNameChange={setFolderName}
        onFolderPathChange={setFolderPath}
        onSubmit={handleCreateFolder}
      />

      <FileRenameModal
        error={renameError}
        name={renameValue}
        open={renameOpen}
        pending={renaming}
        onClose={closeRenameModal}
        onNameChange={setRenameValue}
        onSubmit={handleRename}
      />

      <ConfirmModal
        confirmLabel={deleteConfirm?.nodeIds.length === 1 ? 'Delete' : 'Delete items'}
        confirming={deletingNodes}
        confirmingLabel="Deleting…"
        description="This permanently removes the selected files or folders from the corpus."
        error={deleteConfirmError}
        onClose={cancelDeleteConfirm}
        onConfirm={() => void confirmDeleteNodes()}
        open={deleteConfirm !== null}
        title={
          deleteConfirm
            ? deleteConfirm.nodeIds.length === 1
              ? `Delete “${deleteConfirm.label}”?`
              : `Delete ${deleteConfirm.label}?`
            : 'Delete items'
        }
      >
        {deleteConfirm ? (
          <p>
            Delete <strong>{deleteConfirm.label}</strong> from this corpus? This cannot be undone.
          </p>
        ) : null}
      </ConfirmModal>
    </Card>
  );
}
