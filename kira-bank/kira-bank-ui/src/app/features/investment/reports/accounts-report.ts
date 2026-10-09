import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentAccountsReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-accounts-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.accounts') }}</h2><button class="btn ghost" type="button" [disabled]="!data().rows.length" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().totals.deposits) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.withdrawals') }}</small><strong>{{ money(data().totals.withdrawals) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.net') }}</small><strong [class.pos]="data().totals.net >= 0" [class.neg]="data().totals.net < 0">{{ money(data().totals.net) }}</strong></article>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th>
          <th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th><th>{{ i18n.t('investmentReports.bonuses') }}</th>
          <th>{{ i18n.t('investmentReports.net') }}</th><th>ROI</th><th>{{ i18n.t('investmentReports.accounts.share') }}</th>
          <th>{{ i18n.t('investmentReports.accounts.avgDeposit') }}</th><th>{{ i18n.t('investmentReports.accounts.avgWithdrawal') }}</th>
          <th>{{ i18n.t('investmentReports.accounts.last') }}</th></tr></thead>
        <tbody>@for (row of data().rows; track row.accountId; let i = $index) {
          <tr><td>{{ i + 1 }}</td><td><button class="link" type="button" (click)="select.emit(row.accountId)" [attr.aria-label]="i18n.t('investmentReports.accounts.drill') + ' ' + row.accountName">{{ row.accountName }}</button></td><td>{{ row.totals.count }}</td><td>{{ money(row.totals.deposits) }}</td>
            <td>{{ money(row.totals.withdrawals) }}</td><td>{{ money(row.totals.bonuses) }}</td>
            <td [class.pos]="row.totals.net >= 0" [class.neg]="row.totals.net < 0">{{ money(row.totals.net) }}</td>
            <td>{{ row.roiPct == null ? '—' : row.roiPct + '%' }}</td><td>{{ row.netSharePct == null ? '—' : row.netSharePct + '%' }}</td>
            <td>{{ money(row.averageDeposit) }}</td><td>{{ money(row.averageWithdrawal) }}</td>
            <td>{{ row.lastDate }} · {{ row.daysSinceLast }}d</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `.link { padding:0; border:0; background:none; color:#2563eb; font:inherit; text-decoration:underline; cursor:pointer; }`
})
export class AccountsReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentAccountsReport>();
  readonly currency = input.required<string>();
  readonly select = output<number>();
  exportCsv(): void {
    downloadCsv(`investment-accounts-${this.currency()}.csv`,
      ['account', 'transactions', 'deposits', 'withdrawals', 'bonuses', 'net', 'roi_pct', 'net_share_pct', 'avg_deposit', 'avg_withdrawal', 'last_date', 'days_since_last', 'currency'],
      this.data().rows.map(r => [r.accountName, r.totals.count, r.totals.deposits, r.totals.withdrawals, r.totals.bonuses, r.totals.net,
        r.roiPct, r.netSharePct, r.averageDeposit, r.averageWithdrawal, r.lastDate, r.daysSinceLast, this.currency()]));
  }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}
