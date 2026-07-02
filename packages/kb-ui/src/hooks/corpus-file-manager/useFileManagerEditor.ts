import type { EvuKbClient, KnowledgeNode } from '@evu/kb-sdk';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  collectEditorValidationMessages,
  fixOkfFrontmatterBoilerplate,
  readValidationIssues,
  resolveFormatProfile,
} from '../../file-manager/okf-helpers.js';
import { nodeFolderPath } from '../../file-manager-utils.js';

export type UseFileManagerEditorOptions = {
  client: EvuKbClient;
  workspaceId: string;
  corpusId: string;
  nodes: KnowledgeNode[];
  corpusSettings: Record<string, unknown>;
  reloadNodes: () => Promise<KnowledgeNode[]>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCurrentParentId: Dispatch<SetStateAction<string | null>>;
  setSuccessMessage?: Dispatch<SetStateAction<string | null>>;
};

export function useFileManagerEditor({
  client,
  workspaceId,
  corpusId,
  nodes,
  corpusSettings,
  reloadNodes,
  setError,
  setCurrentParentId,
  setSuccessMessage,
}: UseFileManagerEditorOptions) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [openFileName, setOpenFileName] = useState('');
  const [editorValue, setEditorValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);

  const openNode = openFileId ? nodes.find((node) => node.id === openFileId) : null;
  const isOkfCorpus = resolveFormatProfile(corpusSettings) === 'okf';
  const isDirty = editorValue !== savedValue;
  const isReadOnly = openNode?.mutability?.editable === false;

  const editorValidationMessages = useMemo(() => {
    if (!openNode || !editorOpen) {
      return [];
    }
    if (isOkfCorpus) {
      return collectEditorValidationMessages({
        content: editorValue,
        corpusSettings,
        fileName: openFileName,
      });
    }
    return readValidationIssues(openNode.metadata).map((issue) => issue.message);
  }, [corpusSettings, editorOpen, editorValue, isOkfCorpus, openFileName, openNode]);

  const openEditorForNode = useCallback(
    (nodeId: string, name: string, parentId?: string | null) => {
      if (parentId !== undefined) {
        setCurrentParentId(parentId);
      }
      setOpenFileId(nodeId);
      setOpenFileName(name);
      setEditorValue('');
      setSavedValue('');
      setEditorOpen(true);
    },
    [setCurrentParentId],
  );

  const closeEditor = useCallback((): void => {
    setEditorOpen(false);
    setOpenFileId(null);
    setOpenFileName('');
    setEditorValue('');
    setSavedValue('');
  }, []);

  const handleFixOkfFrontmatter = useCallback((): void => {
    if (!openNode) {
      return;
    }
    const result = fixOkfFrontmatterBoilerplate({
      content: editorValue,
      filePath: nodeFolderPath(openNode),
    });
    if (result.changed) {
      setEditorValue(result.content);
    }
  }, [editorValue, openNode]);

  useEffect(() => {
    if (!corpusId || !openFileId || !editorOpen) {
      return;
    }

    let cancelled = false;
    setLoadingContent(true);
    void client
      .readNodeContent(workspaceId, corpusId, openFileId)
      .then((content) => {
        if (!cancelled) {
          setEditorValue(content);
          setSavedValue(content);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to read file.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, corpusId, editorOpen, openFileId, setError, workspaceId]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!corpusId || !openFileId) {
      return;
    }

    setSaving(true);
    try {
      await client.saveNodeContent(workspaceId, corpusId, openFileId, editorValue);
      setSavedValue(editorValue);
      setSuccessMessage?.(openFileName ? `Saved “${openFileName}”.` : 'File saved.');
      await reloadNodes();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save file.');
    } finally {
      setSaving(false);
    }
  }, [
    client,
    corpusId,
    editorValue,
    openFileId,
    openFileName,
    reloadNodes,
    setError,
    setSuccessMessage,
    workspaceId,
  ]);

  return {
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
  };
}

export type UseFileManagerEditorReturn = ReturnType<typeof useFileManagerEditor>;
