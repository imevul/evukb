import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/errors.js';
import { JobQueueError } from '../src/jobs/job-queue-service.js';
import { mapJobQueueErrorToApiError } from '../src/routes/diagnostics-routes.js';

describe('typed job queue errors', () => {
  it('maps job_not_found to 404', () => {
    const mapped = mapJobQueueErrorToApiError(
      new JobQueueError('job_not_found', 'Failed job not found.'),
      'fallback',
    );
    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped.code).toBe('not_found');
    expect(mapped.statusCode).toBe(404);
  });

  it('maps job_workspace_mismatch to 403', () => {
    const mapped = mapJobQueueErrorToApiError(
      new JobQueueError('job_workspace_mismatch', 'Job does not belong to this workspace.'),
      'fallback',
    );
    expect(mapped.code).toBe('forbidden');
    expect(mapped.statusCode).toBe(403);
  });

  it('maps job_not_retryable to 400', () => {
    const mapped = mapJobQueueErrorToApiError(
      new JobQueueError('job_not_retryable', 'Job queue is not retryable.'),
      'fallback',
    );
    expect(mapped.code).toBe('validation_error');
    expect(mapped.statusCode).toBe(400);
  });

  it('falls back to a validation error for unknown errors', () => {
    const mapped = mapJobQueueErrorToApiError(new Error('boom'), 'fallback');
    expect(mapped.code).toBe('validation_error');
    expect(mapped.message).toBe('boom');

    const fallback = mapJobQueueErrorToApiError('not-an-error', 'fallback');
    expect(fallback.message).toBe('fallback');
  });
});
