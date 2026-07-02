import { type KnowledgeNode, type NodeMutability, resolveNodeMutability } from '@evu/kb-core';

export type KnowledgeNodeResponse = KnowledgeNode & {
  mutability: NodeMutability;
};

export function withNodeMutability(node: KnowledgeNode): KnowledgeNodeResponse {
  return {
    ...node,
    mutability: resolveNodeMutability(node),
  };
}

export function withNodesMutability(nodes: KnowledgeNode[]): KnowledgeNodeResponse[] {
  return nodes.map(withNodeMutability);
}
