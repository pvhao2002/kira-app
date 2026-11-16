import {HttpParams} from '@angular/common/http';

export const API = '/api/v1';

/** Builds query params, leaving out empty filters so the server applies its defaults. */
export function queryParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}
