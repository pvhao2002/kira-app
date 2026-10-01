import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
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

/** Idempotent: `Api` already throws ApiError, so pages that call this again keep the original code and message. */
export function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  if (e instanceof HttpErrorResponse) {
    const b = (e.error ?? {}) as Partial<ApiError>;
    return {
      status: e.status,
      code: b.code ?? (e.status === 0 ? 'NETWORK' : 'UNKNOWN'),
      message: e.status === 0 ? 'Mất kết nối mạng. Vui lòng thử lại.' : (b.message ?? 'Đã có lỗi xảy ra.'),
      fieldErrors: b.fieldErrors ?? {},
      traceId: b.traceId
    };
  }
  return {status: 0, code: 'UNKNOWN', message: 'Đã có lỗi xảy ra.', fieldErrors: {}};
}

/** Thin promise-based wrapper over HttpClient for `/api/v1`. Errors are thrown as ApiError. */
@Injectable({providedIn: 'root'})
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return this.run(this.http.get<T>(API_BASE + path, {params: p}));
  }

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
