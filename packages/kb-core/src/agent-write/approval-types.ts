import type { KbWriteActor, KbWriteToolRequest, MutationApprovalPreview } from './types.js';

export type MutationApprovalStatus = 'pending' | 'rejected' | 'applied';

export type MutationApprovalRecord = {
  id: string;
  workspaceId: string;
  corpusId: string;
  status: MutationApprovalStatus;
  action: string;
  request: KbWriteToolRequest;
  actor: KbWriteActor;
  preview: MutationApprovalPreview;
  decidedBy: KbWriteActor | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const defaultMutationApprovalListLimit = 50;
export const maxMutationApprovalListLimit = 200;
