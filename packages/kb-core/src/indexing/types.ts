export type IndexNodeResultStatus = 'indexed' | 'failed';

export type IndexNodeResult = {
  nodeId: string;
  chunkCount: number;
  linkCount: number;
  indexStatus: IndexNodeResultStatus;
  warnings: string[];
};

export type IndexEnqueueResponse = {
  enqueued: number;
  nodeIds: string[];
};

export const needingAttentionIndexStatuses = ['pending', 'stale', 'failed'] as const;

export type NeedingAttentionIndexStatus = (typeof needingAttentionIndexStatuses)[number];
