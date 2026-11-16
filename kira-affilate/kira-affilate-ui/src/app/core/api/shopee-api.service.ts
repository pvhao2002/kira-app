import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {API, queryParams} from './http';
import {CampaignOffer, CredentialStatus, OfferPage, OfferQuery, ProductOffer, ShopOffer} from './models';

@Injectable({providedIn: 'root'})
export class ShopeeApi {
  private readonly http = inject(HttpClient);

  credentials(): Observable<CredentialStatus> {
    return this.http.get<CredentialStatus>(`${API}/shopee/credentials`);
  }

  saveCredentials(body: {appId: string; secret: string}): Observable<CredentialStatus> {
    return this.http.put<CredentialStatus>(`${API}/shopee/credentials`, body);
  }

  testCredentials(): Observable<CredentialStatus> {
    return this.http.post<CredentialStatus>(`${API}/shopee/credentials/test`, {});
  }

  deleteCredentials(): Observable<void> {
    return this.http.delete<void>(`${API}/shopee/credentials`);
  }

  products(query: OfferQuery): Observable<OfferPage<ProductOffer>> {
    return this.http.get<OfferPage<ProductOffer>>(`${API}/shopee/offers/products`, {params: queryParams(query)});
  }

  shops(query: OfferQuery): Observable<OfferPage<ShopOffer>> {
    return this.http.get<OfferPage<ShopOffer>>(`${API}/shopee/offers/shops`, {params: queryParams(query)});
  }

  campaigns(query: OfferQuery): Observable<OfferPage<CampaignOffer>> {
    return this.http.get<OfferPage<CampaignOffer>>(`${API}/shopee/offers/campaigns`, {params: queryParams(query)});
  }
}
