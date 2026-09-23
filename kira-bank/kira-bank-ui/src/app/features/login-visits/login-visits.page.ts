import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {Subscription} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {dateFormat} from '../../core/i18n/formatters';

interface Page<T> { items: T[]; total: number; page: number; size: number; }
interface IpRow { ip: string; views: number; reloads: number; visitors: number; sessions: number; firstSeen: string; lastSeen: string; }
interface Report { totals: {views: number; reloads: number; ips: number; visitors: number}; ips: Page<IpRow>; retentionDays: number; }
interface Visit { id: string; visitedAt: string; ip: string; peerIp: string; ipSource: string; visitorId: string; sessionId: string;
  navigation: string; userAgent: string; language: string; timezone: string; screenWidth: number; screenHeight: number; referrer: string; }

@Component({selector: 'app-login-visits', imports: [FormsModule], templateUrl: './login-visits.page.html',
  styleUrl: './login-visits.page.scss', changeDetection: ChangeDetectionStrategy.OnPush})
export class LoginVisitsPage {
  readonly i18n = inject(LanguageService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly report = signal<Report | null>(null);
  readonly events = signal<Page<Visit> | null>(null);
  readonly selectedIp = signal<string | null>(null);
  readonly loading = signal(false);
  readonly eventsLoading = signal(false);
  readonly error = signal('');
  readonly eventError = signal('');
  readonly expanded = signal<string | null>(null);
  readonly updated = signal('');
  readonly zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  from = this.day(-6); to = this.day(0); ip = '';
  private filters = {from: '', to: '', ip: ''};
  private reportRequest?: Subscription;
  private eventRequest?: Subscription;
  constructor() {
    this.apply();
    this.destroyRef.onDestroy(() => { this.reportRequest?.unsubscribe(); this.eventRequest?.unsubscribe(); });
  }
  t(key: string): string { return this.i18n.t(`visits.${key}`); }
  private day(offset: number): string {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  date(value: string): string { return dateFormat(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-GB', {dateStyle: 'short', timeStyle: 'medium'}).format(new Date(value)); }
  apply(): void {
    const from = new Date(`${this.from}T00:00:00`), to = new Date(`${this.to}T00:00:00`); to.setDate(to.getDate() + 1);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to || to.getTime() - from.getTime() > 91 * 86400000) {
      this.error.set(this.t('invalidRange')); return;
    }
    this.filters = {from: from.toISOString(), to: to.toISOString(), ip: this.ip.trim()}; this.load(0);
  }
  load(page = this.report()?.ips.page ?? 0): void {
    this.reportRequest?.unsubscribe(); this.eventRequest?.unsubscribe();
    this.selectedIp.set(null); this.events.set(null); this.eventsLoading.set(false); this.report.set(null);
    this.loading.set(true); this.error.set(''); this.updated.set('');
    this.reportRequest = this.http.get<Report>('/api/v1/admin/login-visits', {params: {...this.filters, page, size: 25}}).subscribe({
      next: value => { this.report.set(value); this.loading.set(false); this.updated.set(new Date().toISOString()); },
      error: e => { this.error.set(this.t(e.status === 400 ? 'invalidFilter' : 'error')); this.loading.set(false); }
    });
  }
  detail(ip: string, page = 0): void {
    this.eventRequest?.unsubscribe(); this.selectedIp.set(ip); this.events.set(null); this.expanded.set(null);
    this.eventsLoading.set(true); this.eventError.set('');
    this.eventRequest = this.http.get<Page<Visit>>('/api/v1/admin/login-visits/events', {params: {...this.filters, ip, page, size: 25}}).subscribe({
      next: value => { this.events.set(value); this.eventsLoading.set(false); },
      error: () => { this.eventError.set(this.t('error')); this.eventsLoading.set(false); }
    });
  }
  browser(ua: string): string {
    for (const [pattern, name] of [[/Edg(?:A|iOS)?\/([\d.]+)/, 'Edge'], [/OPR\/([\d.]+)/, 'Opera'], [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'], [/(?:Chrome|CriOS)\/([\d.]+)/, 'Chrome'], [/Version\/([\d.]+).*Safari/, 'Safari']] as const) {
      const match = ua.match(pattern); if (match) return `${name} ${match[1]}`;
    }
    return this.t('unknown');
  }
  device(ua: string): string {
    if (/Android/i.test(ua)) return 'Android'; if (/iPhone|iPad/i.test(ua)) return 'iOS / iPadOS';
    if (/Windows/i.test(ua)) return 'Windows'; if (/Macintosh/i.test(ua)) return 'macOS'; if (/Linux/i.test(ua)) return 'Linux';
    return this.t('unknown');
  }
  toggle(id: string): void { this.expanded.set(this.expanded() === id ? null : id); }
}
