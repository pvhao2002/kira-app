import {ApiError} from '../../shared/models/api.models';

const MAX_MESSAGE_LENGTH = 300;

/**
 * Returns the error body only when it follows the API error contract ({code, message, ...}). Proxy error pages,
 * framework responses and network failures return null so their raw content is never shown to the user.
 */
export function apiError(error: unknown): Partial<ApiError> | null {
  const body = (error as {error?: unknown} | null | undefined)?.error;
  if (!body || typeof body !== 'object') return null;
  const {code, message} = body as Record<string, unknown>;
  return typeof code === 'string' && typeof message === 'string' ? body as Partial<ApiError> : null;
}

/**
 * User-facing text for a failed request: the API's domain message when there is one, otherwise the translated
 * fallback. Unexpected server errors always use the fallback.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const body = apiError(error);
  const message = body?.message?.trim();
  if (!body || !message || body.code === 'INTERNAL_ERROR' || message.length > MAX_MESSAGE_LENGTH) return fallback;
  return message;
}
