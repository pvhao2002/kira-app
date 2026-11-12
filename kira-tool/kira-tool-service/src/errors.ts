/** Stable error codes and their HTTP status (mirrors the Java ErrorCode enum). */
export const ERROR_STATUS = {
  /** Framework-level 4xx (bad JSON, body too large, wrong method); the handler keeps the framework status. */
  INVALID_REQUEST: 400,
  INVALID_URL: 400,
  UNSUPPORTED_PROVIDER: 400,
  QUEUE_FULL: 429,
  RATE_LIMITED: 429,
  TOO_MANY_ACTIVE_JOBS: 429,
  JOB_NOT_FOUND: 404,
  JOB_NOT_RETRYABLE: 409,
  // PROVIDER_EXTRACTION_FAILED, PROVIDER_TIMEOUT, PROVIDER_BLOCKED, FILE_TOO_LARGE and INTERRUPTED are job-result
  // codes (stored as job.errorCode, never thrown to the HTTP error handler), so their status is unused.
  PROVIDER_EXTRACTION_FAILED: 422,
  PROVIDER_TIMEOUT: 504,
  PROVIDER_BLOCKED: 503,
  FILE_TOO_LARGE: 413,
  FILE_EXPIRED: 410,
  JOB_RUNNING: 409,
  INTERRUPTED: 500,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const isErrorCode = (v: unknown): v is ErrorCode => typeof v === 'string' && Object.hasOwn(ERROR_STATUS, v);

/** Domain error carrying a stable code. Message must never contain URLs, tokens or paths. */
export class ToolError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  /** status overrides the code's default, only for framework-level INVALID_REQUEST (411, 413, 415...). */
  constructor(code: ErrorCode, status: number = ERROR_STATUS[code]) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
