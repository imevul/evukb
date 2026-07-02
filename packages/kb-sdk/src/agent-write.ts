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

export type KbToolRequest =
  | AppendDocumentRequest
  | CreateDocumentRequest
  | UpdateDocumentRequest
  | DeleteDocumentRequest;

/** @deprecated Import KbToolRequest from `./kb-tools.js` for read + write actions. */
export type KbWriteToolRequest = KbToolRequest;

export type KbToolSuccessResponse = {
  ok: true;
  action: KbWriteAction;
  nodeId?: string;
  path?: string;
  deleted?: number;
};

/** @deprecated Use KbToolSuccessResponse from `./kb-tools.js` for read + write responses. */
export type KbWriteToolSuccessResponse = KbToolSuccessResponse;

export type KbToolPendingApprovalResponse = {
  ok: false;
  pendingApproval: true;
  approvalId: string;
  preview: {
    corpusId: string;
    action: KbWriteAction;
    path?: string;
    nodeId?: string;
  };
};

export type KbToolResponse = KbToolSuccessResponse | KbToolPendingApprovalResponse;
