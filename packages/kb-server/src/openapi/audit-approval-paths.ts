import { approvalIdParam, errorResponse, workspaceIdParam } from './shared.js';

export const auditApprovalPaths = {
  '/api/workspaces/{workspaceId}/audit': {
    get: {
      summary: 'List workspace audit log entries.',
      parameters: [
        workspaceIdParam,
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        },
        {
          name: 'action',
          in: 'query',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': { description: 'Recent audit log entries.' },
        '400': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/approvals': {
    get: {
      summary: 'List pending agent mutation approval requests.',
      parameters: [workspaceIdParam],
      responses: {
        '200': { description: 'Pending approval requests.' },
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/approvals/{approvalId}/approve': {
    post: {
      summary: 'Approve and apply a pending agent mutation.',
      parameters: [workspaceIdParam, approvalIdParam],
      responses: {
        '200': { description: 'Applied mutation result.' },
        '400': errorResponse,
        '403': errorResponse,
        '404': errorResponse,
      },
    },
  },
  '/api/workspaces/{workspaceId}/approvals/{approvalId}/reject': {
    post: {
      summary: 'Reject a pending agent mutation.',
      parameters: [workspaceIdParam, approvalIdParam],
      responses: {
        '200': { description: 'Rejected approval request.' },
        '400': errorResponse,
        '403': errorResponse,
        '404': errorResponse,
      },
    },
  },
};
