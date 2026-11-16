import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API, queryParams} from './http';
import {ConvertRequest, ConvertResponse, Link, LinkQuery, Page} from './models';

@Injectable({providedIn: 'root'})
export class LinksApi {
  private readonly http = inject(HttpClient);

  convert(body: ConvertRequest): Observable<ConvertResponse> {
    return this.http.post<ConvertResponse>(`${API}/links/convert`, body);
  }

  list(query: LinkQuery): Observable<Page<Link>> {
    return this.http.get<Page<Link>>(`${API}/links`, {params: queryParams(query)});
  }

  /** The server builds the CSV; it is fetched as a blob so the bearer token is sent. */
  export(query: LinkQuery): Observable<Blob> {
    return this.http.get(`${API}/links/export`, {params: queryParams(query), responseType: 'blob'});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/links/${id}`);
  }
}
