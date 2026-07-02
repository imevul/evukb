/**
 * Stable machine-readable error codes returned by the EvuKB HTTP API.
 * Shared by kb-server (which raises them) and kb-sdk (which surfaces them on
 * EvuKbApiError).
 */
export type ApiErrorCode =
  | 'not_found'
  | 'workspace_not_found'
  | 'corpus_not_found'
  | 'node_not_found'
  | 'conflict'
  | 'validation_error'
  | 'payload_too_large'
  | 'forbidden'
  | 'service_unavailable'
  | 'internal_error';
