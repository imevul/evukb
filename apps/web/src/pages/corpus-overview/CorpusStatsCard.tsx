import type { KnowledgeCorpusStats } from '@evu/kb-sdk';
import { Card, formatFileTreeBytes, StatusPill } from '@evu/kb-ui';

interface CorpusStatsCardProps {
  stats: KnowledgeCorpusStats;
}

export function CorpusStatsCard({ stats }: CorpusStatsCardProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold leading-none">Corpus stats</h2>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Volume
          </h3>
          <div className="evukb-stat-grid md:grid-cols-3">
            <div className="evukb-stat-card">
              <strong>Files</strong>
              <p>{stats.fileCount}</p>
            </div>
            <div className="evukb-stat-card">
              <strong>Chunks</strong>
              <p>{stats.chunkCount}</p>
            </div>
            <div className="evukb-stat-card">
              <strong>Storage</strong>
              <p>{formatFileTreeBytes(stats.totalBytes)}</p>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Index status
          </h3>
          <div className="evukb-stat-grid md:grid-cols-5">
            <div className="evukb-stat-card">
              <StatusPill tone="warning">Pending</StatusPill>
              <p>{stats.indexStatusCounts.pending}</p>
            </div>
            <div className="evukb-stat-card">
              <StatusPill tone="neutral">Indexing</StatusPill>
              <p>{stats.indexStatusCounts.indexing}</p>
            </div>
            <div className="evukb-stat-card">
              <StatusPill tone="success">Indexed</StatusPill>
              <p>{stats.indexStatusCounts.indexed}</p>
            </div>
            <div className="evukb-stat-card">
              <StatusPill tone="warning">Stale</StatusPill>
              <p>{stats.indexStatusCounts.stale}</p>
            </div>
            <div className="evukb-stat-card">
              <StatusPill tone="warning">Failed</StatusPill>
              <p>{stats.indexStatusCounts.failed}</p>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Links
          </h3>
          <div className="evukb-stat-grid md:grid-cols-3">
            <div className="evukb-stat-card">
              <strong>Internal links</strong>
              <p>{stats.linkCounts.internal}</p>
            </div>
            <div className="evukb-stat-card">
              <StatusPill tone="success">Resolved</StatusPill>
              <p>{stats.linkCounts.resolved}</p>
            </div>
            <div className="evukb-stat-card">
              <StatusPill tone={stats.linkCounts.unresolved > 0 ? 'warning' : 'success'}>
                Unresolved
              </StatusPill>
              <p>{stats.linkCounts.unresolved}</p>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
