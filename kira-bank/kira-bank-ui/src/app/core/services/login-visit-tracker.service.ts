import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class LoginVisitTracker {
  private recordedInitialLogin = false;
  constructor() {
    window.addEventListener('pageshow', event => {
      if (event.persisted && window.location.pathname === '/login') this.send('back_forward');
    });
  }
  record(): void {
    let navigation = 'spa';
    try {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!this.recordedInitialLogin && entry && ['/', '/login', '/login/'].includes(new URL(entry.name).pathname)) {
        navigation = ['navigate', 'reload', 'back_forward'].includes(entry.type) ? entry.type : 'navigate';
      }
    } catch { /* Navigation Timing may be unavailable; login must still render. */ }
    this.recordedInitialLogin = true;
    this.send(navigation);
  }
  private uuid(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  private storedId(kind: 'localStorage' | 'sessionStorage', key: string): string {
    try {
      const store = window[kind], previous = store.getItem(key);
      if (previous && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previous)) return previous;
      const id = this.uuid(); store.setItem(key, id); return id;
    } catch { return this.uuid(); }
  }
  private send(navigation: string): void {
    try {
      const body = {
        id: this.uuid(), visitorId: this.storedId('localStorage', 'kira-login-visitor'),
        sessionId: this.storedId('sessionStorage', 'kira-login-session'), navigation,
        language: navigator.language.slice(0, 40), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 80),
        screenWidth: Math.min(32768, Math.max(0, window.innerWidth)),
        screenHeight: Math.min(32768, Math.max(0, window.innerHeight)),
        referrer: document.referrer ? new URL(document.referrer).origin : ''
      };
      // Analytics must never block login or trigger the application's error toast.
      void fetch('/api/v1/public/login-visits', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body), keepalive: true, credentials: 'omit'}).catch(() => undefined);
    } catch { /* Storage, browser privacy settings or analytics failures must not affect login. */ }
  }
}
