import type { KnowledgeLinkGraph } from '@evu/kb-sdk';
import { type ReactNode, useMemo } from 'react';

import { EmptyState } from '../empty-state.js';
import { StatusPill } from '../shell.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table.js';

export type LinkGraphOverviewProps = {
  graph: KnowledgeLinkGraph | null;
  loading: boolean;
  error: string | null;
  renderViewGraphAction?: (nodeId: string) => ReactNode;
};

export function LinkGraphOverview({
  graph,
  loading,
  error,
  renderViewGraphAction,
}: LinkGraphOverviewProps) {
  const edgeCountsByNode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of graph?.edges ?? []) {
      counts.set(edge.fromNodeId, (counts.get(edge.fromNodeId) ?? 0) + 1);
    }
    return counts;
  }, [graph]);

  return (
    <>
      {loading ? <p className="evukb-muted">Loading link graph…</p> : null}
      {error ? <p className="evukb-error">{error}</p> : null}
      {graph?.truncated ? (
        <p className="evukb-muted">
          Graph truncated; narrow with folder filters or raise the limit via API.
        </p>
      ) : null}
      {!loading && graph && graph.nodes.length === 0 ? (
        <EmptyState
          title="No linked markdown files"
          hint="Upload markdown with wikilinks or internal links, then reindex the corpus."
        />
      ) : null}
      {graph && graph.nodes.length > 0 ? (
        <>
          <h2 className="text-base font-semibold">Nodes</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Outbound links</TableHead>
                <TableHead>OKF</TableHead>
                <TableHead>Graph</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {graph.nodes.map((node) => (
                <TableRow key={node.nodeId}>
                  <TableCell>{node.filePath}</TableCell>
                  <TableCell>{node.label}</TableCell>
                  <TableCell>{edgeCountsByNode.get(node.nodeId) ?? 0}</TableCell>
                  <TableCell>
                    {node.hasValidationIssues ? (
                      <StatusPill tone="warning">issues</StatusPill>
                    ) : (
                      <StatusPill tone="success">ok</StatusPill>
                    )}
                  </TableCell>
                  <TableCell>{renderViewGraphAction?.(node.nodeId) ?? null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <h2 className="text-base font-semibold">Edges</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To / target</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {graph.edges.map((edge) => {
                const fromNode = graph.nodes.find((node) => node.nodeId === edge.fromNodeId);
                const toNode = edge.toNodeId
                  ? graph.nodes.find((node) => node.nodeId === edge.toNodeId)
                  : null;
                const targetLabel = toNode?.filePath ?? edge.targetPath ?? edge.raw;
                return (
                  <TableRow key={edge.id}>
                    <TableCell>{fromNode?.filePath ?? edge.fromNodeId}</TableCell>
                    <TableCell>{targetLabel}</TableCell>
                    <TableCell>
                      <StatusPill tone={edge.resolved ? 'success' : 'warning'}>
                        {edge.resolved ? 'resolved' : 'unresolved'}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      ) : null}
    </>
  );
}
