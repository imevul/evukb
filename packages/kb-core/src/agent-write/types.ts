export type KbWriteAction =
  | 'append_document'
  | 'create_document'
  | 'update_document'
  | 'delete_document';

export type KbWriteActor =
  | { kind: 'mcp_token'; tokenId: string }
  | { kind: 'api_key'; tokenId: string }
  | { kind: 'dev' }
  | { kind: 'open' };

export type AppendDocumentRequest = {
  action: 'append_document';
  corpusId: string;
  path: string;
  body: string;
};

export type CreateDocumentRequest = {
  action: 'create_document';
  corpusId: string;
  path: string;
  name: string;
  body: string;
};

export type UpdateDocumentRequest = {
  action: 'update_document';
  corpusId: string;
  nodeId: string;
  body: string;
};

export type DeleteDocumentRequest = {
  action: 'delete_document';
  corpusId: string;
  nodeId: string;
};

export type KbWriteToolRequest =
  | AppendDocumentRequest
  | CreateDocumentRequest
  | UpdateDocumentRequest
  | DeleteDocumentRequest;

export type MutationApprovalPreview = {
  corpusId: string;
  action: KbWriteAction;
  path?: string;
  nodeId?: string;
};

export type KbWriteToolSuccessResponse = {
  ok: true;
  action: KbWriteAction;
  nodeId?: string;
  path?: string;
  deleted?: number;
};

export type KbToolPendingApprovalResponse = {
  ok: false;
  pendingApproval: true;
  approvalId: string;
  preview: MutationApprovalPreview;
};

export type KbWriteToolResponse = KbWriteToolSuccessResponse | KbToolPendingApprovalResponse;

export function isKbToolPendingApproval(
  response: KbWriteToolResponse,
): response is KbToolPendingApprovalResponse {
  return response.ok === false && response.pendingApproval === true;
}

export const agentNotesRoot = 'agent-notes';
