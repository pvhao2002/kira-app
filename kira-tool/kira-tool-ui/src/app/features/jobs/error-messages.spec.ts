import {errorMessage} from './error-messages';

describe('errorMessage', () => {
  it('maps every server error code to a human message', () => {
    for (const code of ['INVALID_REQUEST', 'INVALID_URL', 'UNSUPPORTED_PROVIDER', 'QUEUE_FULL', 'RATE_LIMITED', 'TOO_MANY_ACTIVE_JOBS',
      'JOB_NOT_FOUND', 'JOB_NOT_RETRYABLE', 'JOB_RUNNING', 'PROVIDER_EXTRACTION_FAILED', 'PROVIDER_TIMEOUT', 'PROVIDER_BLOCKED',
      'FILE_TOO_LARGE', 'FILE_EXPIRED', 'INTERRUPTED', 'INTERNAL_ERROR']) {
      const m = errorMessage(code);
      expect(m, code).toBeTruthy();
      expect(m, code).not.toContain('_');
    }
  });

  it('does not assume a document is private when extraction fails', () => {
    expect(errorMessage('PROVIDER_EXTRACTION_FAILED')).not.toContain('public');
  });

  it('explains browser verification separately from extraction failures', () => {
    expect(errorMessage('PROVIDER_BLOCKED')).toContain('verifying the browser');
  });

  it('falls back for unknown or missing codes', () => {
    expect(errorMessage('SOMETHING_NEW')).toBe(errorMessage(null));
    expect(errorMessage(undefined)).toBeTruthy();
    expect(errorMessage('toString')).toBe(errorMessage(null));
  });
});
