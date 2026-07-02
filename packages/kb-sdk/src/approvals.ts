import type { KbToolRequest, KbWriteAction, KbWriteActor } from './agent-write.js';

export type MutationApprovalStatus = 'pending' | 'rejected' | 'applied';

export type MutationApprovalPreview = {
  corpusId: string;
  action: KbWriteAction;
  path?: string;
  nodeId?: string;
};

export type MutationApprovalRecord = {
  id: string;
  workspaceId: string;
  corpusId: string;
  status: MutationApprovalStatus;
  action: string;
  request: KbToolRequest;
  actor: KbWriteActor;
  preview: MutationApprovalPreview;
  decidedBy: KbWriteActor | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MutationApprovalPolicy = {
  append?: 'always' | 'never';
  create?: 'always' | 'never';
  update?: 'always' | 'never';
  delete?: 'always' | 'never';
};
