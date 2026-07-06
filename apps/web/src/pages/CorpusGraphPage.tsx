import type { GraphNeighborhood } from '@evu/kb-sdk';
import { GraphNeighborhoodPanel, useLinkGraph } from '@evu/kb-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { appRoutes } from '../config.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export function CorpusGraphPage() {
  const { selectedSlug } = useWorkspace();
  const { corpusId } = useParams<{ corpusId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const graphNodeSearchParam = searchParams.get('nodeId');
  const {
    graph,
    loading: graphLoading,
    error: graphLoadError,
  } = useLinkGraph(kbClient, selectedSlug, corpusId, 250);
  const [neighborhood, setNeighborhood] = useState<GraphNeighborhood | null>(null);
  const [centerNodeId, setCenterNodeId] = useState('');
  const [depth, setDepth] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedNeighborhoodRef = useRef<{ corpusId: string; depth: number; nodeId: string } | null>(
    null,
  );

  const loadNeighborhood = useCallback(
    async (nodeId: string, nextDepth: number) => {
      if (!corpusId || !nodeId) {
        setNeighborhood(null);
        return;
      }

      setLoading(true);
      try {
        const loaded = await kbClient.getGraphNeighborhood(
          selectedSlug,
          corpusId,
          nodeId,
          { depth: nextDepth },
        );
        setNeighborhood(loaded);
        setCenterNodeId(nodeId);
        setError(null);
      } catch (loadError: unknown) {
        setNeighborhood(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load graph neighborhood.',
        );
      } finally {
        setLoading(false);
      }
    },
    [corpusId],
  );

  const activateNode = useCallback(
    (nodeId: string) => {
      setSearchParams({ nodeId });
      void loadNeighborhood(nodeId, depth);
    },
    [depth, loadNeighborhood, setSearchParams],
  );

  useEffect(() => {
    if (!corpusId || graphLoading) {
      return;
    }

    if (graphLoadError) {
      setError(graphLoadError);
      setLoading(false);
      return;
    }

    if (!graph) {
      setLoading(false);
      return;
    }

    const initialNode = graphNodeSearchParam ?? graph.nodes[0]?.nodeId ?? '';
    if (initialNode) {
      const alreadyLoaded =
        loadedNeighborhoodRef.current?.corpusId === corpusId &&
        loadedNeighborhoodRef.current?.nodeId === initialNode &&
        loadedNeighborhoodRef.current.depth === depth;
      if (!alreadyLoaded) {
        loadedNeighborhoodRef.current = { corpusId, nodeId: initialNode, depth };
        void loadNeighborhood(initialNode, depth);
      }
    } else {
      setLoading(false);
    }
  }, [
    corpusId,
    depth,
    graph,
    graphLoadError,
    graphLoading,
    graphNodeSearchParam,
    loadNeighborhood,
  ]);

  if (!corpusId) {
    return null;
  }

  return (
    <GraphNeighborhoodPanel
      centerNodeId={centerNodeId}
      depth={depth}
      error={error ?? graphLoadError}
      graph={graph}
      loading={loading || graphLoading}
      neighborhood={neighborhood}
      onCenterNodeChange={activateNode}
      onDepthChange={(nextDepth) => {
        setDepth(nextDepth);
        if (centerNodeId) {
          void loadNeighborhood(centerNodeId, nextDepth);
        }
      }}
      onNodeActivate={activateNode}
      renderCenterLinks={(center) => (
        <>
          <Link to={appRoutes.corpusFiles(corpusId, center.filePath)}>Open file</Link>
          {' · '}
          <Link to={appRoutes.corpusLinks(corpusId)}>Links table</Link>
        </>
      )}
      renderFooterLinks={() => <Link to={appRoutes.corpusLinks(corpusId)}>Open links table</Link>}
    />
  );
}
