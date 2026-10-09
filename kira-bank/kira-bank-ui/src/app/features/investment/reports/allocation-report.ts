import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {InvestmentAllocationReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-allocation-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.allocation') }}</h2></header>
      <p class="hint">{{ i18n.t('investmentReports.allocation.hint') }}</p>
      <div class="metrics">
        <article><small>{{ i18n.t('investmentReports.allocation.outstanding') }}</small><strong>{{ money(data().totalOutstanding) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.deposits') }}</small><strong>{{ money(data().totalDeposits) }}</strong></article>
        <article><small>HHI</small><strong>{{ data().hhi ?? '—' }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.allocation.level') }}</small><strong [class.neg]="data().concentration === 'CONCENTRATED'" [class.pos]="data().concentration === 'DIVERSIFIED'">{{ i18n.t('investmentReports.allocation.' + data().concentration.toLowerCase()) }}</strong></article>
        <article><small>{{ i18n.t('investmentReports.allocation.top') }}</small><strong>{{ data().topSharePct == null ? '—' : data().topSharePct + '%' }}</strong></article>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.allocation.outstanding') }}</th><th>{{ i18n.t('investmentReports.allocation.share') }}</th>
          <th>{{ i18n.t('investmentReports.deposits') }}</th><th>{{ i18n.t('investmentReports.allocation.depositShare') }}</th><th>{{ i18n.t('investmentReports.withdrawals') }}</th></tr></thead>
        <tbody>@for (row of data().rows; track row.accountId) {
          <tr><td>{{ row.accountName }}</td><td>{{ money(row.outstanding) }}</td>
            <td><span class="meter" role="img" [attr.aria-label]="pct(row.outstandingSharePct)"><i [style.width.%]="row.outstandingSharePct ?? 0"></i></span> {{ pct(row.outstandingSharePct) }}</td>
            <td>{{ money(row.deposits) }}</td><td>{{ pct(row.depositSharePct) }}</td><td>{{ money(row.withdrawals) }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `
    .hint { color:var(--muted); font-size:12px; line-height:1.5; }
    .meter { display:inline-block; width:90px; height:8px; margin-right:6px; vertical-align:middle; border-radius:4px; background:var(--border); overflow:hidden; }
    .meter i { display:block; height:100%; background:#2563eb; }`
})
export class AllocationReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentAllocationReport>();
  readonly currency = input.required<string>();
  pct(value: number | null): string { return value == null ? '—' : `${value}%`; }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
}
