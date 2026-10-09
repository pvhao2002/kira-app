import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentPaybackReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-payback-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.payback') }}</h2><button class="btn ghost" type="button" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <p class="hint">{{ i18n.t('investmentReports.payback.hint') }}</p>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().deposits) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.withdrawals') }}</small><strong>{{ money(data().withdrawals) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.recovered') }}</small><strong>{{ pct(data().recoveredPct) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.outstanding') }}</small><strong [class.neg]="data().outstanding > 0" [class.pos]="data().outstanding <= 0">{{ money(data().outstanding) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.brokeEven') }}</small><strong>{{ data().accountsBrokeEven }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.payback.stillOut') }}</small><strong>{{ data().accountsOutstanding }}</strong></article>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th>
          <th>{{ i18n.t('investmentReports.payback.recovered') }}</th><th>{{ i18n.t('investmentReports.payback.outstanding') }}</th>
          <th>{{ i18n.t('investmentReports.payback.breakEvenDate') }}</th><th>{{ i18n.t('investmentReports.payback.days') }}</th></tr></thead>
        <tbody>@for (row of data().rows; track row.accountId) {
          <tr><td>{{ row.accountName }}</td><td>{{ money(row.deposits) }}</td><td>{{ money(row.withdrawals) }}</td><td>
            <span class="meter" role="img" [attr.aria-label]="pct(row.recoveredPct)"><i [style.width.%]="meter(row.recoveredPct)"></i></span> {{ pct(row.recoveredPct) }}</td>
            <td [class.neg]="row.outstanding > 0" [class.pos]="row.outstanding <= 0">{{ money(row.outstanding) }}</td>
            <td>{{ row.breakEvenDate ?? '—' }}</td><td>{{ row.daysToBreakEven ?? '—' }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `
    .hint { color:var(--muted); font-size:12px; }
    .meter { display:inline-block; width:80px; height:8px; margin-right:6px; vertical-align:middle; border-radius:4px; background:var(--border); overflow:hidden; }
    .meter i { display:block; height:100%; background:#2563eb; }`
})
export class PaybackReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentPaybackReport>();
  readonly currency = input.required<string>();
  pct(value: number | null): string { return value == null ? '—' : `${value}%`; }
  meter(value: number | null): number { return Math.min(100, Math.max(0, value ?? 0)); }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  exportCsv(): void {
    downloadCsv(`investment-payback-${this.currency()}.csv`, ['account', 'deposits', 'withdrawals', 'recovered_pct', 'outstanding', 'break_even_date', 'days_to_break_even', 'currency'], this.data().rows.map(r => [r.accountName, r.deposits, r.withdrawals, r.recoveredPct, r.outstanding, r.breakEvenDate, r.daysToBreakEven, this.currency()]));
  }
}
