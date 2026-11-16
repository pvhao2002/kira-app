import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API, queryParams} from './http';
import {OrderDetail, OrderQuery, OrderRow, Page, SyncRun, SyncStatus, ValidationImport} from './models';

@Injectable({providedIn: 'root'})
export class OrdersApi {
  private readonly http = inject(HttpClient);

  list(query: OrderQuery): Observable<Page<OrderRow>> {
    return this.http.get<Page<OrderRow>>(`${API}/orders`, {params: queryParams(query)});
  }

  detail(id: number): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`${API}/orders/${id}`);
  }

  export(query: OrderQuery): Observable<Blob> {
    return this.http.get(`${API}/orders/export`, {params: queryParams(query), responseType: 'blob'});
  }

  sync(): Observable<SyncRun> {
    return this.http.post<SyncRun>(`${API}/sync`, {});
  }

  syncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${API}/sync/status`);
  }

  syncRuns(page: number, size: number): Observable<Page<SyncRun>> {
    return this.http.get<Page<SyncRun>>(`${API}/sync/runs`, {params: queryParams({page, size})});
  }

  importValidation(validationId: string): Observable<SyncRun> {
    return this.http.post<SyncRun>(`${API}/validations`, {validationId});
  }

  validations(): Observable<ValidationImport[]> {
    return this.http.get<ValidationImport[]>(`${API}/validations`);
  }
}
