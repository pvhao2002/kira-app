import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResourceRef, httpResource} from '@angular/common/http';
import {Injector, Service, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';

export const API_BASE = '/api/v1';

/** Backend error body (GlobalExceptionHandler). */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
  traceId?: string;
}

/** Page wrapper returned by list endpoints: paging lives under `meta`. */
export interface PageResponse<T> {
  data: T[];
  meta: {page: number; size: number; totalElements: number; totalPages: number};
}

const isApiError = (e: unknown): e is ApiError => {
  const x = e as Partial<ApiError> | null;
  return !!x && typeof x === 'object' && typeof x.status === 'number' && typeof x.code === 'string' && typeof x.message === 'string';
};

/**
 * Idempotent: keeps an ApiError as is, and unwraps the HttpErrorResponse that `httpResource` / `resource()` may
 * carry in `cause`, so pages can call it on whatever they caught.
 */
export function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  const cause = (e as {cause?: unknown} | null)?.cause;
  const err = e instanceof HttpErrorResponse ? e : cause instanceof HttpErrorResponse ? cause : null;
  if (err) {
    const b = (err.error ?? {}) as Partial<ApiError>;
    return {
      status: err.status,
      code: b.code ?? (err.status === 0 ? 'NETWORK' : 'UNKNOWN'),
      message: err.status === 0 ? 'Mất kết nối mạng. Vui lòng thử lại.'
        : (b.message ?? (err.status >= 500 ? 'Máy chủ chưa phản hồi. Vui lòng thử lại sau ít phút.' : 'Đã có lỗi xảy ra.')),
      fieldErrors: b.fieldErrors ?? {},
      traceId: b.traceId
    };
  }
  return {status: 0, code: 'UNKNOWN', message: 'Đã có lỗi xảy ra.', fieldErrors: {}};
}

/** Request description for {@link apiResource}: `path` is relative to `/api/v1`; empty params are dropped. */
export interface ApiRequest {
  path: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}

interface ApiResourceOptions {
  injector?: Injector;
  debugName?: string;
}

/**
 * Reactive GET for `/api/v1` built on `httpResource` (signal-based reads: `value()`, `isLoading()`, `error()`,
 * `reload()`). The request function re-runs when any signal it reads changes; return `undefined` to stay idle.
 * Reads only: mutations go through {@link Api}.post / put / delete (HttpClient).
 */
export function apiResource<T>(request: () => ApiRequest | undefined, options: ApiResourceOptions & {defaultValue: NoInfer<T>}): HttpResourceRef<T>;
export function apiResource<T>(request: () => ApiRequest | undefined, options?: ApiResourceOptions): HttpResourceRef<T | undefined>;
export function apiResource<T>(request: () => ApiRequest | undefined, options?: ApiResourceOptions & {defaultValue?: T}): HttpResourceRef<T | undefined> {
  return httpResource<T>(() => {
    const r = request();
    if (!r) return undefined;
    const params: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(r.params ?? {})) if (v !== undefined && v !== null && v !== '') params[k] = v;
    return {url: API_BASE + r.path, params};
  }, options as never) as HttpResourceRef<T | undefined>;
}

/** The resource's error as an ApiError, or null when there is none. */
export function resourceError(res: {error: () => unknown}): ApiError | null {
  const e = res.error();
  return e ? toApiError(e) : null;
}

/** Mutations (POST / PUT / DELETE) over HttpClient; errors are thrown as ApiError. */
@Service()
export class Api {
  private readonly http = inject(HttpClient);

  post<T>(path: string, body: unknown = {}, idempotencyKey?: string): Promise<T> {
    const headers = idempotencyKey ? new HttpHeaders({'Idempotency-Key': idempotencyKey}) : undefined;
    return this.run(this.http.post<T>(API_BASE + path, body, {headers}));
  }

  put<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(this.http.put<T>(API_BASE + path, body));
  }

  delete<T>(path: string): Promise<T> {
    return this.run(this.http.delete<T>(API_BASE + path));
  }

  private async run<T>(obs: import('rxjs').Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(obs);
    } catch (e) {
      throw toApiError(e);
    }
  }
}
