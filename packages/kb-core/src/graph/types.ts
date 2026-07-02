import type { NodeId } from '../ids.js';

export type KnowledgeLinkGraphNode = {
  nodeId: NodeId;
  filePath: string;
  label: string;
  hasValidationIssues?: boolean;
};

export type KnowledgeLinkGraphEdge = {
  id: string;
  fromNodeId: NodeId;
  toNodeId: NodeId | null;
  targetPath: string | null;
  raw: string;
  resolved: boolean;
};

export type KnowledgeLinkGraph = {
  nodes: KnowledgeLinkGraphNode[];
  edges: KnowledgeLinkGraphEdge[];
  truncated: boolean;
};

export type GraphNeighborhoodRequest = {
  nodeId: NodeId;
  depth?: number;
  limit?: number;
};

export type GraphNeighborhood = {
  centerNodeId: NodeId;
  nodes: KnowledgeLinkGraphNode[];
  edges: KnowledgeLinkGraphEdge[];
  truncated: boolean;
};

export type LinkGraphQuery = {
  folderPrefix?: string;
  limit?: number;
};
