import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {IconComponent} from '../../shared/icon/icon';
import {CreditCardDashboard, InvestmentStatisticsResponse} from '../../shared/models/api.models';
import {numberFormat, dateFormat} from '../../core/i18n/formatters';

interface LoadState<T> {data: T | null; loading: boolean; failed: boolean}
const initial = <T>(): LoadState<T> => ({data: null, loading: true, failed: false});

@Component({
  selector: 'app-finance-report',
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './finance-report.page.html',
  styleUrl: './finance-report.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinanceReportPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private bankRequest?: Subscription;
  private investmentRequest?: Subscription;

  readonly bank = signal(initial<CreditCardDashboard>());
  readonly investment = signal(initial<InvestmentStatisticsResponse>());
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly currency = signal('');

  readonly rangeInvalid = computed(() => !this.fromDate() || !this.toDate() || this.fromDate() > this.toDate()
    || this.days(this.fromDate(), this.toDate()) > 365);
  readonly flow = computed(() => {
    const values = this.investment().data?.currencies ?? [];
    return values.find(item => item.currency === this.currency()) ?? values[0] ?? null;
  });
  readonly banks = computed(() => [...(this.bank().data?.banks ?? [])].sort((a, b) => b.currentBalance - a.currentBalance));
  readonly accounts = computed(() => [...(this.investment().data?.accounts ?? [])].sort((a, b) => b.netAmount - a.netAmount));

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const today = this.today();
    this.fromDate.set(params.get('fromDate') || this.shift(today, -29));
    this.toDate.set(params.get('toDate') || today);
    this.refresh();
    this.destroyRef.onDestroy(() => {
      this.bankRequest?.unsubscribe();
      this.investmentRequest?.unsubscribe();
    });
  }

  apply(): void {
    if (this.rangeInvalid()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {fromDate: this.fromDate(), toDate: this.toDate()},
      queryParamsHandling: 'merge'
    });
    this.loadInvestment();
  }

  resetDates(days: number): void {
    this.toDate.set(this.today());
    this.fromDate.set(this.shift(this.toDate(), -(days - 1)));
    this.apply();
  }

  refresh(): void {
    this.loadBank();
    this.loadInvestment();
  }

  chooseCurrency(value: string): void { this.currency.set(value); }

  loadBank(): void {
    this.bankRequest?.unsubscribe();
    this.bank.update(value => ({...value, loading: true, failed: false}));
    this.bankRequest = this.api.creditCardDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => this.bank.set({data, loading: false, failed: false}),
      error: () => this.bank.update(value => ({...value, loading: false, failed: true}))
    });
  }

  loadInvestment(): void {
    this.investmentRequest?.unsubscribe();
    this.investment.update(value => ({...value, loading: true, failed: false}));
    this.investmentRequest = this.api.investmentStatistics({fromDate: this.fromDate(), toDate: this.toDate()})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => {
          this.investment.set({data, loading: false, failed: false});
          if (!data.currencies.some(item => item.currency === this.currency())) {
            this.currency.set(data.currencies[0]?.currency ?? '');
          }
        },
        error: () => this.investment.update(value => ({...value, loading: false, failed: true}))
      });
  }

  money(amount: number | null | undefined, currency = 'VND'): string {
    if (amount == null) return '—';
    return numberFormat(this.i18n.locale(), {
      style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2
    }).format(amount);
  }
  percentage(value: number): string {
    return numberFormat(this.i18n.locale(), {style: 'percent', maximumFractionDigits: 1}).format(value / 100);
  }
  date(value: string): string {
    return dateFormat(this.i18n.locale(), {dateStyle: 'medium'}).format(new Date(`${value}T00:00:00`));
  }
  status(value: string): string { return this.i18n.t(`investmentStatistics.status.${value.toLowerCase()}`); }
  barWidth(value: number): number { return Math.min(100, Math.max(0, value)); }

  private days(from: string, to: string): number {
    return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  }
  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  private shift(date: string, amount: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }
}
