import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Bank, Card, DashboardSummary, FinderResult, Mcc, PageResponse} from '../../shared/models/api.models';

@Injectable({providedIn: 'root'})
export class ApiService {
  private http = inject(HttpClient);

  banks(search = '', page = 0, size = 20): Observable<PageResponse<Bank>> {
    return this.http.get<PageResponse<Bank>>('/api/v1/public/banks', {params: {search, page, size}});
  }

  cards(search = '', page = 0, size = 20): Observable<PageResponse<Card>> {
    return this.http.get<PageResponse<Card>>('/api/v1/public/cards', {params: {search, page, size}});
  }

  mccs(search = ''): Observable<PageResponse<Mcc>> {
    return this.http.get<PageResponse<Mcc>>('/api/v1/public/mccs', {params: {search}});
  }

  finder(mccId: number, amount: number): Observable<FinderResult[]> {
    return this.http.get<FinderResult[]>('/api/v1/public/cashback-finder', {params: new HttpParams().set('mccId', mccId).set('amount', amount)});
  }

  page<T>(path: string, page = 0, size = 20): Observable<PageResponse<T>> {
    return this.http.get<PageResponse<T>>(`/api/v1/${path}`, {params: {page, size}});
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`/api/v1/${path}`);
  }

  post<T>(path: string, body: unknown, idempotent = false): Observable<T> {
    return this.http.post<T>(`/api/v1/${path}`, body, {headers: idempotent ? {'Idempotency-Key': crypto.randomUUID()} : undefined});
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`/api/v1/${path}`, body);
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<T>(`/api/v1/${path}`, body);
  }

  summary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/v1/dashboards/summary');
  }
}
