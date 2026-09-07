import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {TravelData, TravelFile, TravelTrip} from '../../shared/models/travel.models';

@Injectable({providedIn: 'root'})
export class TravelApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/travel/trips';
  list() { return this.http.get<TravelTrip[]>(this.base); }
  get(id: string) { return this.http.get<TravelTrip>(`${this.base}/${id}`); }
  save(id: string | null, data: TravelData, version: number) {
    return id ? this.http.put<TravelTrip>(`${this.base}/${id}`, {data, version})
      : this.http.post<TravelTrip>(this.base, {data, version});
  }
  delete(trip: TravelTrip) { return this.http.delete<void>(`${this.base}/${trip.id}`, {params: {version: trip.version}}); }
  files(id: string) { return this.http.get<TravelFile[]>(`${this.base}/${id}/files`); }
  upload(id: string, file: File) {
    const body = new FormData(); body.append('file', file);
    return this.http.post<TravelFile>(`${this.base}/${id}/files`, body);
  }
  download(id: string, file: string) { return this.http.get(`${this.base}/${id}/files/${file}`, {responseType: 'blob'}); }
  deleteFile(id: string, file: string) { return this.http.delete<void>(`${this.base}/${id}/files/${file}`); }
}
