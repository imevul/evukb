import type { CorpusIndexEvent, IndexStatusCounts, KnowledgeNode } from '@evu/kb-sdk';

export function patchNodeIndexStatus(
  nodes: KnowledgeNode[],
  event: CorpusIndexEvent,
): KnowledgeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id !== event.nodeId) {
      return node;
    }
    if (node.indexStatus === event.indexStatus) {
      return node;
    }
    changed = true;
    return { ...node, indexStatus: event.indexStatus };
  });
  return changed ? next : nodes;
}

export function patchIndexStatusCounts(
  counts: IndexStatusCounts,
  event: CorpusIndexEvent,
): IndexStatusCounts {
  if (event.previousIndexStatus === event.indexStatus) {
    return counts;
  }

  const next = { ...counts };
  if (event.previousIndexStatus) {
    next[event.previousIndexStatus] = Math.max(0, next[event.previousIndexStatus] - 1);
  }
  next[event.indexStatus] = next[event.indexStatus] + 1;
  return next;
}
