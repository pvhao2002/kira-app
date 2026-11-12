const MESSAGES: Record<string, string> = {
  INVALID_REQUEST: 'That request was not accepted. Check the link and try again.',
  INVALID_URL: 'That link is not valid. Check it and try again.',
  UNSUPPORTED_PROVIDER: 'Only Google Drive and Scribd links are supported.',
  QUEUE_FULL: 'The server is busy. Try again in a few minutes.',
  RATE_LIMITED: 'Too many requests. Wait a minute and try again.',
  TOO_MANY_ACTIVE_JOBS: 'You have too many exports running. Wait for one to finish.',
  JOB_NOT_FOUND: 'This export no longer exists.',
  JOB_NOT_RETRYABLE: 'This export cannot be retried.',
  JOB_RUNNING: 'This export is running. Wait until it finishes.',
  PROVIDER_EXTRACTION_FAILED: 'Could not read the document. Open the original link to check that it loads.',
  PROVIDER_TIMEOUT: 'The document took too long to process.',
  PROVIDER_BLOCKED: 'The source is verifying the browser or blocking automated access. Open the original link to check access.',
  FILE_TOO_LARGE: 'The resulting PDF is too large (limit 100 MB).',
  FILE_EXPIRED: 'The file was deleted after the retention period.',
  INTERRUPTED: 'The server restarted while processing. Retry the export.',
  INTERNAL_ERROR: 'Something went wrong on the server. Try again later.'
};

const FALLBACK = 'Something went wrong. Try again.';

export function errorMessage(code: string | null | undefined): string {
  return code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : FALLBACK;
}
