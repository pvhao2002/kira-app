import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { create, fromBinary, toBinary, type DescMessage, type MessageInitShape, type MessageShape } from '@bufbuild/protobuf';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiErrorSchema } from '../gen/kira/news/v1/news_pb';

/** The backend speaks protobuf only; there is no JSON variant of this API. */
export const PROTO = 'application/x-protobuf';

/**
 * Signal-based GET of a protobuf message. Call in an injection context; return undefined from `url` to skip.
 * Read it through `data()`: unlike `value()`, it does not throw while the resource is in the error state.
 */
export function protoResource<D extends DescMessage>(schema: D, url: () => string | undefined) {
  const ref = httpResource.arrayBuffer<MessageShape<D>>(
    () => {
      const target = url();
      return target ? { url: target, headers: { Accept: PROTO } } : undefined;
    },
    { parse: (buffer) => fromBinary(schema, new Uint8Array(buffer)) },
  );
  return Object.assign(ref, { data: computed(() => (ref.hasValue() ? ref.value() : undefined)) });
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Turns an HttpErrorResponse carrying a protobuf ApiError body into a readable ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.error instanceof ArrayBuffer && error.error.byteLength > 0) {
      try {
        const body = fromBinary(ApiErrorSchema, new Uint8Array(error.error));
        return new ApiError(error.status, body.code, body.message);
      } catch {
        // fall through: not a protobuf body (proxy error page etc.)
      }
    }
    return new ApiError(error.status, 'HTTP_' + error.status, error.status === 0 ? 'Không kết nối được máy chủ.' : 'Đã có lỗi xảy ra.');
  }
  return new ApiError(0, 'UNKNOWN', 'Đã có lỗi xảy ra.');
}

export function errorMessage(error: unknown): string {
  return toApiError(error).message;
}

/** Mutations (and imperative reads) over protobuf with RxJS. XSRF header is added by HttpClient. */
@Injectable({ providedIn: 'root' })
export class ProtoApi {
  private readonly http = inject(HttpClient);

  get<Res extends DescMessage>(url: string, response: Res): Observable<MessageShape<Res>> {
    return this.call('GET', url, response);
  }

  send<Req extends DescMessage, Res extends DescMessage>(
    method: 'POST' | 'PUT',
    url: string,
    requestSchema: Req,
    body: MessageInitShape<Req>,
    response: Res,
  ): Observable<MessageShape<Res>> {
    const bytes = toBinary(requestSchema, create(requestSchema, body));
    // HttpClient only passes ArrayBuffer through untouched (a Uint8Array would be JSON-serialised).
    return this.call(method, url, response, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  }

  private call<Res extends DescMessage>(method: string, url: string, response: Res, body?: ArrayBuffer): Observable<MessageShape<Res>> {
    return this.http
      .request(method, url, {
        body,
        responseType: 'arraybuffer',
        headers: body ? { Accept: PROTO, 'Content-Type': PROTO } : { Accept: PROTO },
      })
      .pipe(
        map((buffer) => fromBinary(response, new Uint8Array(buffer))),
        catchError((error) => throwError(() => toApiError(error))),
      );
  }
}
