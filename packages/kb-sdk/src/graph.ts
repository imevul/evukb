export type KnowledgeLinkGraphNode = {
  nodeId: string;
  filePath: string;
  label: string;
  hasValidationIssues?: boolean;
};

export type KnowledgeLinkGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string | null;
  targetPath: string | null;
  raw: string;
  resolved: boolean;
};

export type KnowledgeLinkGraph = {
  nodes: KnowledgeLinkGraphNode[];
  edges: KnowledgeLinkGraphEdge[];
  truncated: boolean;
};

export type LinkGraphQuery = {
  folderPrefix?: string;
  limit?: number;
};

export type GraphNeighborhoodQuery = {
  depth?: number;
  limit?: number;
};

export type GraphNeighborhood = {
  centerNodeId: string;
  nodes: KnowledgeLinkGraphNode[];
  edges: KnowledgeLinkGraphEdge[];
  truncated: boolean;
};

export type KnowledgeLink = {
  id: string;
  workspaceId: string;
  corpusId: string;
  fromNodeId: string;
  toNodeId: string | null;
  linkKind: 'markdown' | 'wikilink' | 'autolink' | 'citation' | 'external';
  raw: string;
  targetPath: string | null;
  externalUrl: string | null;
  resolved: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};
