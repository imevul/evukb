import { LinkGraphOverview, useLinkGraph } from '@evu/kb-ui';
import { Link, useParams } from 'react-router-dom';

import { kbClient } from '../api/client.js';
import { appConfig, appRoutes } from '../config.js';

export function CorpusLinksPage() {
  const { corpusId } = useParams<{ corpusId: string }>();
  const { graph, loading, error } = useLinkGraph(kbClient, appConfig.workspaceId, corpusId);

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
