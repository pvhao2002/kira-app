import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {LanguageService} from '../../../core/i18n/language.service';
import {dateFormat} from '../../../core/i18n/formatters';
import {InvestmentSeasonalityReport} from '../../../shared/models/api.models';
import {downloadCsv, formatMoney, REPORT_STYLES} from './report-format';

@Component({
  selector: 'app-seasonality-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <header class="head"><h2>{{ i18n.t('investmentReports.tab.seasonality') }}</h2><button class="btn ghost" type="button" (click)="exportCsv()">{{ i18n.t('investmentReports.exportCsv') }}</button></header>
      <p class="hint">{{ i18n.t('investmentReports.seasonality.hint') }}</p>
      <div class="metrics">
        @if (data().best; as m) { <article><small>{{ i18n.t('investmentReports.seasonality.best') }}</small><strong class="pos">{{ monthName(m.month) }} · {{ money(m.averageNet) }}</strong></article> }
        @if (data().worst; as m) { <article><small>{{ i18n.t('investmentReports.seasonality.worst') }}</small><strong class="neg">{{ monthName(m.month) }} · {{ money(m.averageNet) }}</strong></article> }
      </div>
      <div class="scroll"><div class="bars" style="min-width:420px">@for (m of data().months; track m.month) {
        <div class="col" role="img" tabindex="0" [title]="monthName(m.month) + ' · ' + money(m.averageNet)" [attr.aria-label]="monthName(m.month) + ' · ' + money(m.averageNet)">
          <div class="top">@if (m.averageNet > 0) { <span class="bar pos-bg" [style.height.%]="height(m.averageNet)"></span> }</div><div class="zero"></div>
          <div class="bottom">@if (m.averageNet < 0) { <span class="bar neg-bg" [style.height.%]="height(m.averageNet)"></span> }</div>
          <small>{{ monthName(m.month) }}</small></div>
      }</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>{{ i18n.t('investmentReports.seasonality.month') }}</th><th>{{ i18n.t('investmentReports.seasonality.occurrences') }}</th><th>{{ i18n.t('investmentReports.seasonality.winning') }}</th>
          <th>{{ i18n.t('investmentReports.transactions') }}</th><th>{{ i18n.t('investmentReports.seasonality.total') }}</th><th>{{ i18n.t('investmentReports.seasonality.average') }}</th></tr></thead>
        <tbody>@for (m of data().months; track m.month) {
          <tr><td>{{ monthName(m.month) }}</td><td>{{ m.occurrences }}</td><td>{{ m.winningOccurrences }}</td><td>{{ m.count }}</td><td>{{ money(m.totalNet) }}</td>
            <td [class.pos]="m.averageNet > 0" [class.neg]="m.averageNet < 0">{{ money(m.averageNet) }}</td></tr>
        }</tbody>
      </table></div>
    </section>`,
  styles: REPORT_STYLES + `.hint { color:var(--muted); font-size:12px; }`
})
export class SeasonalityReportComponent {
  readonly i18n = inject(LanguageService);
  readonly data = input.required<InvestmentSeasonalityReport>();
  readonly currency = input.required<string>();
  private readonly max = computed(() => Math.max(1, ...this.data().months.map(m => Math.abs(m.averageNet))));
  height(value: number): number { return Math.abs(value) / this.max() * 100; }
  monthName(month: number): string {
    return dateFormat(this.i18n.locale(), {month: 'short', timeZone: 'UTC'}).format(new Date(Date.UTC(2026, month - 1, 1)));
  }
  money(amount: number): string { return formatMoney(this.i18n.locale(), this.currency(), amount); }
  exportCsv(): void {
    downloadCsv(`investment-seasonality-${this.currency()}.csv`, ['month', 'years_with_activity', 'winning_years', 'transactions', 'total_net', 'average_net', 'currency'], this.data().months.map(m => [m.month, m.occurrences, m.winningOccurrences, m.count, m.totalNet, m.averageNet, this.currency()]));
  }
}
