import {ChangeDetectionStrategy, Component, DestroyRef, WritableSignal, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Observable, Subscription, forkJoin, map} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {AuthStore} from '../../core/auth/auth.store';
import {LanguageService} from '../../core/i18n/language.service';
import {IconComponent, IconName} from '../../shared/icon/icon';
import {PageResponse} from '../../shared/models/api.models';
import {OverviewCredit, OverviewInvestments, OverviewTutoring, OverviewNotification} from '../../shared/models/overview.models';
import {DashboardStatusComponent} from './dashboard-status.component';

interface SectionState<T> { data: T | null; loading: boolean; failed: boolean; updatedAt: string | null }
interface Notifications { items: OverviewNotification[]; unread: number }
interface TaskRow { id: string; title: string; detail: string; amount?: number | null; currency?: string; link: string; params?: Record<string, string | number> }
interface TaskGroup { key: string; total: number; items: TaskRow[]; link: string; urgent?: boolean }
const initial = <T>(): SectionState<T> => ({data: null, loading: true, failed: false, updatedAt: null});

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, IconComponent, DashboardStatusComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  readonly i18n = inject(LanguageService);
  readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Map<string, Subscription>();
  readonly credit = signal(initial<OverviewCredit>());
  readonly investments = signal(initial<OverviewInvestments>());
  readonly tutoring = signal(initial<OverviewTutoring>());
  readonly notifications = signal(initial<Notifications>());
  readonly days = signal(30);
  readonly currency = signal('');
  readonly hidden = signal(this.loadHidden());
  readonly today = signal(new Date());
  readonly busy = computed(() => this.credit().loading || this.investments().loading || this.tutoring().loading || this.notifications().loading);
  readonly flow = computed(() => {
    const values = this.investments().data?.currencies ?? [];
    return values.find(value => value.currency === this.currency()) ?? values[0] ?? null;
  });
  readonly chartMax = computed(() => Math.max(1, ...(this.flow()?.daily.flatMap(day => [day.deposits, day.withdrawals]) ?? [])));
  readonly tasks = computed<TaskGroup[]>(() => {
    const groups: TaskGroup[] = [];
    const credit = this.credit().data;
    if (credit) {
      for (const key of ['overdue', 'dueToday', 'dueSoon', 'needsInput'] as const) {
        const group = credit[key];
        if (group.total) groups.push({key, total: group.total, urgent: key === 'overdue' || key === 'dueToday', link: '/app/credit-cards',
          items: group.items.map(due => ({id: String(due.id), title: `${due.bankName} · ${due.nickname}`,
            detail: [due.lastFour ? `•••• ${due.lastFour}` : '', due.dueDate ? this.date(due.dueDate) : this.i18n.t('overview.noDueDate')].filter(Boolean).join(' · '),
            amount: key === 'needsInput' ? undefined : due.remainingAmount, currency: due.currency, link: '/app/credit-cards'}))});
      }
    }
    const investment = this.investments().data;
    if (investment) {
      for (const key of ['failed', 'review'] as const) {
        const group = investment[key];
        if (group.total) groups.push({key, total: group.total, link: '/app/investment/ai-queue',
          items: group.items.map(batch => ({id: batch.batchId, title: batch.accountName, detail: this.i18n.t(`overview.${key}`),
            link: '/app/investment/transactions', params: {accountId: batch.accountId, batchId: batch.batchId}}))});
      }
    }
    const tutoring = this.tutoring().data;
    if (tutoring?.conflicts.total) groups.push({key: 'conflicts', total: tutoring.conflicts.total, link: '/app/tutor-schedule',
      items: tutoring.conflicts.items.map((conflict, index) => ({id: String(index), title: conflict.description,
        detail: `${this.date(conflict.date)} · ${conflict.startTime.slice(0, 5)}`, link: '/app/tutor-schedule'}))});
    return groups;
  });
  readonly taskCount = computed(() => this.tasks().reduce((total, group) => total + group.total, 0));
  readonly tasksComplete = computed(() => [this.credit(), this.investments(), this.tutoring()].every(state => state.data && !state.loading && !state.failed));
  readonly shortcuts: {key: string; icon: IconName; link: string}[] = [
    {key: 'cards', icon: 'card', link: '/app/credit-cards'},
    {key: 'benefits', icon: 'diamond', link: '/app/credit-card/benefits'},
    {key: 'investments', icon: 'trend-up', link: '/app/investment/accounts'},
    {key: 'queue', icon: 'loader', link: '/app/investment/ai-queue'},
    {key: 'tutoring', icon: 'calendar', link: '/app/tutor-schedule'},
    {key: 'travel', icon: 'globe', link: '/app/travel'},
    {key: 'lodgings', icon: 'home', link: '/app/lodgings'},
    {key: 'passwords', icon: 'key', link: '/app/password-manager'}
  ];

  constructor() {
    this.refresh();
    this.destroyRef.onDestroy(() => this.requests.forEach(request => request.unsubscribe()));
  }
  refresh(): void { this.today.set(new Date()); this.loadCredit(); this.loadInvestments(); this.loadTutoring(); this.loadNotifications(); }
  loadCredit(): void { this.load('credit', this.credit, this.api.get<OverviewCredit>('dashboards/overview/credit-cards')); }
  loadInvestments(): void { this.load('investment', this.investments, this.api.get<OverviewInvestments>(`dashboards/overview/investments?days=${this.days()}`)); }
  loadTutoring(): void { this.load('tutoring', this.tutoring, this.api.get<OverviewTutoring>('dashboards/overview/tutoring')); }
  loadNotifications(): void {
    this.load('notifications', this.notifications, forkJoin({
      page: this.api.get<PageResponse<OverviewNotification>>('notifications?page=0&size=5&sort=createdAt,desc'),
      count: this.api.get<{count: number}>('notifications/unread-count')
    }).pipe(map(({page, count}) => ({items: page.data, unread: count.count}))));
  }
  changeDays(event: Event): void { this.days.set(Number((event.target as HTMLSelectElement).value)); this.loadInvestments(); }
  changeCurrency(event: Event): void { this.currency.set((event.target as HTMLSelectElement).value); }
  toggleHidden(): void {
    this.hidden.update(value => !value);
    try { localStorage.setItem(this.storageKey(), String(this.hidden())); } catch { /* Storage may be unavailable. */ }
  }
  money(amount: number | null | undefined, currency = 'VND'): string {
    if (this.hidden()) return '••••••';
    if (amount == null) return '—';
    return new Intl.NumberFormat(this.locale(), {style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2}).format(amount);
  }
  percentage(value: number): string {
    return this.hidden() ? '••••' : new Intl.NumberFormat(this.locale(), {style: 'percent', maximumFractionDigits: 2}).format(value / 100);
  }
  date(value: string): string {
    return new Intl.DateTimeFormat(this.locale(), {day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'}).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value));
  }
  currentDate(): string {
    return new Intl.DateTimeFormat(this.locale(), {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh'}).format(this.today());
  }
  chartHeight(value: number): number { return value / this.chartMax() * 100; }
  chartLabel(date: string, deposits: number, withdrawals: number, currency: string): string {
    return `${this.date(date)} · ${this.i18n.t('overview.deposits')}: ${this.money(deposits, currency)} · ${this.i18n.t('overview.withdrawals')}: ${this.money(withdrawals, currency)}`;
  }
  private locale(): string { return this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US'; }
  private storageKey(): string { return `kira-overview-hidden-${this.auth.user()?.id ?? 'guest'}`; }
  private loadHidden(): boolean { try { return localStorage.getItem(this.storageKey()) === 'true'; } catch { return false; } }
  private load<T>(key: string, state: WritableSignal<SectionState<T>>, request: Observable<T>): void {
    this.requests.get(key)?.unsubscribe();
    state.update(value => ({...value, loading: true, failed: false}));
    this.requests.set(key, request.subscribe({
      next: data => state.set({data, loading: false, failed: false, updatedAt: new Date().toISOString()}),
      error: () => state.update(value => ({...value, loading: false, failed: true}))
    }));
  }
}
