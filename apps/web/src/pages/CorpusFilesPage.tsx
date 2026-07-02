import { CorpusFileManagerPanel, nodeFolderPath, useCorpusFileManager } from '@evu/kb-ui';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

export function CorpusFilesPage() {
  const { corpusId } = useParams<{ corpusId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileSearchParam = searchParams.get('file');

  const manager = useCorpusFileManager({
    client: kbClient,
    workspaceId: appConfig.workspaceId,
    corpusId: corpusId ?? '',
  });

  useEffect(() => {
    if (!fileSearchParam || manager.nodes.length === 0 || manager.editorOpen) {
      return;
    }
    const match = manager.nodes.find(
      (node) => node.nodeType === 'file' && nodeFolderPath(node) === fileSearchParam,
    );
    if (!match) {
      return;
    }
    manager.openEditorForNode(match.id, match.name, match.parentId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('file');
        return next;
      },
      { replace: true },
    );
  }, [
    fileSearchParam,
    manager.editorOpen,
    manager.nodes,
    manager.openEditorForNode,
    setSearchParams,
  ]);

  if (!corpusId) {
    return null;
  }

  return <CorpusFileManagerPanel {...manager} />;
}
