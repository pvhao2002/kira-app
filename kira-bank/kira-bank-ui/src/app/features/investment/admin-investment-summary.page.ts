import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {LanguageService} from '../../core/i18n/language.service';
import {AdminInvestmentSummary} from '../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './reports/report-format';

@Component({
  selector: 'app-admin-investment-summary',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="heading"><span class="eyebrow">{{ i18n.t('investmentReports.admin.eyebrow') }}</span><h1>{{ i18n.t('investmentReports.admin.title') }}</h1><p>{{ i18n.t('investmentReports.admin.description') }}</p></section>
    <section class="panel filters">
      <label><span>{{ i18n.t('investmentReports.from') }}</span><input type="date" [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event)"/></label>
      <label><span>{{ i18n.t('investmentReports.to') }}</span><input type="date" [ngModel]="toDate()" (ngModelChange)="toDate.set($event)"/></label>
      @if ((data()?.currencies?.length ?? 0) > 1) {
        <label><span>{{ i18n.t('investmentReports.currency') }}</span><select (change)="currency.set($any($event.target).value)">
          @for (item of data()!.currencies; track item.currency) { <option [value]="item.currency" [selected]="item.currency === selected()?.currency">{{ item.currency }}</option> }</select></label>
      }
      <button class="btn primary" type="button" [disabled]="invalid() || loading()" (click)="load()">{{ i18n.t('investmentReports.apply') }}</button>
    </section>
    @if (loading()) { <div class="state">{{ i18n.t('investmentReports.loading') }}</div> }
    @else if (failed()) { <div class="state error">{{ i18n.t('investmentReports.error') }} <button class="btn ghost" type="button" (click)="load()">{{ i18n.t('investmentReports.retry') }}</button></div> }
    @else if (selected(); as c) {
      <section class="panel">
        <div class="metrics">
          <article><small>{{ i18n.t('investmentReports.admin.users') }}</small><strong>{{ c.totals.users }}</strong></article>
          <article><small>{{ i18n.t('investmentReports.overview.accounts') }}</small><strong>{{ c.totals.accounts }}</strong></article>
          <article><small>{{ i18n.t('investmentReports.transactions') }}</small><strong>{{ c.totals.transactions }}</strong></article>
          <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(c.totals.deposits) }}</strong></article>
          <article><small>{{ i18n.t('investmentReports.withdrawals') }}</small><strong>{{ money(c.totals.withdrawals) }}</strong></article>
          <article><small>{{ i18n.t('investmentReports.bonuses') }}</small><strong>{{ money(c.totals.bonuses) }}</strong></article>
          <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="c.totals.net >= 0" [class.neg]="c.totals.net < 0">{{ money(c.totals.net) }}</strong></article>
        </div>
        <h3>{{ i18n.t('investmentReports.admin.byMonth') }}</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>{{ i18n.t('investmentReports.periodic.period') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th><th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th><th>{{ i18n.t('investmentReports.bonuses') }}</th><th>{{ i18n.t('investmentReports.net') }}</th></tr></thead>
          <tbody>@for (m of c.months; track m.month) { <tr><td>{{ m.month }}</td><td>{{ m.transactions }}</td><td>{{ money(m.deposits) }}</td><td>{{ money(m.withdrawals) }}</td><td>{{ money(m.bonuses) }}</td><td [class.pos]="m.net >= 0" [class.neg]="m.net < 0">{{ money(m.net) }}</td></tr> }</tbody>
        </table></div>
        <h3>{{ i18n.t('investmentReports.admin.topUsers') }}</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>{{ i18n.t('investmentReports.admin.user') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th><th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th><th>{{ i18n.t('investmentReports.net') }}</th></tr></thead>
          <tbody>@for (u of c.topUsers; track u.userId) { <tr><td>{{ u.fullName }} · {{ u.email }}</td><td>{{ u.transactions }}</td><td>{{ money(u.deposits) }}</td><td>{{ money(u.withdrawals) }}</td><td [class.pos]="u.net >= 0" [class.neg]="u.net < 0">{{ money(u.net) }}</td></tr> }</tbody>
        </table></div>
      </section>
    } @else { <div class="state">{{ i18n.t('investmentReports.empty') }}</div> }`,
  styles: REPORT_STYLES + `
    .heading h1 { margin:5px 0 7px; font-size:clamp(23px,2.4vw,30px); }.heading p { margin:0 0 18px; color:var(--muted); font-size:13px; }
    .eyebrow { color:var(--muted); font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
    .filters { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; margin-bottom:18px; }.filters label { display:grid; gap:5px; color:var(--muted); font-size:11px; }
    .filters input,.filters select { min-height:38px; padding:7px 10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--navy); }
    .panel { margin-bottom:18px; }.state { padding:24px; color:var(--muted); text-align:center; }.error { color:#991b1b; }`
})
export class AdminInvestmentSummaryPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly currency = signal('');
  readonly data = signal<AdminInvestmentSummary | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly invalid = computed(() => !this.fromDate() || !this.toDate() || this.fromDate() > this.toDate());
  readonly selected = computed(() => {
    const items = this.data()?.currencies ?? [];
    return items.find(item => item.currency === this.currency()) ?? items[0] ?? null;
  });

  constructor() {
    const now = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.toDate.set(iso(now));
    this.fromDate.set(iso(new Date(now.getFullYear(), now.getMonth() - 11, 1)));
    this.load();
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  load(): void {
    this.request?.unsubscribe(); // an older, slower response must not overwrite the latest one
    this.loading.set(true);
    this.failed.set(false);
    this.request = this.api.adminInvestmentSummary({fromDate: this.fromDate(), toDate: this.toDate()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }

  money(amount: number): string { return formatMoney(this.i18n.locale(), this.selected()?.currency ?? 'VND', amount); }
}
