import type { GraphNeighborhood, KnowledgeLinkGraph } from '@evu/kb-sdk';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../cn.js';
import { EmptyState } from '../empty-state.js';
import { Button } from '../primitives.js';
import { StatusPill } from '../shell.js';

type GraphNodeLayout = {
  nodeId: string;
  label: string;
  filePath: string;
  x: number;
  y: number;
  isCenter: boolean;
  hasValidationIssues?: boolean | undefined;
};

const GRAPH_MIN_HEIGHT = 420;

function graphDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(Math.round(width), 1),
    height: Math.max(Math.round(height), GRAPH_MIN_HEIGHT),
  };
}

export function layoutNeighborhood(
  neighborhood: GraphNeighborhood,
  width: number,
  height: number,
): GraphNodeLayout[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const others = neighborhood.nodes.filter((node) => node.nodeId !== neighborhood.centerNodeId);
  const radius = Math.min(width, height) * 0.35;

  return neighborhood.nodes.map((node) => {
    if (node.nodeId === neighborhood.centerNodeId) {
      return {
        nodeId: node.nodeId,
        label: node.label,
        filePath: node.filePath,
        x: centerX,
        y: centerY,
        isCenter: true,
        hasValidationIssues: node.hasValidationIssues,
      };
    }

    const index = others.findIndex((entry) => entry.nodeId === node.nodeId);
    const angle = (index / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      nodeId: node.nodeId,
      label: node.label,
      filePath: node.filePath,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      isCenter: false,
      hasValidationIssues: node.hasValidationIssues,
    };
  });
}

function GraphEdgeLegend() {
  return (
    <fieldset className="evukb-graph-legend">
      <legend className="text-sm text-muted-foreground">Edge legend</legend>
      <span className="evukb-graph-legend__item">
        <svg aria-hidden="true" className="evukb-graph-legend__swatch" viewBox="0 0 24 6">
          <line stroke="hsl(var(--border))" strokeWidth="2" x1="0" x2="24" y1="3" y2="3" />
        </svg>
        Resolved link
      </span>
      <span className="evukb-graph-legend__item">
        <svg aria-hidden="true" className="evukb-graph-legend__swatch" viewBox="0 0 24 6">
          <line
            stroke="hsl(var(--graph-warning))"
            strokeDasharray="4 3"
            strokeWidth="2"
            x1="0"
            x2="24"
            y1="3"
            y2="3"
          />
        </svg>
        Unresolved target
      </span>
    </fieldset>
  );
}

export type GraphNeighborhoodViewProps = {
  graph: KnowledgeLinkGraph | null;
  neighborhood: GraphNeighborhood | null;
  centerNodeId: string;
  depth: number;
  loading: boolean;
  error: string | null;
  onCenterNodeChange: (nodeId: string) => void;
  onDepthChange: (depth: number) => void;
  onNodeActivate: (nodeId: string) => void;
  renderCenterLinks?: (center: { filePath: string; label: string }) => ReactNode;
  renderFooterLinks?: () => ReactNode;
};

