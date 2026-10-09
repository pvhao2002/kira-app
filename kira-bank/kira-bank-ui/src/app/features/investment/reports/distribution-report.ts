import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {dateFormat} from '../../../core/i18n/formatters';
import {InvestmentDistributionReport} from '../../../shared/models/api.models';
import {formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-distribution-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.distribution') }}</h2></header>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.distribution.type') }}</th><th>{{ i18n.t('investmentReports.transactions') }}</th><th>{{ i18n.t('investmentReports.distribution.total') }}</th>
          <th>Min</th><th>Max</th><th>{{ i18n.t('investmentReports.distribution.average') }}</th><th>{{ i18n.t('investmentReports.distribution.median') }}</th><th>P90</th></tr></thead>
        <tbody>@for (row of data().byType; track row.type) {
          <tr><td>{{ i18n.t(typeKey(row.type)) }}</td><td>{{ row.count }}</td><td>{{ money(row.total) }}</td><td>{{ money(row.min) }}</td><td>{{ money(row.max) }}</td>
            <td>{{ money(row.average) }}</td><td>{{ money(row.median) }}</td><td>{{ money(row.p90) }}</td></tr>
        }</tbody>
      </table></div>
      <h3>{{ i18n.t('investmentReports.distribution.histogram') }}</h3>
      <div class="legend"><span class="k dep"></span>{{ i18n.t('investmentReports.deposits') }}<span class="k wd"></span>{{ i18n.t('investmentReports.withdrawals') }}<span class="k bn"></span>{{ i18n.t('investmentReports.bonuses') }}</div>
      <div class="scroll"><div class="hist">@for (b of data().buckets; track $index) {
        <div class="hcol" role="img" tabindex="0" [title]="money(b.from) + ' – ' + money(b.to)" [attr.aria-label]="money(b.from) + ' – ' + money(b.to) + ' · ' + (b.deposits + b.withdrawals + b.bonuses)">
          <div class="stack"><span class="dep" [style.height.%]="h(b.deposits)"></span><span class="wd" [style.height.%]="h(b.withdrawals)"></span><span class="bn" [style.height.%]="h(b.bonuses)"></span></div>
          <small>{{ money(b.from) }}</small>
        </div>
      }</div></div>
      <h3>{{ i18n.t('investmentReports.distribution.largest') }}</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.account') }}</th><th>{{ i18n.t('investmentReports.distribution.type') }}</th><th>{{ i18n.t('investmentReports.distribution.amount') }}</th><th>{{ i18n.t('investmentReports.distribution.when') }}</th></tr></thead>
        <tbody>@for (row of data().largest; track $index) {
          <tr><td>{{ row.accountName }}</td><td>{{ i18n.t(typeKey(row.type)) }}</td><td>{{ money(row.amount) }}</td><td>{{ dateTime(row.at) }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `
    .legend { display:flex; gap:8px 14px; align-items:center; color:var(--muted); font-size:11px; }.legend .k { width:10px; height:10px; border-radius:2px; }
    .dep { background:#3b82f6; }.wd { background:#f59e0b; }.bn { background:#10b981; }
    .hist { display:flex; gap:6px; min-width:560px; padding-top:10px; }.hcol { flex:1; min-width:0; text-align:center; }
    .stack { display:flex; align-items:flex-end; justify-content:center; gap:2px; height:140px; border-bottom:1px solid var(--border); }.stack span { display:block; width:28%; min-height:0; border-radius:3px 3px 0 0; }
    .hcol small { display:block; margin-top:6px; color:var(--muted); font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }`
})
export class DistributionReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentDistributionReport>();
  readonly currency = input.required<string>();
  private readonly max = computed(() => Math.max(1, ...this.data().buckets.flatMap(b => [b.deposits, b.withdrawals, b.bonuses])));
  h(count: number): number { return count / this.max() * 100; }
  typeKey(type: string): string { return `investmentReports.type.${type.toLowerCase()}`; }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  dateTime(value: string): string { return dateFormat(this.i18n.locale(), {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)); }
}
