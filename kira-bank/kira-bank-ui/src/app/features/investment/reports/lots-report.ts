import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentLotsReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-lots-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.lots') }}</h2>
        <button class="btn ghost" type="button" [disabled]="!data().lots.length" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <p class="hint">{{ i18n.t('investmentReports.lots.hint') }}</p>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.lots.count') }}</small><strong>{{ data().lotCount }} ({{ data().recoveredLots }} {{ i18n.t('investmentReports.lots.recoveredShort') }})</strong></article>
        <article><small>{{ i18n.t('investmentReports.lots.avgDays') }}</small><strong>{{ data().averageDaysToRecover ?? '—' }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().totalDeposited) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.recovered') }}</small><strong>{{ money(data().totalRecovered) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.outstanding') }}</small><strong [class.neg]="data().outstanding > 0">{{ money(data().outstanding) }}</strong></article>
      </div>
      <h3>{{ i18n.t('investmentReports.lots.aging') }}</h3>
      <div class="aging">@for (b of data().aging; track b.bucket) {
        <div class="bucket"><small>{{ b.bucket }} {{ i18n.t('investmentReports.lots.days') }}</small><strong>{{ money(b.outstanding) }}</strong>
          <span class="bar"><i [style.width.%]="share(b.outstanding)"></i></span><small>{{ b.lots }} {{ i18n.t('investmentReports.lots.lotsWord') }}</small></div>
      }</div>
      @if (data().truncated) { <p class="hint">{{ i18n.t('investmentReports.lots.truncated') }}</p> }
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.lots.depositDate') }}</th><th>{{ i18n.t('investmentReports.distribution.amount') }}</th>
          <th>{{ i18n.t('investmentReports.payback.recovered') }}</th><th>{{ i18n.t('investmentReports.payback.outstanding') }}</th><th>{{ i18n.t('investmentReports.drawdowns.recovery') }}</th>
          <th>{{ i18n.t('investmentReports.payback.days') }}</th><th>{{ i18n.t('investmentReports.lots.age') }}</th></tr></thead>
        <tbody>@for (lot of data().lots; track $index) {
          <tr><td>{{ lot.accountName }}</td><td>{{ lot.depositDate }}</td><td>{{ money(lot.amount) }}</td><td>{{ money(lot.recovered) }}</td>
            <td [class.neg]="lot.outstanding > 0">{{ money(lot.outstanding) }}</td><td>{{ lot.recoveredDate ?? '—' }}</td><td>{{ lot.daysToRecover ?? '—' }}</td><td>{{ lot.ageDays }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `
    .hint { color:var(--muted); font-size:12px; line-height:1.5; }
    .aging { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; }
    .bucket { display:grid; gap:4px; padding:10px 12px; border:1px solid var(--border); border-radius:10px; }.bucket small { color:var(--muted); font-size:11px; }
    .bar { display:block; height:6px; border-radius:3px; background:var(--border); overflow:hidden; }.bar i { display:block; height:100%; background:#dc2626; }`
})
export class LotsReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentLotsReport>();
  readonly currency = input.required<string>();
  private readonly maxOutstanding = computed(() => Math.max(...this.data().aging.map(b => b.outstanding)) || 1);
  share(value: number): number { return value / this.maxOutstanding() * 100; }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  exportCsv(): void {
    downloadCsv(`investment-lots-${this.currency()}${this.data().truncated ? '-newest-200' : ''}.csv`, ['account', 'deposit_date', 'amount', 'recovered', 'outstanding', 'recovered_date', 'days_to_recover', 'age_days', 'currency'],
      this.data().lots.map(l => [l.accountName, l.depositDate, l.amount, l.recovered, l.outstanding, l.recoveredDate, l.daysToRecover, l.ageDays, this.currency()]));
  }
}
