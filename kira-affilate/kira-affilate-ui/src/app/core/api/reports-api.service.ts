import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API, queryParams} from './http';
import {Granularity, ReportSummary, TimeseriesPoint, TopBy, TopRow} from './models';

@Injectable({providedIn: 'root'})
export class ReportsApi {
  private readonly http = inject(HttpClient);

  summary(from: string, to: string): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${API}/reports/summary`, {params: queryParams({from, to})});
  }

  timeseries(from: string, to: string, granularity: Granularity): Observable<TimeseriesPoint[]> {
    return this.http.get<TimeseriesPoint[]>(`${API}/reports/timeseries`, {params: queryParams({from, to, granularity})});
  }

  top(from: string, to: string, by: TopBy, limit: number): Observable<TopRow[]> {
    return this.http.get<TopRow[]>(`${API}/reports/top`, {params: queryParams({from, to, by, limit})});
  }
}