export function GraphNeighborhoodView({
  graph,
  neighborhood,
  centerNodeId,
  depth,
  loading,
  error,
  onCenterNodeChange,
  onDepthChange,
  onNodeActivate,
  renderCenterLinks,
  renderFooterLinks,
}: GraphNeighborhoodViewProps) {
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState(() => graphDimensions(720, 420));

  const layouts = useMemo(() => {
    if (!neighborhood) {
      return [];
    }
    return layoutNeighborhood(neighborhood, graphSize.width, graphSize.height);
  }, [graphSize.height, graphSize.width, neighborhood]);

  const layoutById = useMemo(() => new Map(layouts.map((node) => [node.nodeId, node])), [layouts]);

  const centerNode = useMemo(() => {
    if (!neighborhood) {
      return null;
    }
    return neighborhood.nodes.find((node) => node.nodeId === neighborhood.centerNodeId) ?? null;
  }, [neighborhood]);

  const graphVisible = (neighborhood?.nodes.length ?? 0) > 0;

  const handleNodeKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>, nodeId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNodeActivate(nodeId);
      }
    },
    [onNodeActivate],
  );

  useEffect(() => {
    if (!graphVisible) {
      return;
    }

    const element = graphContainerRef.current;
    if (!element) {
      return;
    }

    const updateSize = (width: number, height: number) => {
      const next = graphDimensions(width, height);
      setGraphSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };

    const rect = element.getBoundingClientRect();
    updateSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateSize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [graphVisible]);

  return (
    <>
      <p className="evukb-muted">
        Radial neighborhood view around a center markdown node. Click or activate a node to recenter
        the graph.
      </p>
      {error ? <p className="evukb-error">{error}</p> : null}
      <div className="evukb-form-grid">
        <label>
          Center node
          <select
            value={centerNodeId}
            onChange={(event) => {
              onCenterNodeChange(event.target.value);
            }}
          >
            {(graph?.nodes ?? []).map((node) => (
              <option key={node.nodeId} value={node.nodeId}>
                {node.filePath}
              </option>
            ))}
          </select>
        </label>
        <label>
          Depth
          <select
            value={depth}
            onChange={(event) => {
              onDepthChange(Number.parseInt(event.target.value, 10));
            }}
          >
            <option value={1}>1 hop</option>
            <option value={2}>2 hops</option>
          </select>
        </label>
      </div>
      {loading ? <p className="evukb-muted">Loading graph…</p> : null}
      {!loading && (graph?.nodes.length ?? 0) === 0 ? (
        <EmptyState
          title="No linked markdown files"
          hint="Add wikilinks and reindex, or use the Links tab for the full table view."
        />
      ) : null}
      {neighborhood?.truncated ? (
        <p className="evukb-muted">Neighborhood truncated; reduce depth or raise the API limit.</p>
      ) : null}
      {neighborhood && neighborhood.nodes.length > 0 ? (
        <>
          <GraphEdgeLegend />
          {centerNode ? (
            <div className="evukb-graph-selection">
              <p className="evukb-corpus-meta">
                <strong>{centerNode.label}</strong>{' '}
                <span className="evukb-muted">{centerNode.filePath}</span>
              </p>
              {renderCenterLinks ? (
                <p className="evukb-corpus-meta">{renderCenterLinks(centerNode)}</p>
              ) : null}
            </div>
          ) : null}
          <div ref={graphContainerRef} className="evukb-graph-wrap">
            {/* biome-ignore lint/a11y/useSemanticElements: SVG neighborhood canvas uses native graph primitives */}
            <svg
              className="evukb-graph-canvas"
              viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
              role="group"
              aria-label="Link graph neighborhood"
            >
              {neighborhood.edges.map((edge) => {
                const from = layoutById.get(edge.fromNodeId);
                const to = edge.toNodeId ? layoutById.get(edge.toNodeId) : undefined;
                if (!from || !to) {
                  return null;
                }
                return (
                  <line
                    key={edge.id}
                    stroke={edge.resolved ? 'hsl(var(--border))' : 'hsl(var(--graph-warning))'}
                    strokeDasharray={edge.resolved ? undefined : '4 3'}
                    strokeWidth={edge.resolved ? 1.5 : 2}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                );
              })}
              {layouts.map((node) => (
                // biome-ignore lint/a11y/useSemanticElements: SVG nodes use focusable g elements for layout
                <g
                  key={node.nodeId}
                  aria-current={node.isCenter ? 'true' : undefined}
                  aria-label={`${node.label}, ${node.filePath}${node.isCenter ? ', center node' : ''}`}
                  className="evukb-graph-node evukb-graph-node--interactive"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onNodeActivate(node.nodeId);
                  }}
                  onKeyDown={(event) => {
                    handleNodeKeyDown(event, node.nodeId);
                  }}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    fill={
                      node.isCenter ? 'hsl(var(--graph-node-center))' : 'hsl(var(--graph-node))'
                    }
                    r={node.isCenter ? 28 : 22}
                    stroke={
                      node.hasValidationIssues
                        ? 'hsl(var(--graph-warning))'
                        : 'hsl(var(--muted-foreground))'
                    }
                    strokeWidth={node.isCenter ? 2.5 : 1.5}
                  />
                  <text dominantBaseline="middle" textAnchor="middle" x={node.x} y={node.y + 36}>
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          {neighborhood.nodes.length > 1 ? (
            <p className="evukb-corpus-meta">
              Neighbors:{' '}
              {neighborhood.nodes
                .filter((node) => node.nodeId !== neighborhood.centerNodeId)
                .map((node) => (
                  <Button
                    key={node.nodeId}
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      onNodeActivate(node.nodeId);
                    }}
                  >
                    {node.label}
                  </Button>
                ))}
            </p>
          ) : null}
          <p className="evukb-corpus-meta">
            <StatusPill tone="neutral">{neighborhood.nodes.length} nodes</StatusPill>{' '}
            <StatusPill tone="neutral">{neighborhood.edges.length} edges</StatusPill>{' '}
            {renderFooterLinks?.()}
          </p>
        </>
      ) : null}
    </>
  );
}

export type GraphNeighborhoodPanelProps = GraphNeighborhoodViewProps & {
  className?: string;
};

export function GraphNeighborhoodPanel({ className, ...props }: GraphNeighborhoodPanelProps) {
  const graphVisible = (props.neighborhood?.nodes.length ?? 0) > 0;
  return (
    <section
      className={cn(
        'evukb-panel',
        graphVisible && 'evukb-graph-panel evukb-viewport-panel',
        className,
      )}
    >
      <GraphNeighborhoodView {...props} />
    </section>
  );
}
