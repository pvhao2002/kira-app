import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API} from './http';
import {Campaign, CampaignRequest} from './models';

@Injectable({providedIn: 'root'})
export class CampaignsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${API}/campaigns`);
  }

  create(body: CampaignRequest): Observable<Campaign> {
    return this.http.post<Campaign>(`${API}/campaigns`, body);
  }

  update(id: number, body: CampaignRequest): Observable<Campaign> {
    return this.http.put<Campaign>(`${API}/campaigns/${id}`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/campaigns/${id}`);
  }
}
