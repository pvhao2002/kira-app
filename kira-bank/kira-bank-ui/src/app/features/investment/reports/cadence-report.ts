import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentCadenceReport} from '../../../shared/models/api.models';
import {downloadCsv, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-cadence-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.cadence') }}</h2><button class="btn ghost" type="button" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <p class="hint">{{ i18n.t('investmentReports.cadence.hint') }}</p>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.cadence.avgGap') }}</small><strong>{{ days(data().averageGapDays) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.cadence.turnaround') }}</small><strong>{{ days(data().avgDaysDepositToWithdrawal) }}</strong></article>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th><th>{{ i18n.t('investmentReports.cadence.avgGap') }}</th>
          <th>{{ i18n.t('investmentReports.cadence.longestGap') }}</th><th>{{ i18n.t('investmentReports.cadence.gapBetween') }}</th><th>{{ i18n.t('investmentReports.cadence.turnaround') }}</th></tr></thead>
        <tbody>@for (row of data().rows; track row.accountId) {
          <tr><td>{{ row.accountName }}</td><td>{{ row.transactions }}</td><td>{{ days(row.averageGapDays) }}</td><td>{{ row.longestGapDays }}</td>
            <td>{{ row.longestGapFrom ? row.longestGapFrom + ' → ' + row.longestGapTo : '—' }}</td><td>{{ days(row.avgDaysDepositToWithdrawal) }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `.hint { color:var(--muted); font-size:12px; line-height:1.5; }`
})
export class CadenceReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentCadenceReport>();
  readonly currency = input.required<string>();
  days(value: number | null): string { return value == null ? '—' : String(value); }
  exportCsv(): void {
    downloadCsv(`investment-cadence-${this.currency()}.csv`, ['account', 'transactions', 'avg_gap_days', 'longest_gap_days', 'longest_gap_from', 'longest_gap_to', 'avg_days_deposit_to_withdrawal'], this.data().rows.map(r => [r.accountName, r.transactions, r.averageGapDays, r.longestGapDays, r.longestGapFrom, r.longestGapTo, r.avgDaysDepositToWithdrawal]));
  }
}
