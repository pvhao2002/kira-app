import {computed, inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
import {AuthResponse, Profile} from '../../shared/models/api.models';

@Injectable({providedIn: 'root'})
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly tokenState = signal<string | null>(null);
  readonly token = this.tokenState.asReadonly();
  private readonly userState = signal<Profile | null>(null);
  readonly user = this.userState.asReadonly();
  readonly authenticated = computed(() => this.userState() !== null);
  readonly admin = computed(() => this.userState()?.roles.includes('ROLE_ADMIN') ?? false);

  login(body: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/login', body, {withCredentials: true}).pipe(tap(r => this.accept(r)));
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/refresh', {}, {withCredentials: true}).pipe(tap(r => this.accept(r)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/v1/auth/logout', {}, {withCredentials: true}).pipe(tap(() => this.clear()));
  }

  clear(): void {
    this.tokenState.set(null);
    this.userState.set(null);
  }

  private accept(r: AuthResponse): void {
    this.tokenState.set(r.accessToken);
    this.userState.set(r.user);
  }
}

