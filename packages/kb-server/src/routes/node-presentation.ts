import {
  type KnowledgeNode,
  type MutabilityOptions,
  type NodeMutability,
  resolveNodeMutability,
} from '@evu/kb-core';

export type KnowledgeNodeResponse = KnowledgeNode & {
  mutability: NodeMutability;
};

export function withNodeMutability(
  node: KnowledgeNode,
  options: MutabilityOptions = {},
): KnowledgeNodeResponse {
  return {
    ...node,
    mutability: resolveNodeMutability(node, options),
  };
}

export function withNodesMutability(
  nodes: KnowledgeNode[],
  options: MutabilityOptions = {},
): KnowledgeNodeResponse[] {
  return nodes.map((node) => withNodeMutability(node, options));
}
