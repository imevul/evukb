import { LinkGraphOverview, useLinkGraph } from '@evu/kb-ui';
import { Link, useParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { appRoutes } from '../config.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

export function CorpusLinksPage() {
  const { selectedSlug } = useWorkspace();
  const { corpusId } = useParams<{ corpusId: string }>();
  const { graph, loading, error } = useLinkGraph(kbClient, selectedSlug, corpusId);

  if (!corpusId) {
    return null;
  }

  return (
    <section className="evukb-panel">
      <LinkGraphOverview
        error={error}
        graph={graph}
        loading={loading}
        renderViewGraphAction={(nodeId) => (
          <Link to={appRoutes.corpusGraph(corpusId, nodeId)}>View</Link>
        )}
      />
    </section>
  );
}
