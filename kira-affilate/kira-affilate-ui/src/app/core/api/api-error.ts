import {ApiError} from './models';

const MAX_MESSAGE_LENGTH = 300;
export const SERVER_UNAVAILABLE = 'Không kết nối được máy chủ. Vui lòng thử lại.';

/**
 * Returns the error body only when it follows the API error contract ({code, message, ...}). Proxy error pages,
 * framework responses and network failures return null so their raw content is never shown to the user.
 * Angular resources wrap HTTP errors, so the original response is also looked up on `cause`.
 */
export function apiError(error: unknown): Partial<ApiError> | null {
  const source = error as {error?: unknown; cause?: unknown} | null | undefined;
  const body = source?.error ?? (source?.cause as {error?: unknown} | null | undefined)?.error;
  if (!body || typeof body !== 'object') return null;
  const {code, message} = body as Record<string, unknown>;
  return typeof code === 'string' && typeof message === 'string' ? body as Partial<ApiError> : null;
}

export function apiErrorCode(error: unknown): string | null {
  return apiError(error)?.code ?? null;
}

/** User-facing text for a failed request: the API's Vietnamese message when there is one, otherwise the fallback. */
export function apiErrorMessage(error: unknown, fallback: string = SERVER_UNAVAILABLE): string {
  const body = apiError(error);
  const message = body?.message?.trim();
  if (!body || !message || body.code === 'INTERNAL_ERROR' || message.length > MAX_MESSAGE_LENGTH) return fallback;
  return message;
}

export function fieldErrors(error: unknown): Record<string, string> {
  return apiError(error)?.fieldErrors ?? {};
}
