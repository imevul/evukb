import type { ApiErrorCode } from '@evu/kb-core';

export type { ApiErrorCode } from '@evu/kb-core';

/**
 * Error code as returned by the server. Known codes are typed via
 * ApiErrorCode; unknown codes from newer servers pass through as strings.
 */
export type EvuKbApiErrorCode = ApiErrorCode | (string & {});

export type EvuKbApiErrorBody = {
  error: string;
  code: EvuKbApiErrorCode;
};

export class EvuKbApiError extends Error {
  readonly status: number;
  readonly code: EvuKbApiErrorCode;

  constructor(status: number, code: EvuKbApiErrorCode, message: string) {
    super(message);
    this.name = 'EvuKbApiError';
    this.status = status;
    this.code = code;
  }
}
