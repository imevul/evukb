export type CorpusIndexEventKind = 'node_status';

export type CorpusIndexEvent = {
  kind: CorpusIndexEventKind;
  nodeId: string;
  indexStatus: 'pending' | 'indexing' | 'indexed' | 'stale' | 'failed';
  previousIndexStatus?: 'pending' | 'indexing' | 'indexed' | 'stale' | 'failed';
  at: string;
};

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
